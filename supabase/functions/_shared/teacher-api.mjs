import { digest, random, readText } from "./launch.mjs";

const teacherToken = /^[a-f0-9]{64}$/;
const deliveryId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const teacherActions = new Set(["list","detail","save","publish","verify"]);

export function createTeacherApi({ origin, rpc, getSender }) {
  return async function teacherApi(route, request) {
    if (request.headers.get("Origin") !== origin) return new Response(null,{status:403});
    const headers={"Access-Control-Allow-Origin":origin,Vary:"Origin","Cache-Control":"no-store"};
    const json=(data,status=200)=>Response.json(data,{headers,status});
    if (request.method==="OPTIONS") return new Response(null,{status:204,headers:{
      ...headers,"Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"Authorization, Content-Type",
    }});
    if (request.method!=="POST") return json({error:"Método no permitido."},405);
    if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return json({error:"Formato inválido."},415);
    let body;
    try { body=JSON.parse(await readText(request,24000)); }
    catch { return json({error:"Solicitud inválida."},400); }
    if (!body || typeof body!=="object" || Array.isArray(body)) return json({error:"Solicitud inválida."},400);
    try {
      if (route==="teacher-exchange") {
        if (typeof body.ticket!=="string" || !teacherToken.test(body.ticket) ||
            typeof body.proof!=="string" || !teacherToken.test(body.proof)) return json({error:"Vuelve a abrir el módulo docente en esta pestaña."},400);
        const session=random();
        const ok=await rpc("psst_lti_exchange_bound",{p_ticket_hash:await digest(body.ticket),p_challenge:await digest(body.proof),
          p_session_hash:await digest(session),p_teacher:true});
        return ok ? json({session}) : json({error:"Vuelve a abrir el módulo como docente en Moodle."},401);
      }
      const session=request.headers.get("Authorization")?.match(/^Bearer ([0-9a-f]{64})$/)?.[1];
      if (!session) return json({error:"Vuelve a abrir el módulo como docente en Moodle."},401);
      const {action,id,scores,feedback}=body;
      if (!teacherActions.has(action) || (action!=="list" && (typeof id!=="string" || !deliveryId.test(id))))
        return json({error:"Acción o entrega inválida."},400);
      if (action==="save" && (!Array.isArray(scores) || scores.length!==4 ||
        !scores.every(score=>Number.isInteger(score)&&score>=0&&score<=10) ||
        typeof feedback!=="string" || !feedback.trim() || feedback.trim().length>4000))
        return json({error:"Completa los cuatro criterios de 0 a 10 y la retroalimentación."},422);

      const params={p_hash:await digest(session),p_action:action==="publish"?"claim":action==="verify"?"read_results":action};
      if (action!=="list") params.p_delivery=id;
      if (action==="save") Object.assign(params,{p_scores:scores,p_feedback:feedback.trim()});
      const result=await rpc("psst_lti_teacher",params);
      if (!result) return json({error:"Sesión docente vencida o entrega fuera de esta actividad."},403);
      if(action==="verify"){
        const sender=await getSender();
        const reported=await Promise.all(result.grades.map(async grade=>{
          try { return await sender.readResult({lineItemUrl:result.lineItem,subject:grade.subject,score:grade.score}); }
          catch { return "unavailable"; }
        }));
        return json({matched:reported.filter(s=>s==="matched").length,missing:reported.filter(s=>s==="missing").length,
          different:reported.filter(s=>s==="different").length,unavailable:reported.filter(s=>s==="unavailable").length});
      }
      if (action!=="publish") return json(result);

      if (result.grades.length) {
        let sender;
        try { sender=await getSender(); } catch { /* Keep every claimed grade eligible for retry. */ }
        await Promise.all(result.grades.map(async grade=>{
          let status=null,sent=false;
          try {
            if (sender) {
              const delivery=await sender({lineItemUrl:result.lineItem,subject:grade.subject,score:grade.score,timestamp:grade.timestamp});
              status=delivery.status;
              sent=delivery.sent;
            }
          } catch { /* Preserve the recorded review and mark the attempt for retry. */ }
          await rpc("psst_lti_finish_review_pilot",{p_dispatch:grade.dispatch,p_sent:sent,p_http:status});
        }));
      }
      const detail=await rpc("psst_lti_teacher",{...params,p_action:"detail"});
      return detail ? json(detail) : json({error:"Vuelve a abrir el módulo para comprobar el estado."},403);
    } catch(error) {
      return error.message==="22023"
        ? json({error:"Revisa que sea la entrega más reciente y que la rúbrica esté completa."},409)
        : json({error:"No se pudo confirmar la operación. Vuelve a abrir la entrega para consultar su estado."},503);
    }
  };
}
