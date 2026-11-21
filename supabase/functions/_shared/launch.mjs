import { createPilotRouter, course } from "./course-154.mjs";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const opaque = /^[a-f0-9]{64}$/;
const claim = "https://purl.imsglobal.org/spec/lti/claim/";
const cookieName = "__Host-psst_lti";
const limits = { login: 16_384, launch: 65_536, jwks: 32_768 };

function https(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.hash) {
    throw new TypeError("Se requiere una URL HTTPS de registro");
  }
  return url;
}

export function random() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
}

export async function digest(value) {
  const bytes = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}

function bytes(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) throw new Error("Codificación inválida");
  return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), ch => ch.charCodeAt(0));
}

export async function readText(message, maxBytes) {
  if (!message.body) return "";
  const reader = message.body.getReader();
  const output = new Uint8Array(maxBytes);
  let offset = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return decoder.decode(output.subarray(0, offset));
      if (offset + value.byteLength > maxBytes) throw new Error("Mensaje demasiado largo");
      output.set(value, offset);
      offset += value.byteLength;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}

async function requestParams(req, limit, allowGet = false) {
  if (allowGet && req.method === "GET") {
    const url = new URL(req.url);
    if (url.search.length > limit) throw new Error("Solicitud demasiado larga");
    return url.searchParams;
  }
  if (req.method !== "POST" ||
      req.headers.get("content-type")?.split(";")[0].toLowerCase() !== "application/x-www-form-urlencoded") {
    throw new Error("Formato inválido");
  }
  return new URLSearchParams(await readText(req, limit));
}

function value(params, key, limit = 4096, optional = false) {
  const values = params.getAll(key);
  if (optional && values.length === 0) return null;
  if (values.length !== 1 || !values[0].trim() || values[0].length > limit) throw new Error("Parámetro inválido");
  return values[0];
}

