import assert from "node:assert/strict";
import { test } from "node:test";
import { createAgsSender } from "./ags.mjs";

const algorithm = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256", publicExponent: new Uint8Array([1,0,1]), modulusLength: 2048 };
const key = await crypto.subtle.generateKey(algorithm, false, ["sign","verify"]);
const config = { issuer: "https://moodle.example", tokenUrl: "https://moodle.example/mod/lti/token.php",
  clientId: "client", keyId: "test-key", privateKey: key.privateKey };
const grade = { lineItemUrl: "https://moodle.example/mod/lti/services.php/154/lineitems/444/lineitem?type_id=1",
  subject: "moodle-user", score: 95, timestamp: "2026-11-20T20:42:00.000Z" };

test("exchanges a signed client assertion and sends the grade to the configured line item", async () => {
  let calls = 0;
  const send = createAgsSender(config, { request: async (url, params) => {
    calls++;
    assert.equal(params.redirect, "error");
    if (calls === 1) {
      assert.equal(url.href, config.tokenUrl);
      const [header, claims, signature] = params.body.get("client_assertion").split(".");
      assert.equal(JSON.parse(Buffer.from(header, "base64url")).kid, "test-key");
      assert.equal(JSON.parse(Buffer.from(claims, "base64url")).aud, config.tokenUrl);
      assert.equal(await crypto.subtle.verify(algorithm, key.publicKey, Buffer.from(signature, "base64url"), Buffer.from(header + "." + claims)), true);
      return Response.json({ access_token: "mock-token", token_type: "Bearer" });
    }
    assert.equal(url.pathname, "/mod/lti/services.php/154/lineitems/444/lineitem/scores");
    assert.equal(url.search, "?type_id=1");
    assert.deepEqual(JSON.parse(params.body), { userId: grade.subject, scoreGiven: 95, scoreMaximum: 100,
      timestamp: grade.timestamp, activityProgress: "Completed", gradingProgress: "FullyGraded" });
    return new Response(null, { status: 204 });
  } });
  assert.deepEqual(await send(grade), { sent: true, phase: "score", status: 204 });
  assert.equal(calls, 2);
  await assert.rejects(send({ ...grade, lineItemUrl: "https://other.example/lineitems/28" }));
  await assert.rejects(send({ ...grade, lineItemUrl: "https://moodle.example/mod/lti/services.php/154/lineitems/444" }));
  assert.equal(calls, 2);
});

test("reports a rejected token without sending a grade", async () => {
  let calls = 0;
  const send = createAgsSender(config, { request: async () => { calls++; return new Response(null, { status: 403 }); } });
  assert.deepEqual(await send(grade), { sent: false, phase: "token", status: 403 });
  assert.equal(calls, 1);
});

test("checks grade authorization without posting a score or returning the token", async () => {
  let calls = 0;
  const sender = createAgsSender(config, { request: async url => {
    calls++;
    assert.equal(url.href, config.tokenUrl);
    return Response.json({ access_token: "private-mock-token", token_type: "Bearer" });
  } });
  assert.deepEqual(await sender.verifyConnection(), { autorizado: true, fase: "token", http: 200 });
  assert.equal(calls, 1);
});
