import assert from "node:assert/strict";
import { test } from "node:test";
import { createLaunchHandler } from "./launch.mjs";

const prefix = "https://purl.imsglobal.org/spec/lti/claim/";
const config = {
  issuer: "https://moodle.example", authorizationUrl: "https://moodle.example/auth",
  jwksUrl: "https://moodle.example/jwks", loginUrl: "https://tool.example/login",
  launchUrl: "https://tool.example/launch", clientId: "client", deploymentId: "deployment",
  contextId: "course-154-context", resourceLinks: { m1: "r1", m2: "r2", m3: "r3", m4: "r4" },
};
const time = 1_800_000_000;
const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const algo = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) };
const key = await crypto.subtle.generateKey(algo, true, ["sign", "verify"]);
const publicKey = { ...await crypto.subtle.exportKey("jwk", key.publicKey), kid: "test-key" };

async function signed(claims) {
  const content = encode({ alg: "RS256", kid: "test-key" }) + "." + encode(claims);
  const signature = await crypto.subtle.sign(algo, key.privateKey, Buffer.from(content));
  return content + "." + Buffer.from(signature).toString("base64url");
}

const baseClaims = {
  iss: config.issuer, aud: config.clientId, sub: "test-user", iat: time, exp: time + 180,
  [prefix + "deployment_id"]: config.deploymentId, [prefix + "context"]: { id: config.contextId },
  [prefix + "message_type"]: "LtiResourceLinkRequest", [prefix + "version"]: "1.3.0",
  [prefix + "target_link_uri"]: config.launchUrl, [prefix + "resource_link"]: { id: "r3" },
};

async function fixture() {
  const states = new Map();
  const handle = createLaunchHandler(config, {
    now: () => time * 1000, get: async () => Response.json({ keys: [publicKey] }),
    stateStore: {
      async create(row) { states.set(row.state_hash, row); },
      async consume(args) {
        const row = states.get(args.p_state_hash);
        if (row?.nonce !== args.p_nonce || row?.browser_hash !== args.p_browser_hash) return false;
        return states.delete(args.p_state_hash);
      },
    },
  });
  const q = new URLSearchParams({ iss: config.issuer, login_hint: "login", target_link_uri: config.launchUrl });
  const start = await handle(new Request(config.loginUrl + "?" + q));
  assert.equal(start.status, 303);
  const redirect = new URL(start.headers.get("Location"));
  const cookie = start.headers.get("Set-Cookie").split(";")[0];
  assert.equal(redirect.searchParams.get("response_mode"), "form_post");
  const claims = { ...baseClaims, nonce: redirect.searchParams.get("nonce") };

  return {
    claims, handle,
    async launch(idToken, browserCookie = cookie) {
      return handle(new Request(config.launchUrl, {
        method: "POST", headers: { cookie: browserCookie },
        body: new URLSearchParams({ state: redirect.searchParams.get("state"), id_token: idToken }),
      }));
    },
  };
}

test("verifies a signed launch to the assigned activity and consumes the request once", async () => {
  const f = await fixture();
  const token = await signed(f.claims);
  const answer = await f.launch(token);
  assert.equal(answer.status, 200);
  assert.match(await answer.text(), /carta Gantt 2027/);
  assert.equal((await f.launch(token)).status, 400);
});

test("rejects cross-browser, invalid signature, wrong course, wrong nonce and expired launch", async () => {
  const f = await fixture();
  const token = await signed(f.claims);
  assert.equal((await f.launch(token, "__Host-psst_lti=" + "0".repeat(64))).status, 400);
  const [head, payload, signature] = token.split(".");
  assert.equal((await f.launch(head + "." + payload + "." + (signature[0] === "A" ? "B" : "A") + signature.slice(1))).status, 400);
  assert.equal((await f.launch(await signed({ ...f.claims, [prefix + "context"]: { id: "other-course" } }))).status, 400);
  assert.equal((await f.launch(await signed({ ...f.claims, nonce: "0".repeat(64) }))).status, 400);
  assert.equal((await f.launch(await signed({ ...f.claims, iat: time - 240, exp: time - 120 }))).status, 400);
  assert.equal((await f.launch(token)).status, 200);
});
