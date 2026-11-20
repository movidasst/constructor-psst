const scoreScope = "https://purl.imsglobal.org/spec/lti-ags/scope/score";
const assertionType = "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";
const algorithm = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" };
const encoder = new TextEncoder();

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
const jsonPart = value => base64url(encoder.encode(JSON.stringify(value)));

function platformUrl(value, origin) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.origin !== origin || url.username || url.password || url.hash) {
    throw new TypeError("URL fuera de la plataforma Moodle registrada");
  }
  return url;
}

// Only the server calls this sender. The line item and subject must come from
// the registered activity and the frozen submission's grade recipient.
export function createAgsSender(config, { request = fetch, now = Date.now } = {}) {
  const issuer = new URL(config.issuer);
  const tokenUrl = platformUrl(config.tokenUrl, issuer.origin);
  const audience = config.tokenAudience ?? tokenUrl.href;
  const signer = config.privateKey;
  if (!config.clientId || !config.keyId || signer?.type !== "private" ||
      signer.algorithm?.name !== algorithm.name || signer.algorithm.hash?.name !== algorithm.hash ||
      signer.algorithm.modulusLength < 2048 || !signer.usages.includes("sign")) {
    throw new TypeError("Llave o registro AGS incompleto");
  }

  return async ({ lineItemUrl, subject, score, timestamp }) => {
    const destination = platformUrl(lineItemUrl, issuer.origin);
    if (!/\/mod\/lti\/services\.php\/[^/]+\/lineitems\/[^/]+\/lineitem\/?$/.test(destination.pathname) ||
        typeof subject !== "string" || !subject.trim() || !Number.isInteger(score) || score < 0 || score > 100 ||
        typeof timestamp !== "string" || !Number.isFinite(Date.parse(timestamp))) {
      throw new TypeError("Resultado AGS inválido");
    }
    destination.pathname = destination.pathname.replace(/\/$/, "") + "/scores";

    const epoch = Math.floor(now() / 1000);
    const payload = jsonPart({ alg: "RS256", typ: "JWT", kid: config.keyId }) + "." +
      jsonPart({ iss: config.clientId, sub: config.clientId, aud: audience,
        iat: epoch, exp: epoch + 120, jti: crypto.randomUUID() });
    const signature = await crypto.subtle.sign(algorithm, signer, encoder.encode(payload));
    const assertion = payload + "." + base64url(new Uint8Array(signature));
    const auth = await request(tokenUrl, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(6000),
      body: new URLSearchParams({ grant_type: "client_credentials", client_assertion_type: assertionType,
        client_assertion: assertion, scope: scoreScope }),
    });
    if (!auth.ok) {
      await auth.body?.cancel();
      return { sent: false, phase: "token", status: auth.status };
    }
    const token = await auth.json();
    if (typeof token.access_token !== "string" || !token.access_token || token.token_type?.toLowerCase() !== "bearer") {
      return { sent: false, phase: "token", status: auth.status };
    }
    if (typeof token.scope === "string" && !token.scope.split(/\s+/).includes(scoreScope)) {
      return { sent: false, phase: "scope", status: 403 };
    }

    const result = await request(destination, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(6000),
      headers: { Authorization: "Bearer " + token.access_token, "Content-Type": "application/vnd.ims.lis.v1.score+json" },
      body: JSON.stringify({ userId: subject, scoreGiven: score, scoreMaximum: 100,
        timestamp: new Date(timestamp).toISOString(), activityProgress: "Completed", gradingProgress: "FullyGraded" }),
    });
    await result.body?.cancel();
    return { sent: result.ok, phase: "score", status: result.status };
  };
}