async function verifyToken(token, jwksUrl, get, now) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Token inválido");
  const header = JSON.parse(decoder.decode(bytes(parts[0])));
  if (header.alg !== "RS256" || typeof header.kid !== "string" || !header.kid || header.crit !== undefined) {
    throw new Error("Firma no admitida");
  }
  const response = await get(jwksUrl, { redirect: "error", signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("Llaves de Moodle no disponibles");
  const { keys } = JSON.parse(await readText(response, limits.jwks));
  if (!Array.isArray(keys)) throw new Error("Llaves inválidas");
  const candidates = keys.filter(k => k && k.kid === header.kid && k.kty === "RSA" &&
    (!k.use || k.use === "sig") && (!k.alg || k.alg === "RS256") && typeof k.n === "string" && typeof k.e === "string");
  if (candidates.length !== 1 || bytes(candidates[0].n).length < 256) throw new Error("Llave de firma inválida");
  const algorithm = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" };
  const key = await crypto.subtle.importKey("jwk", candidates[0], algorithm, false, ["verify"]);
  const valid = await crypto.subtle.verify(algorithm, key, bytes(parts[2]), encoder.encode(parts[0] + "." + parts[1]));
  if (!valid) throw new Error("Firma inválida");
  const claims = JSON.parse(decoder.decode(bytes(parts[1])));
  const time = Math.floor(now() / 1000);
  if (![claims.iat, claims.exp].every(Number.isSafeInteger) ||
      claims.exp <= claims.iat || claims.exp < time - 30 ||
      claims.iat < time - 330 || claims.iat > time + 30 ||
      (claims.nbf !== undefined && (!Number.isSafeInteger(claims.nbf) || claims.nbf > time + 30))) {
    throw new Error("Lanzamiento vencido");
  }
  return claims;
}

function headers(extra = {}) {
  return { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8",
    "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY", ...extra };
}

export function createLaunchHandler(config, { stateStore, get = fetch, now = Date.now, onVerified, onDiagnostic }) {
  https(config.issuer);
  const auth = https(config.authorizationUrl);
  const jwks = https(config.jwksUrl);
  const launchUrl = https(config.launchUrl);
  const loginUrl = https(config.loginUrl);
  const bootstrapUrl = https(config.bootstrapUrl);
  const continueUrl = new URL("./continue",loginUrl);
  if (!launchUrl.pathname.endsWith("/launch") || !loginUrl.pathname.endsWith("/login") || loginUrl.origin !== launchUrl.origin ||
      loginUrl.search || launchUrl.search) throw new TypeError("URLs de inicio y retorno incompatibles");
  const route = createPilotRouter(config);

  return async function handle(req) {
    const path = new URL(req.url).pathname;
    try {
      if (path === loginUrl.pathname || path === continueUrl.pathname) {
        const continuing=path===continueUrl.pathname;
        if(continuing && (req.method!=="POST" || req.headers.get("Origin")!==bootstrapUrl.origin))
          return new Response("Abre la actividad desde Moodle.",{status:403,headers:headers()});
        const p = await requestParams(req, limits.login, !continuing);
        const clientId = value(p, "client_id", 256, true);
        const deployment = value(p, "lti_deployment_id", 256, true);
        if (value(p, "iss", 1024) !== config.issuer || (clientId && clientId !== config.clientId) ||
            (deployment && deployment !== config.deploymentId) ||
            value(p, "target_link_uri", 2048) !== launchUrl.href) {
          return new Response("Registro LTI no reconocido.", { status: 403, headers: headers() });
        }
        const hint = value(p, "login_hint");
        const messageHint = value(p, "lti_message_hint", 8192, true);
        if(!continuing){
          const target=new URL(bootstrapUrl);
          const params=new URLSearchParams({iss:config.issuer,client_id:config.clientId,target_link_uri:launchUrl.href,
            lti_deployment_id:config.deploymentId,login_hint:hint});
          if(messageHint) params.set("lti_message_hint",messageHint);
          target.hash=params.toString();
          return new Response(null,{status:303,headers:headers({Location:target.href})});
        }
        const challenge=value(p,"psst_challenge",64);
        if(!opaque.test(challenge)) throw new Error("Comprobación del navegador inválida");
        const state = random();
        const browser = random();
        const nonce = random();
        await stateStore.create({ state_hash: await digest(state), browser_hash: await digest(browser), nonce, challenge });
        const redirect = new URL(auth);
        const parameters = { scope: "openid", response_type: "id_token", response_mode: "form_post",
          prompt: "none", client_id: config.clientId, redirect_uri: launchUrl.href, login_hint: hint, state, nonce };
        if (messageHint) parameters.lti_message_hint = messageHint;
        for (const [key, val] of Object.entries(parameters)) redirect.searchParams.set(key, val);
        return new Response(null, { status: 303, headers: headers({ Location: redirect.href,
          "Set-Cookie": cookieName + "=" + browser + "; Path=/; Secure; HttpOnly; SameSite=None; Max-Age=300" }) });
      }

      if (path === launchUrl.pathname) {
        const p = await requestParams(req, limits.launch);
        const state = value(p, "state", 64);
        const browser = req.headers.get("cookie")?.split(";").map(v => v.trim())
          .find(v => v.startsWith(cookieName + "="))?.slice(cookieName.length + 1);
        if (!opaque.test(state) || !browser || !opaque.test(browser)) throw new Error("Sesión inválida");
        const claims = await verifyToken(value(p, "id_token", 60_000), jwks, get, now);
        const resolved = route(claims);
        if (!resolved || claims[claim + "target_link_uri"] !== launchUrl.href ||
            typeof claims.nonce !== "string" || !opaque.test(claims.nonce)) {
          throw new Error("Actividad inválida");
        }
        const challenge = await stateStore.consume({
          p_state_hash: await digest(state), p_browser_hash: await digest(browser), p_nonce: claims.nonce,
        });
        if (typeof challenge!=="string" || !opaque.test(challenge)) throw new Error("Sesión vencida o usada");
        const clearCookie = cookieName + "=; Path=/; Secure; HttpOnly; SameSite=None; Max-Age=0";
        if (resolved.diagnostic === true) {
          const pruebaAGS = onDiagnostic ? await onDiagnostic(resolved) : null;
          return Response.json({
            mensaje: "Actividad del curso 154 verificada. Copia estos datos para completar el registro.",
            curso: resolved.contextId, actividad: resolved.title,
            idActividadLTI: resolved.resourceId, itemAGS: resolved.lineItem, ...(pruebaAGS ? { pruebaAGS } : {}),
          }, { headers: headers({ "Content-Type": "application/json; charset=utf-8", "Set-Cookie": clearCookie }) });
        }
        if (onVerified) {
          const location = await onVerified({ ...resolved, resourceId: claims[claim + "resource_link"].id, challenge });
          if (!location) return new Response("Tu cuenta todavía no tiene un equipo asignado para este curso.", {
            status: 403, headers: headers({ "Set-Cookie": clearCookie }),
          });
          return new Response(null, { status: 303, headers: headers({ Location: location, "Set-Cookie": clearCookie }) });
        }
        return new Response("Conexión LTI verificada · " + course.modules[resolved.moduleId], {
          headers: headers({ "Set-Cookie": clearCookie }),
        });
      }

      return new Response("Ruta no disponible.", { status: 404, headers: headers() });
    } catch {
      return new Response("No se pudo verificar el acceso desde Moodle. Abre la actividad nuevamente.",
        { status: 400, headers: headers() });
    }
  };
}
