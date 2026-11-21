import { buildPsstDocument } from "./psst-document.mjs?v=coach-1";

const API="https://edeydaueyxilutczhazm.supabase.co/functions/v1/psst-lti/";
const byId=id=>document.getElementById(id);
const selector=byId("delivery-select");
const form=byId("teacher-rubric");
const rubric = {
  m1: ["Mapa productivo y procesos de trabajo","Tareas observadas y descripción de condiciones","Participación de trabajadores y contraste","Evidencias, horas y trazabilidad de campo"],
  m2: ["Vínculo entre procesos, tareas y hallazgos","Exposición, método y sustento de la valoración","Controles, medidas y prioridades","Evidencias y evaluaciones pendientes"],
  m3: ["Vínculo entre hallazgos, planes y actividades","Estructura del plan y enfoque de las actividades","Cronograma, responsables y recursos","Evidencias e indicadores de eficacia"],
  m4: ["Contenido de los ocho capítulos","Coherencia entre diagnóstico, planes y cronograma","Evidencias, instrumentos y anexos","Revisión, brechas y seguimiento"],
};
const moduleTitles={m1:"M1 · Procesos y tareas",m2:"M2 · Procesos peligrosos y riesgos",m3:"M3 · Planes y carta Gantt",m4:"M4 · Borrador del PSST"};
const keys={alcance:"Alcance",flujo:"Proceso productivo y procesos",tarea:"Tareas",mesa:"Participación",bitacora:"Bitácora",
  matriz:"Matriz",gantt:"Cronograma",validacion:"Validación",borrador:"Borrador",proyecto:"Proyecto"};
