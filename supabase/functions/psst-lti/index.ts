import { createLaunchHandler } from "../_shared/launch.mjs";

const settings = Deno.env.get("PSST_LTI_REGISTRATION");
const supabase = Deno.env.get("SUPABASE_URL");
const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const serviceBase = supabase ? new URL("/functions/v1/psst-lti/", supabase) : undefined;

async function rpc(name: string, body: object) {
  const response = await fetch(new URL("/rest/v1/rpc/" + name, supabase), {
    method: "POST",
    headers: { apikey: secret!, Authorization: "Bearer " + secret, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("No se pudo guardar el estado LTI");
  return response;
}

function configuredHandler() {
  if (!settings || !serviceBase || !secret) return null;
  try {
    return createLaunchHandler({
      ...JSON.parse(settings),
      loginUrl: new URL("login", serviceBase).href,
      launchUrl: new URL("launch", serviceBase).href,
    }, {
      stateStore: {
        create: async ({ state_hash, browser_hash, nonce }: Record<string, string>) => {
          await (await rpc("psst_lti_begin", { p_state_hash: state_hash, p_browser_hash: browser_hash, p_nonce: nonce })).body?.cancel();
        },
        consume: async (params: object) => (await (await rpc("psst_lti_consume", params)).json()) === true,
      },
    });
  } catch {
    return null;
  }
}

const handler = configuredHandler();
Deno.serve((req: Request) => {
  if (!handler || !serviceBase) {
    return new Response("La conexión con Moodle todavía no está habilitada.", {
      status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  const path = new URL(req.url).pathname;
  if (path === "/psst-lti/login" || path === "/psst-lti/launch") {
    return handler(new Request(new URL(path.endsWith("/login") ? "login" : "launch", serviceBase).href +
      new URL(req.url).search, req));
  }
  return handler(req);
});
