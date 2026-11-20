import { createLaunchHandler, digest, random } from "../_shared/launch.mjs";
import { createWorkspaceApi } from "../_shared/workspace.mjs";

const settings = Deno.env.get("PSST_LTI_REGISTRATION");
const supabase = Deno.env.get("SUPABASE_URL");
const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const serviceBase = supabase ? new URL("/functions/v1/psst-lti/", supabase) : undefined;

async function rpc(name, body) {
  const response = await fetch(new URL("/rest/v1/rpc/" + name, supabase), {
    method: "POST",
    headers: { apikey: secret, Authorization: "Bearer " + secret, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new Error(problem?.code === "P0001" ? "P0001" : "Datos LTI no disponibles");
  }
  if (name === "psst_lti_begin") {
    await response.body?.cancel();
    return null;
  }
  return response.json();
}

function configuredServices() {
  if (!settings || !serviceBase || !secret) return null;
  try {
    const config = JSON.parse(settings);
    const app = new URL(config.appUrl ?? "https://constructor.movidasst.com/lti.html");
    if (app.protocol !== "https:" || app.username || app.password || app.hash || app.search) return null;
    if (app.origin !== "https://constructor.movidasst.com" &&
        !(app.origin === "https://movidasst.github.io" && app.pathname === "/constructor-psst/lti.html")) return null;
    const launch = createLaunchHandler({
      ...config,
      loginUrl: new URL("login", serviceBase).href,
      launchUrl: new URL("launch", serviceBase).href,
    }, {
      stateStore: {
        create: async ({ state_hash, browser_hash, nonce }) =>
          rpc("psst_lti_begin", { p_state_hash: state_hash, p_browser_hash: browser_hash, p_nonce: nonce }),
        consume: async (params) => (await rpc("psst_lti_consume", params)) === true,
      },
      onVerified: async (session) => {
        const ticket = random();
        const allowed = await rpc("psst_lti_ticket", {
          p_hash: await digest(ticket), p_issuer: config.issuer, p_client: config.clientId,
          p_deployment: config.deploymentId, p_context: session.contextId, p_subject: session.subject,
          p_module: session.moduleId, p_resource: session.resourceId,
        });
        if (allowed !== true) return null;
        const url = new URL(app);
        url.hash = new URLSearchParams({ ticket }).toString();
        return url.href;
      },
    });
    return { launch, workspace: createWorkspaceApi({ origin: app.origin, rpc }) };
  } catch {
    return null;
  }
}

function publicKeys() {
  try {
    const key = JSON.parse(Deno.env.get("PSST_LTI_AGS_PUBLIC_JWK") ?? "null");
    if (key?.kty !== "RSA" || typeof key.kid !== "string" || !key.kid ||
        typeof key.n !== "string" || typeof key.e !== "string") return null;
    return { keys: [{ kty: "RSA", kid: key.kid, n: key.n, e: key.e, alg: "RS256", use: "sig" }] };
  } catch {
    return null;
  }
}

const services = configuredServices();
Deno.serve((req) => {
  const url = new URL(req.url);
  const route = url.pathname.match(/^(?:\/functions\/v1)?\/psst-lti\/(login|launch|jwks|exchange|workspace|draft|submit)$/)?.[1];
  if (route === "jwks" && req.method === "GET") {
    const keys = publicKeys();
    return keys
      ? Response.json(keys, { headers: { "Cache-Control": "public, max-age=300" } })
      : Response.json({ error: "Llave de la herramienta pendiente." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (!route || route === "jwks") return new Response("Ruta no disponible.", { status: 404 });
  if (!services || !serviceBase) {
    return new Response("La conexión con Moodle todavía no está habilitada.", {
      status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  if (route === "login" || route === "launch") {
    const canonical = new URL(route, serviceBase);
    canonical.search = url.search;
    return services.launch(url.pathname === canonical.pathname ? req : new Request(canonical.href, req));
  }
  return services.workspace(route, req);
});