let session,current,busy=false,selection=0;
const title=key=>keys[key] ?? key.replace(/([a-z])([A-Z])/g,"$1 $2").replaceAll("_"," ").replace(/^./,letter=>letter.toUpperCase());
function el(tag,value) {
  const node=document.createElement(tag);
  if (value!==undefined) node.textContent=String(value);
  return node;
}
function status(message,kind="") {
  byId("teacher-status").textContent=message;
  byId("teacher-status").dataset.state=kind;
}
async function call(path,body) {
  const headers={"Content-Type":"application/json"};
  if(session) headers.Authorization="Bearer "+session;
  const response=await fetch(API+path,{method:"POST",headers,body:JSON.stringify(body),cache:"no-store",referrerPolicy:"no-referrer"});
  const payload=await response.json().catch(()=>null);
  if (!response.ok || !payload) throw new Error(payload?.error ?? "No se pudo contactar al Constructor.");
  return payload;
}
function showValue(value) {
  if (!value || typeof value!=="object") return el("p",value);
  const list=el("dl");
  for (const [key,item] of Object.entries(value)) {
    if (key==="id" || item===null || item==="" || (Array.isArray(item) && !item.length)) continue;
    const term=el("dt",Array.isArray(value) ? "Registro "+(Number(key)+1) : title(key));
    const description=el("dd");
    if (typeof item==="object") description.append(showValue(item));
    else description.textContent=String(item);
    list.append(term,description);
  }
  return list;
}
function scores() {
  return [...form.querySelectorAll("[data-score]")].map(input=>input.valueAsNumber);
}
function total() {
  if (!current) return;
  const values=scores();
  const technical=current.review?.technicalPoints ?? (values.length===4 && values.every(Number.isFinite) ? values.reduce((a,b)=>a+b,0) : null);
  byId("grade-total").textContent="Comprobación automática: "+current.automaticPoints+"/60. Revisión técnica: "+
    (technical===null?"pendiente":technical+"/40. Nota final: "+(current.automaticPoints+technical)+"/100.");
}
function display(detail) {
  current=detail;
  byId("teacher-detail").hidden=false;
  byId("delivery-title").textContent=detail.label;
  const when=new Intl.DateTimeFormat("es-VE",{dateStyle:"medium",timeStyle:"short",timeZone:"America/Caracas"}).format(new Date(detail.submittedAt));
  byId("delivery-info").textContent="Cuenta Moodle "+detail.submittedBy+" · Revisión "+detail.revision+" · "+when;
  byId("snapshot").replaceChildren(showValue(detail.snapshot));
  byId("auto-checks").replaceChildren(...Object.entries(detail.checks).map(([key,passed])=>el("li",title(key)+" · "+(passed?"Registrado":"Por completar"))));
  byId("previous-inputs").hidden=detail.moduleId!=="m4" || Boolean(detail.inputs);
  byId("download-review").hidden=detail.moduleId!=="m4";
  const targets=rubric[detail.moduleId].map((criterion,i)=>{
    const label=el("label",criterion), input=el("input");
    input.type="number";input.min="0";input.max="10";input.step="1";input.required=true;
    input.dataset.score=String(i);input.readOnly=Boolean(detail.review);
    input.value=detail.review?.scores?.[i] ?? "";
    label.append(input);
    return label;
  });
  byId("criteria").replaceChildren(...targets);
  form.elements.feedback.value=detail.review?.feedback ?? "";
  form.elements.feedback.readOnly=Boolean(detail.review);
  byId("review-save").hidden=Boolean(detail.review);
  const sent=detail.sync.filter(row=>row.state==="sent").length;
  const pending=detail.sync.length-sent;
  byId("review-publish").hidden=!detail.review || pending===0;
  byId("grade-sync").textContent=detail.review
    ? "Notas registradas en Moodle: "+sent+" de "+detail.sync.length+(pending ? ". Pendientes de confirmación: "+pending+"." : ".")
    : "La nota se publica después de guardar la rúbrica.";
  total();
}
async function selectDelivery() {
  const id=selector.value;
  const request=++selection;
  byId("teacher-detail").hidden=true;
  if(!id) return;
  status("Cargando la entrega…");
  try {
    const detail=await call("teacher",{action:"detail",id});
    if(request!==selection) return;
    display(detail);
    status("Entrega abierta.");
  } catch(error) { if(request===selection) status(error.message,"error"); }
}
async function act(action) {
  if (busy || !current) return;
  const id=current.id;
  busy=true;
  selector.disabled=true;
  byId("review-save").disabled=true;
  byId("review-publish").disabled=true;
  try {
    status(action==="save"?"Guardando la revisión…":"Publicando la nota…");
    const body=action==="save"?{action,id,scores:scores(),feedback:form.elements.feedback.value}:{action,id};
    const detail=await call("teacher",body);
    display(detail);
    const confirmed=detail.sync.length>0&&detail.sync.every(row=>row.state==="sent");
    status(action==="save"?"Revisión guardada. Ya puedes publicar la nota en Moodle.":
      confirmed?"Publicación confirmada por Moodle.":"Hay notas pendientes de confirmación. Puedes volver a consultar o reintentar.",
      action==="save"||confirmed?"success":"");
  } catch(error) { status(error.message,"error"); }
  finally {
    busy=false;
    selector.disabled=false;
    byId("review-save").disabled=false;
    byId("review-publish").disabled=false;
  }
}
function download() {
  if(!current || current.moduleId!=="m4") return;
  const html=buildPsstDocument({label:current.label,draft:current.snapshot,inputs:current.inputs??{}});
  const url=URL.createObjectURL(new Blob([html],{type:"text/html;charset=utf-8"}));
  const link=el("a");link.href=url;link.download="Entrega_PSST.html";
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
form.addEventListener("input",total);
form.addEventListener("submit",event=>{event.preventDefault();void act("save");});
byId("review-publish").addEventListener("click",()=>void act("publish"));
byId("download-review").addEventListener("click",download);
selector.addEventListener("change",()=>void selectDelivery());
async function start() {
  const ticket=new URLSearchParams(location.hash.slice(1)).get("ticket");
  if (location.hash) history.replaceState(null,"",location.pathname+location.search);
  if (!ticket) throw new Error("Abre esta actividad como docente desde Moodle.");
  ({session}=await call("teacher-exchange",{ticket}));
  const list=await call("teacher",{action:"list"});
  byId("module").textContent=moduleTitles[list.moduleId];
  byId("teacher-list").hidden=false;
  byId("empty").hidden=list.deliveries.length>0;
  selector.disabled=list.deliveries.length===0;
  selector.replaceChildren(new Option("Selecciona una entrega",""),...list.deliveries.map(item=>
    new Option(item.label+" · Cuenta "+item.submittedBy+" · "+(item.technicalPoints===null?"Por revisar":"Revisada"),item.id)));
  status(list.deliveries.length ? "Selecciona la entrega que quieres revisar." : "Aún no hay entregas.");
}
start().catch(error=>status(error.message,"error"));
