const rsa = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) };
function onlyPublic(key) {
  if (key?.kty !== "RSA" || typeof key.kid !== "string" || !key.kid ||
      typeof key.n !== "string" || key.n.length < 342 || key.e !== "AQAB") {
    throw new Error("No hay una llave pública de la herramienta");
  }
  return { kty: "RSA", kid: key.kid, n: key.n, e: key.e, alg: "RS256", use: "sig" };
}

export function createPublicKeyReader(rpc) {
  let pending;
  async function load() {
    const currentKey = await rpc("psst_lti_public_key", {});
    if (currentKey) return onlyPublic(currentKey);
    const pair = await crypto.subtle.generateKey(rsa, true, ["sign", "verify"]);
    const p_public = onlyPublic({ ...await crypto.subtle.exportKey("jwk", pair.publicKey), kid: crypto.randomUUID() });
    const p_private = await crypto.subtle.exportKey("jwk", pair.privateKey);
    return onlyPublic(await rpc("psst_lti_install_key", { p_public, p_private }));
  }
  return async () => {
    pending ??= load().catch(error => { pending = undefined; throw error; });
    return { keys: [await pending] };
  };
}
