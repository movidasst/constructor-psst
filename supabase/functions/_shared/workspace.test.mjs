import assert from "node:assert/strict";
import { test } from "node:test";
import { digest } from "./launch.mjs";
import { createWorkspaceApi } from "./workspace.mjs";

const origin = "https://constructor.movidasst.com";

test("keeps the capability private and denies a foreign origin", async () => {
  const calls = [];
  const api = createWorkspaceApi({ origin, rpc: async (name, args) => { calls.push([name, args]); return true; } });
  const ticket = "a".repeat(64);
  const proof="b".repeat(64);
  const request = (urlOrigin, browserProof) => new Request(origin, {
    method: "POST", headers: { Origin: urlOrigin, "Content-Type": "application/json" },
    body: JSON.stringify({ ticket, proof:browserProof, workspace: "other" }),
  });
  assert.equal((await api("exchange", request("https://other.example"))).status, 403);
  assert.equal(calls.length, 0);
  assert.equal((await api("exchange",request(origin))).status,400);
  assert.equal(calls.length,0);
  const response = await api("exchange", request(origin,proof));
  assert.equal(response.status, 200);
  const { session } = await response.json();
  assert.match(session, /^[a-f0-9]{64}$/);
  assert.notEqual(calls[0][1].p_ticket_hash, ticket);
  assert.notEqual(calls[0][1].p_session_hash, session);
  assert.equal(calls[0][0],"psst_lti_exchange_bound");
  assert.equal(calls[0][1].p_challenge,await digest(proof));
  assert.equal(calls[0][1].p_teacher,false);
  assert.deepEqual(Object.keys(calls[0][1]).sort(), ["p_challenge","p_session_hash","p_teacher","p_ticket_hash"]);
});

test("passes only the session and revision to the database when submitting", async () => {
  let calls = 0;
  const api = createWorkspaceApi({ origin, rpc: async (name, args) => {
    calls++;
    assert.equal(name, "psst_lti_submit_activity");
    assert.deepEqual(Object.keys(args).sort(), ["p_hash", "p_request", "p_revision"]);
    return null;
  } });
  const request = (header) => new Request(origin, { method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json", ...header },
    body: JSON.stringify({ revision: 0, requestId: crypto.randomUUID(), subject: "other", moduleId: "m2" }),
  });
  assert.equal((await api("submit", request({}))).status, 401);
  assert.equal(calls, 0);
  assert.equal((await api("submit", request({ Authorization: "Bearer " + "a".repeat(64) }))).status, 403);
  assert.equal(calls, 1);
});
