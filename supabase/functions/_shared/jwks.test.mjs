import assert from "node:assert/strict";
import { test } from "node:test";
import { createPublicKeyReader } from "./jwks.mjs";

test("initializes once, publishes a stable public key and keeps private fields server-side", async () => {
  let installs = 0, current;
  const algorithm = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" };
  const get = createPublicKeyReader(async (name, parameters) => {
    if (name === "psst_lti_public_key") return current ?? null;
    installs++;
    assert.equal(name, "psst_lti_install_key");
    const { p_private, p_public } = parameters;
    const privateKey = await crypto.subtle.importKey("jwk", p_private, algorithm, false, ["sign"]);
    const publicKey = await crypto.subtle.importKey("jwk", p_public, algorithm, false, ["verify"]);
    const data = Buffer.from("PSST LTI");
    const signature = await crypto.subtle.sign(algorithm, privateKey, data);
    assert.ok(await crypto.subtle.verify(algorithm, publicKey, signature, data));
    current = { ...p_public, d: "unexpected field from storage" };
    return current;
  });
  const [a,b] = await Promise.all([get(),get()]);
  assert.equal(installs,1);
  assert.deepEqual(a,b);
  assert.deepEqual(Object.keys(a.keys[0]).sort(), ["alg","e","kid","kty","n","use"]);
});
