import { checksLabels, rubrics } from "./psst-project.mjs?v=project-2";
import { wordFromReport } from "./psst-office.mjs?v=project-2";
import { buildPsstDocument } from "./psst-document.mjs?v=project-2";

const API="https://edeydaueyxilutczhazm.supabase.co/functions/v1/psst-lti/";
const byId=id=>document.getElementById(id);
const selector=byId("delivery-select");
const form=byId("teacher-rubric");
const moduleTitles={m1:"M1 · Procesos y tareas",m2:"M2 · Procesos peligrosos y riesgos",m3:"M3 · Planes y carta Gantt",m4:"M4 · Borrador del PSST"};
const keys={alcance:"Alcance",flujo:"Proceso productivo y procesos",tarea:"Tareas",mesa:"Participación",bitacora:"Bitácora",
  matriz:"Matriz",gantt:"Cronograma",validacion:"Validación",borrador:"Borrador",proyecto:"Proyecto"};
let session,current,busy=false,selection=0,deliveries=[];
let lastSaved="";
const labels={unreviewed:"Por revisar",draft:"Borrador docente",pending:"Pendiente en Moodle",sent:"Nota publicada"};
const title=key=>checksLabels[key] ?? keys[key] ?? key.replace(/([a-z])([A-Z])/g,"$1 $2").replaceAll("_"," ").replace(/^./,letter=>letter.toUpperCase());
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
  const edited=JSON.stringify([values,form.elements.feedback.value.trim()])!==lastSaved;
  if(current.reviewDraft && !current.review) {
    byId("review-publish").hidden=edited;
    byId("grade-sync").textContent=edited?"Guarda los cambios antes de publicar.":"Borrador guardado. Puedes corregirlo o publicar la nota.";
  }
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
  const targets=rubrics[detail.moduleId].map(([criterion,guide],i)=>{
    const label=el("label",criterion), input=el("input");
    input.type="number";input.min="0";input.max="10";input.step="1";input.required=true;
    input.dataset.score=String(i);input.readOnly=Boolean(detail.review);
    input.value=(detail.review??detail.reviewDraft)?.scores?.[i] ?? "";
    const help=el("small",guide);
    help.className="field-guide";
    help.id="criterion-"+i;
    input.setAttribute("aria-describedby",help.id);
    label.append(input,help);
    return label;
  });
  byId("criteria").replaceChildren(...targets);
  form.elements.feedback.value=(detail.review??detail.reviewDraft)?.feedback ?? "";
  lastSaved=JSON.stringify([scores(),form.elements.feedback.value.trim()]);
  form.elements.feedback.readOnly=Boolean(detail.review);
  byId("review-save").hidden=Boolean(detail.review);
  const sent=detail.sync.filter(row=>row.state==="sent").length;
  const pending=detail.sync.length-sent;
  byId("grade-verify").hidden=sent===0;
  byId("grade-verify-status").textContent="";
  byId("review-publish").hidden=detail.review ? pending===0 : !detail.reviewDraft;
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
    const entry=deliveries.find(row=>row.id===id);
    if(entry){
      entry.reviewState=detail.review?(detail.sync.every(row=>row.state==="sent")?"sent":"pending"):"draft";
      renderDeliveries(id);
    }
    const confirmed=detail.sync.length>0&&detail.sync.every(row=>row.state==="sent");
    status(action==="save"?"Borrador guardado. Puedes corregirlo antes de publicar la nota.":
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
  const html=buildPsstDocument({label:current.label,draft:current.snapshot,inputs:current.inputs??{},version:current.revision,submittedAt:current.submittedAt});
  const url=URL.createObjectURL(wordFromReport(html));
  const link=el("a");link.href=url;link.download="PSST_Entrega_R"+current.revision+".docx";
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
form.addEventListener("input",total);
form.addEventListener("submit",event=>{event.preventDefault();void act("save");});
byId("grade-verify").addEventListener("click",async()=>{
  if(!current||busy) return;
  const id=current.id, button=byId("grade-verify"), view=byId("grade-verify-status");
  button.disabled=true;
  view.textContent="Consultando la columna en Moodle…";
  try {
    const result=await call("teacher",{action:"verify",id});
    if(current?.id===id) view.textContent=result.unavailable?"Moodle no habilitó la lectura de estos resultados. Puedes verificarlos en el libro de calificaciones.":
      result.matched+" notas coinciden · "+result.different+" diferentes · "+result.missing+" sin resultado visible.";
  } catch(error){ if(current?.id===id) view.textContent=error.message; }
  finally { button.disabled=false; }
});
byId("review-publish").addEventListener("click",()=>void act("publish"));
byId("download-review").addEventListener("click",download);
selector.addEventListener("change",()=>void selectDelivery());
function renderDeliveries(selected=""){
  const state=byId("delivery-state").value;
  const term=byId("delivery-search").value.trim().toLocaleLowerCase("es");
  const currentState=item=>item.reviewState??(item.technicalPoints===null?"unreviewed":"pending");
  const matches=deliveries.filter(item=>(!state||state===currentState(item))&&
    (!term||(item.label+" "+item.submittedBy).toLocaleLowerCase("es").includes(term)));
  byId("teacher-counts").textContent=deliveries.length+" entregas · "+
    Object.entries(labels).filter(([key])=>deliveries.some(item=>currentState(item)===key))
      .map(([key,label])=>deliveries.filter(item=>currentState(item)===key).length+" "+label.toLocaleLowerCase("es")).join(" · ");
  byId("empty").textContent=deliveries.length?"Ninguna entrega coincide con el filtro.":"Aún no hay entregas en esta actividad.";
  byId("empty").hidden=matches.length>0;
  selector.disabled=busy||matches.length===0;
  selector.replaceChildren(new Option("Selecciona una entrega",""),...matches.map(item=>
    new Option(item.label+" · Cuenta "+item.submittedBy+" · "+labels[currentState(item)],item.id)));
  if(matches.some(item=>item.id===selected)) selector.value=selected;
}
for(const id of ["delivery-state","delivery-search"]) byId(id).addEventListener("input",()=>{
  if(busy) return;
  renderDeliveries(selector.value);
  if(!selector.value){ ++selection;current=undefined;byId("teacher-detail").hidden=true; }
});

async function start() {
  const ticket=new URLSearchParams(location.hash.slice(1)).get("ticket");
  if (location.hash) history.replaceState(null,"",location.pathname+location.search);
  if (!ticket) throw new Error("Abre esta actividad como docente desde Moodle.");
  ({session}=await call("teacher-exchange",{ticket}));
  const list=await call("teacher",{action:"list"});
  byId("module").textContent=moduleTitles[list.moduleId];
  byId("teacher-list").hidden=false;
  deliveries=list.deliveries;
  renderDeliveries();
  status(list.deliveries.length ? "Selecciona la entrega que quieres revisar." : "Aún no hay entregas.");
}
start().catch(error=>status(error.message,"error"));
