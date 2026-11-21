import { createCoachingService } from "../_shared/coach-api.mjs";
import { createTeacherApi } from "../_shared/teacher-api.mjs";
import { course } from "../_shared/course-154.mjs";
import { createLaunchHandler, digest, random } from "../_shared/launch.mjs";
import { createWorkspaceApi } from "../_shared/workspace.mjs";
import { createPublicKeyReader } from "../_shared/jwks.mjs";
import { createAgsSender } from "../_shared/ags.mjs";
import { checkOrDispatchGradeTest } from "../_shared/grade-test.mjs";
import { dispatchReviewedPilot } from "../_shared/review-grade.mjs";

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
    throw new Error(["P0001", "22023"].includes(problem?.code) ? problem.code : "Datos LTI no disponibles");
  }
  if (name === "psst_lti_begin") {
    await response.body?.cancel();
    return null;
  }
  return response.json();
}

async function configuredServices() {
  if (!serviceBase || !secret) return null;
  try {
    const config = settings ? JSON.parse(settings) : await rpc("psst_lti_registration", {});
    if (!config) return null;
    const app = new URL(config.appUrl ?? "https://constructor.movidasst.com/lti.html");
    if (app.protocol !== "https:" || app.username || app.password || app.hash || app.search) return null;
    if (app.origin !== "https://constructor.movidasst.com" &&
        !(app.origin === "https://movidasst.github.io" && app.pathname === "/constructor-psst/lti.html")) return null;
    async function getSender() {
      await publicKeys();
      const material = await rpc("psst_lti_signing_material", {});
      if (!material) throw new Error("Llave no disponible");
      const privateKey = await crypto.subtle.importKey("jwk", material.privateJwk,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
      return createAgsSender({ issuer:config.issuer, tokenUrl:config.tokenUrl,
        clientId:config.clientId, keyId:material.kid, privateKey });
    }
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
      onDiagnostic: async (activity) => {
        const moduleId = Object.keys(course.modules).find(id =>
          config.resourceLinks?.[id] === activity.resourceId && config.lineItems?.[id] === activity.lineItem);
        if (!moduleId || !activity.lineItem) return null;
        try {
          const sender = await getSender();
          const reviewed = await dispatchReviewedPilot({ rpc, sender, activity });
          if (reviewed) return reviewed;
          return await checkOrDispatchGradeTest({ rpc, sender, activity, connectionTest: moduleId !== "m1" });
        } catch {
          return { autorizado: false, fase: "conexion" };
        }
      },
      onVerified: async (session) => {
        const ticket = random();
        const allowed = await rpc(session.teacher ? "psst_lti_teacher_ticket"
          : session.enroll ? "psst_lti_enroll" : "psst_lti_ticket", {
          p_hash: await digest(ticket), p_issuer: config.issuer, p_client: config.clientId,
          p_deployment: config.deploymentId, p_context: session.contextId, p_subject: session.subject,
          p_module: session.moduleId, p_resource: session.resourceId,
          ...(session.teacher ? { p_line_item:session.lineItem } : {}),
        });
        if (allowed !== true) return null;
        const url = session.teacher ? new URL("./lti-teacher.html",app) : new URL(app);
        url.hash = new URLSearchParams({ ticket }).toString();
        return url.href;
      },
    });
    return { launch, workspace: createWorkspaceApi({ origin: app.origin, rpc,
      coach:createCoachingService({rpc,key:Deno.env.get("PSST_GEMINI_KEY")??Deno.env.get("GEMINI_API_KEY"),
        model:Deno.env.get("PSST_GEMINI_MODEL")??"gemini-2.5-flash"}) }),
      teacher:createTeacherApi({origin:app.origin,rpc,getSender}) };
  } catch {
    return null;
  }
}

const publicKeys = createPublicKeyReader(rpc);

let currentConfig;
let loadedUntil = 0;
function servicesForRequest() {
  if (!currentConfig || Date.now() >= loadedUntil) {
    loadedUntil = Date.now() + 15_000;
    currentConfig = configuredServices();
  }
  return currentConfig;
}
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const route = url.pathname.match(/^(?:\/functions\/v1)?\/psst-lti\/(login|launch|jwks|exchange|workspace|archive|draft|submit|coach|teacher-exchange|teacher)$/)?.[1];
  if (route === "jwks" && req.method === "GET") {
    try {
      if (!supabase || !secret) throw new Error("Servicio no configurado");
      return Response.json(await publicKeys(), { headers: { "Cache-Control": "public, max-age=300" } });
    } catch {
      return Response.json({ error: "Llave pública no disponible." },
        { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }
  if (!route || route === "jwks") return new Response("Ruta no disponible.", { status: 404 });
  const services = await servicesForRequest();
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
  if (route === "teacher-exchange" || route === "teacher") return services.teacher(route,req);
  return services.workspace(route, req);
});
