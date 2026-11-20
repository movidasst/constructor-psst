import { digest, random, readText } from "./launch.mjs";

const tokenPattern = /^[a-f0-9]{64}$/;
const requestPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const operations = new Set(["exchange", "workspace", "draft", "submit"]);

export function createWorkspaceApi({ origin, rpc }) {
  return async function workspaceApi(operation, request) {
    if (!operations.has(operation)) return new Response(null, { status: 404 });
    if (request.headers.get("Origin") !== origin) return new Response(null, { status: 403 });
    const headers = { "Access-Control-Allow-Origin": origin, Vary: "Origin", "Cache-Control": "no-store" };
    const json = (body, status = 200) => Response.json(body, { headers, status });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: {
      ...headers, "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Max-Age": "600",
    } });

    if (request.method !== (operation === "workspace" ? "GET" : "POST")) {
      return json({ error: "Método no permitido." }, 405);
    }
    let body;
    if (request.method === "POST") {
      if (request.headers.get("content-type")?.split(";")[0] !== "application/json") {
        return json({ error: "Formato de datos inválido." }, 415);
      }
      try {
        body = JSON.parse(await readText(request, operation === "draft" ? 270_000 : 8192));
        if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Objeto requerido");
      } catch {
        return json({ error: "Solicitud inválida o demasiado grande." }, 400);
      }
    }
    try {
      if (operation === "exchange") {
        if (typeof body.ticket !== "string" || !tokenPattern.test(body.ticket)) return json({ error: "Ingreso inválido." }, 400);
        const session = random();
        const success = await rpc("psst_lti_exchange", { p_ticket_hash: await digest(body.ticket), p_session_hash: await digest(session) });
        return success === true ? json({ session }) : json({ error: "Vuelve a abrir la actividad en Moodle." }, 401);
      }

      const token = request.headers.get("Authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
      if (!token) return json({ error: "Vuelve a abrir la actividad en Moodle." }, 401);
      const p_hash = await digest(token);
      let result;
      if (operation === "workspace") {
        result = await rpc("psst_lti_workspace", { p_hash });
      } else {
        if (!Number.isSafeInteger(body.revision) || body.revision < 0 || body.revision > 2147483647) {
          return json({ error: "Revisión inválida." }, 400);
        }
        if (operation === "draft") {
          if (!body.draft || typeof body.draft !== "object" || Array.isArray(body.draft)) {
            return json({ error: "Borrador inválido." }, 400);
          }
          result = await rpc("psst_lti_save_activity", { p_hash, p_revision: body.revision, p_draft: body.draft });
          if (Number.isInteger(result)) result = { revision: result };
        } else {
          if (typeof body.requestId !== "string" || !requestPattern.test(body.requestId)) {
            return json({ error: "Identificador de entrega inválido." }, 400);
          }
          result = await rpc("psst_lti_submit_activity", { p_hash, p_revision: body.revision, p_request: body.requestId });
        }
      }
      return result === null ? json({ error: "La sesión venció o la actividad no está disponible." }, 403) : json(result);
    } catch (error) {
      if (error instanceof Error && error.message === "P0001") {
        return json({ error: "El borrador cambió. Vuelve a abrirlo antes de intentar nuevamente." }, 409);
      }
      if (error instanceof Error && error.message === "22023") {
        return json({ error: "Identifica la etapa e incluye al menos una entrada en la matriz antes de entregar." }, 422);
      }
      return json({ error: "No se pudo completar la operación. Inténtalo más tarde." }, 503);
    }
  };
}
