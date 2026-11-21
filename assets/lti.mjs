import { checksLabels, changedSources, modules, projectState, rubrics, technicalPrompts, workTrace } from "./psst-project.mjs?v=project-2";
import { excelGantt, wordFromReport } from "./psst-office.mjs?v=project-2";
import { approaches, chapterTemplates, coherenceIssues, familyTemplates, investigationTemplates, outline, sources, trainingHours } from "./psst-coach.mjs?v=project-2";
import { draftReadiness, planGuides, projectFields, recordRefs, schedule, statuses } from "./psst-program.mjs?v=coach-1";
import { buildGanttDocument, buildPsstDocument, scheduledActivities } from "./psst-document.mjs?v=project-2";
import { reviewGroups } from "./psst-review.mjs?v=linked-1";
import { annexStructure, chapterKey, chapterStructure } from "./psst-chapters.mjs?v=program-1";

const apiRoot = "https://edeydaueyxilutczhazm.supabase.co/functions/v1/psst-lti/";
const status = document.getElementById("status");
const startup = document.getElementById("startup");
const form = document.getElementById("draft");
const deliver = document.getElementById("deliver");
const receipt = document.getElementById("receipt");
const ticket = new URLSearchParams(location.hash.slice(1)).get("ticket");
if (location.hash) history.replaceState(null, "", location.pathname + location.search);

let session;
let revision;
let draft;
let savedValues;
let lastDelivery;
let pending;
let busy = false;
let projectInfo;
let recoveryKey;
let autosaveTimer;
let conflict = false;
let deliveredArchive;
let rememberedRisks;

const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const rowSchemas = {
  productivos: {group:"flujo",key:"productivos",singular:"Flujo productivo o de servicio",fields:[
    ["codigo","Código del flujo",true],["nombre","Bien o servicio y nombre del flujo",true],
    ["entradas","Entradas e insumos"],["secuencia","Secuencia de etapas e interfaces",true],
    ["salidas","Resultados y salidas"],["evidencia","Referencia al diagrama de flujo"],
  ]},
  objetivos: {group:"m4",key:"objetivos",singular:"Objetivo específico",fields:[
    ["codigo","Código del objetivo",true],["nombre","Resultado que se busca",true],
    ["planRef","Plan relacionado",false,"planesEntregados"],["indicadorRef","Indicador de seguimiento",false,"indicadores"],
  ]},
  contratistas: {group:"m4",key:"contratistas",singular:"Obra o servicio de terceros",fields:[
    ["nombre","Obra o servicio",true],["parte","Parte contratante o contratista"],["procesos","Procesos y áreas que comparten"],
    ["riesgoRef","Hallazgo registrado en M2",false,"riesgos"],["controles","Coordinación y controles de la interacción"],
    ["responsable","Responsable de verificar"],["evidencia","Soporte y estado"],
  ]},
  indicadores: {group:"m4",key:"indicadores",singular:"Indicador",fields:[
    ["codigo","Código",true],["nombre","Indicador",true],["planRef","Plan o actividad que se evalúa",false,"planesEntregados"],
    ["formula","Fórmula o criterio de evaluación",true],["base","Línea base y fecha"],["meta","Meta y unidad",true],
    ["fuente","Fuente de datos",true],["frecuencia","Periodicidad",true],["responsable","Responsable",true],
    ["respuesta","Qué hacer si hay desviación"],
  ]},
  anexos: {group:"m4",key:"soportes",singular:"Anexo",fields:[
    ["codigo","Código",true],["nombre","Documento o evidencia",true],["capitulo","Capítulo o código al que respalda"],
    ["version","Versión y fecha"],["ubicacion","Ubicación o referencia"],["estado","Estado del soporte",false,"soportes"],
    ["responsable","Responsable de completarlo"],["custodio","Custodio y personas autorizadas"],
    ["revisionAcceso","Fecha de revisión del acceso",false,"verification-date"],
  ]},
  procesos: { group:"flujo", key:"procesos", singular:"Proceso", fields:[
    ["codigo","Código (p. ej., P-01)",true], ["nombre","Nombre del proceso de trabajo",true],
    ["productivoRef","Flujo productivo o de servicio",true,"productivos"], ["area","Área o departamento"], ["entradas","Entradas, materiales y sustancias"],
    ["secuencia","Etapas y organización del trabajo"], ["salidas","Productos, residuos y disposición"],
    ["contratistas","Contratistas e interacciones"], ["evidencia","Diagrama, croquis u otra evidencia"],
  ] },
  campo: { group:"bitacora", key:"registros", singular:"Actividad de campo", fields:[
    ["fecha","Fecha",true,"verification-date"],["actividad","Actividad realizada",true],["horas","Horas registradas",true,"hours"],
    ["tareaRef","Tarea observada",false,"tareasPropias"],["tipo","Fuente o método",false,"tiposEvidencia"],
    ["evidencia","Código o referencia privada de la evidencia",true],
  ] },
  verificacion: { group:"m2", key:"verificaciones", singular:"Revisión de tarea", fields:[
    ["tareaRef","Tarea inventariada",true,"tareas"],["estado","Estado de la tarea",true,"estadosTarea"],
    ["evidencia","Fuente o referencia privada"],["justificacion","Justificación y alcance de la revisión",true],
    ["responsable","Responsable de verificar"],["fecha","Fecha prevista",false,"verification-date"],
  ] },
  tareas: { group:"tarea", key:"actividades", singular:"Tarea", fields:[
    ["codigo","Código (p. ej., T-01)",true], ["procesoRef","Proceso del inventario",true,"procesos"],
    ["etapa","Etapa",true], ["nombre","Tarea observada",true], ["descripcion","Secuencia real de la tarea",true],
    ["puestos","Puestos y personal expuesto"], ["medios","Herramientas, equipos y objetos"],
    ["organizacion","Turnos, ritmo y organización"], ["evidencia","Fuente o evidencia"],
    ["observacion","Observación directa"], ["consulta","Aporte del personal consultado"], ["contraste","Diferencias y aspectos por confirmar"],
  ] },
  planes: { group:"m3", key:"planesDetallados", singular:"Plan", fields:[
    ["codigo","Código del plan",true], ["nombre","Nombre del plan",true],
    ["familia","Familia de plan",true,"familias"], ["riesgoRefs","Hallazgos vinculados",false,"riesgos-multiple"],
    ["detalleFamilia","Desarrollo específico de la familia"],
    ["objetivo","Objetivo",true], ["meta","Meta verificable",true], ["alcance","Alcance",true],
    ["frecuencia","Frecuencia",true], ["responsable","Personal y responsabilidades",true],
    ["procedimiento","Procedimiento de ejecución",true], ["instrumentos","Formularios e instrumentos",true],
    ["recursos","Recursos y presupuesto",true], ["seguimiento","Indicador o evidencia",true],
  ] },
  m2: { group:"m2", key:"filas", singular: "Riesgo", fields: [
    ["codigo","Código del hallazgo (p. ej., R-01)",true], ["tareaRef","Tarea registrada en M1",false,"tareas"],
    ["proceso","Proceso peligroso asociado"],
    ["prioridad","Prioridad de actuación",false,"prioridades"],
    ["etapa","Etapa o tarea",true], ["peligro","Peligro o condición observada",true],
    ["riesgo","Riesgo y posible consecuencia",true], ["expuestos","Personas o puestos expuestos"],
    ["controles","Controles existentes"], ["valoracion","Valoración según el método elegido"],
    ["evidencia","Referencia de la evidencia"], ["pendiente","Dato o medición que falta"],
    ["estadoEvaluacion","Estado de la evaluación",false,"evaluaciones"], ["responsableEvaluacion","Responsable de verificar"],
    ["fechaEvaluacion","Fecha prevista de verificación",false,"verification-date"],
    ["controlPropuesto","Medida propuesta según el hallazgo"], ["justificacionControl","Justificación del control y prioridad en la fuente"],
  ] },
  m3: { group:"m3", key:"filas", singular: "Actividad", fields: [
    ["planRef","Plan de trabajo",true,"planes"], ["plan","Nombre del plan en una versión anterior"],
    ["actividad","Actividad preventiva",true], ["riesgoRef","Hallazgo de M2",false,"riesgos"], ["hallazgo","Referencia complementaria del hallazgo"], ["responsable","Responsable",true],
    ["centro","Centro de trabajo"],["fechaInicio","Fecha prevista de inicio",false,"date"], ["fechaFin","Fecha prevista de cierre",false,"date"],
    ["inicioReal","Fecha real de inicio",false,"verification-date"],["cierreReal","Fecha real de cierre",false,"verification-date"],["estado","Estado de ejecución",false,"estados"], ["inicio","Mes de inicio guardado",false,"month"], ["fin","Mes de cierre guardado",false,"month"],
    ["enfoque","Enfoque de la actividad",false,"enfoques"], ["detalleEnfoque","Procedimiento y criterio según el enfoque"],
    ["evidenciaEsperada","Evidencia esperada"], ["eficacia","Criterio de eficacia"], ["evidenciaReal","Evidencia de ejecución"],
    ["grupo","Grupo de formación (si aplica)"], ["horasPersona","Horas de formación por persona (si aplica)",false,"hours"],
    ...Array.from({length:4},(_,i)=>["horasT"+(i+1),"Horas por persona en trimestre "+(i+1)+" (si cruza trimestres)",false,"hours"]), ["objetivo","Objetivo, meta y alcance"], ["frecuencia","Frecuencia"],
    ["procedimiento","Procedimiento e instrumento"], ["recursos","Recursos y presupuesto"],
    ["seguimiento","Indicador o evidencia de ejecución"],
  ] },
  m4: { group:"m4", key:"filas", singular: "Brecha", fields: [
    ["capitulo","Capítulo o sección"], ["brecha","Brecha o hallazgo",true],
    ["accion","Acción para atenderla"], ["responsable","Responsable"],
    ["plazo","Plazo o fecha acordada"], ["evidencia","Evidencia o referencia"],
  ] },
};
const editors = new Map();
let steps = [];
let currentStep = 0;
let moduleId;
let projectLabel;
let integrationInputs;

function element(tag, content) {
  const node = document.createElement(tag);
  if (content !== undefined) node.textContent = content;
  return node;
}

const families = Object.keys(planGuides);
const optionLists = {
  familias:families, estados:statuses, prioridades:["Inmediata","Programada","Por determinar"],
  enfoques:Object.keys(approaches), evaluaciones:["En evaluación","Valorada","Pendiente de medición"],
  tiposEvidencia:["Observación directa","Entrevista o consulta","Medición","Fotografía","Video","Revisión documental","Croquis"],
  estadosTarea:["Por observar","Evaluada","Pendiente de medición","Hallazgo registrado"],
  soportes:["Formato en preparación","Formato disponible","Evidencia existente","Pendiente de obtener"],
};

function fieldValue(control) {
  if (control.multiple) return [...(control.selectedOptions ?? [])].map(option=>option.value).filter(Boolean);
  return control.value.trim();
}

function rowValues(key) {
  const editor = editors.get(key);
  if (!editor) return [];
  return [...editor.querySelectorAll(".row-card")].map(row => ({
    id: row.dataset.id,
    ...Object.fromEntries([...row.querySelectorAll("[data-key]")].map(input => [input.dataset.key, fieldValue(input)])),
  }));
}

function choices(type) {
  if (optionLists[type]) return optionLists[type].map(name=>[name,name]);
  const data = ["procesos","planes","productivos","indicadores"].includes(type) ? rowValues(type)
    : type === "planesEntregados" ? (integrationInputs.m3?.data?.m3?.planesDetallados ?? [])
    : type === "tareasPropias" ? rowValues("tareas")
    : type === "tareas" ? (integrationInputs.m1?.data?.tarea?.actividades ?? [])
    : (integrationInputs.m2?.data?.m2?.filas ?? []);
  return (Array.isArray(data) ? data : []).filter(row => row.id && (row.nombre || row.riesgo))
    .map(row => [row.id, [row.codigo,row.nombre || row.riesgo].filter(Boolean).join(" · ")]);
}

function fillSelect(field, available, value) {
  const selected = field.multiple ? value : [value];
  field.replaceChildren(...(field.multiple ? [] : [new Option("Selecciona", "")]));
  for (const [id,name] of available) field.add(new Option(name,id));
  for (const id of selected.filter(Boolean)) {
    if (!available.some(([availableId])=>availableId===id)) field.add(new Option("Referencia anterior · revisa el vínculo ("+id+")",id));
  }
  if (field.multiple) {
    for (const option of field.options) option.selected = selected.includes(option.value);
  } else field.value = value;
}

function refreshLinks() {
  for (const editor of editors.values()) {
    for (const control of editor.querySelectorAll("[data-link]")) {
      fillSelect(control,choices(control.dataset.link),fieldValue(control));
    }
  }
}

function filteredActivities(){
  const filters=[["filter-center","centro"],["filter-plan","planRef"],["filter-owner","responsable"]];
  return rowValues("m3").filter(row=>filters.every(([id,key])=>{
    const value=document.getElementById(id)?.value;
    return !value || row[key]===value;
  }));
}

function redrawGantt() {
  if (moduleId !== "m3") return;
  const view = document.getElementById("gantt-view");
  const all=rowValues("m3");
  for(const [id,key,caption] of [["filter-center","centro","Todos los centros"],["filter-plan","planRef","Todos los planes"],["filter-owner","responsable","Todos los responsables"]]){
    const input=document.getElementById(id);
    if(!input?.add) continue;
    const before=input.value;
    const options=[...new Set(all.map(row=>row[key]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es"));
    const label=value=>key==="planRef" ? (rowValues("planes").find(plan=>plan.id===value)?.nombre||value) : value;
    input.replaceChildren(new Option(caption,""),...options.map(value=>new Option(label(value),value)));
    if(options.includes(before)) input.value=before;
  }
  const rows = scheduledActivities(filteredActivities());
  if (!rows.length) {
    view.replaceChildren(element("p", "Agrega una actividad con fechas previstas para ver el cronograma."));
    return;
  }
  const table = element("table");
  table.setAttribute("aria-label", "Carta Gantt 2027");
  const header = table.createTHead().insertRow();
  for (const label of ["Actividad","Responsable","Estado", ...months]) {
    const cell = element("th", label);
    cell.scope = "col";
    header.append(cell);
  }
  const body = table.createTBody();
  for (const row of rows) {
    const line = body.insertRow();
    const label = element("th", row.actividad);
    label.scope = "row";
    line.append(label);
    line.insertCell().textContent = row.responsable || "Por asignar";
    line.insertCell().textContent = row.estado || "Pendiente";
    const timing = schedule(row);
    for (let month = 1; month <= 12; month++) {
      const cell = line.insertCell();
      if (month >= timing.start && month <= timing.end) {
        cell.dataset.active = "";
        cell.textContent = "●";
        cell.setAttribute("aria-label", "Programada en " + months[month - 1]);
      }
    }
  }
  view.replaceChildren(table);
}

function reference(text,href) {
  const link=element("a",text);
  link.href=href;
  link.target="_blank";
  link.rel="noopener noreferrer";
  return link;
}

function showRowHelp(row,key,value) {
  if (!row) return;
  const box=row.querySelector("[data-row-help]");
  if (!box) return;
  const family=key==="familia" ? value : row.querySelector('[data-key="familia"]')?.value;
  const approach=key==="enfoque" ? value : row.querySelector('[data-key="enfoque"]')?.value;
  box.replaceChildren();
  if (family && familyTemplates[family]) {
    const template=familyTemplates[family];
    const text=element("p",planGuides[family]);
    if (family==="Educación e información") text.append(" · Referencia: 16 horas trimestrales por trabajador.");
    const button=element("button","Usar plantilla");
    button.type="button";
    button.addEventListener("click",()=>{
      const field=row.querySelector('[data-key="detalleFamilia"]');
      if (busy || !field) return;
      if (!field.value.trim()) { field.value=outline(template.fields); rowChanged(); }
      else tell("La plantilla se puede insertar en un campo vacío. Conservé el texto que ya escribiste.");
      field.focus();
    });
    box.append(text,reference("Consultar NT-04-2023, "+template.clause,sources.nt+"#page="+template.page),button);
  } else if (approach && approaches[approach]) {
    const [meaning,action,example]=approaches[approach];
    box.append(element("p",meaning),element("p",action),element("p","Ejemplo: "+example),
      reference("Consultar NT-04-2023, art. 17.1.1.4",sources.nt+"#page=8"));
  }
}

function updateRowLabels(key, editor) {
  const schema = rowSchemas[key];
  const rows = [...editor.querySelectorAll(".row-card")];
  rows.forEach((row, index) => {
    const label = schema.singular + " " + (index + 1);
    row.querySelector("legend").textContent = label;
    row.querySelector("[data-remove]").setAttribute("aria-label", "Quitar " + label.toLowerCase());
  });
  editor.querySelector("[data-add]").disabled = busy;
}

function rowChanged(event) {
  const key = event?.target?.dataset?.key;
  if (key === "tareaRef") {
    const task = (integrationInputs.m1?.data?.tarea?.actividades ?? []).find(item => item.id === event.target.value);
    const stage = event.target.closest(".row-card")?.querySelector('[data-key="etapa"]');
    if (task && stage) stage.value = task.etapa ?? "";
  }
  if (!event || key === "codigo" || key === "nombre") refreshLinks();
  if (!event || ["actividad","centro","planRef","inicio","fin","fechaInicio","fechaFin","responsable","estado"].includes(key)) redrawGantt();
  if (key === "familia" || key === "enfoque") showRowHelp(event.target.closest(".row-card"));
  if (["m1","m2","m3","m4"].includes(moduleId)) showCoherence();
  if (!event || moduleId === "m3") renderPlanCoverage();
  if (!event || moduleId === "m4") showReadiness();
  tell("Tienes cambios en el borrador.");
  refreshDelivery();
  renderProjectDetails();
  queueAutosave();
}

function appendRow(editorKey, editor, values = {}, focus = false) {
  const row = element("fieldset");
  row.className = "row-card";
  row.dataset.id = values.id || crypto.randomUUID();
  const fields = element("div");
  fields.className = "fields";
  for (const [key, label, required, type] of rowSchemas[editorKey].fields) {
    const wrapper = element("label", label);
    const isInput = !type || ["date","verification-date","hours"].includes(type);
    const long = ["detalleFamilia","detalleEnfoque","observacion","consulta","contraste","controlPropuesto","justificacionControl"].includes(key);
    const field = element(long ? "textarea" : isInput ? "input" : "select");
    const value = key==="riesgoRefs" ? recordRefs(values)
      : key==="estado" && editorKey==="m3" ? (values.estado || "Pendiente")
      : typeof values?.[key] === "string" ? values[key] : "";
    if (type === "month") {
      field.add(new Option("Elige un mes", ""));
      months.forEach((month,index) => field.add(new Option(month, String(index + 1))));
    } else if (type === "date" || type === "verification-date") {
      field.type = "date";
      if (type==="date") { field.min = "2027-01-01"; field.max = "2027-12-31"; }
    } else if (type === "hours") {
      field.type = "number";
      field.min = "0";
      field.step = "0.25";
    } else if (type) {
      field.dataset.link = type;
      if (type === "riesgos-multiple") { field.multiple = true; field.size = 5; }
      fillSelect(field,choices(type),value);
    } else {
      field.maxLength = 800;
    }
    if(key==="evidencia"||key==="ubicacion"){
      const help=element("small","Usa un código o una referencia a un repositorio con acceso autorizado. Registra la fecha o condición de revisión del acceso cuando corresponda.");
      help.className="field-guide";
      wrapper.append(help);
    }
    field.dataset.key = key;
    field.required = Boolean(required) && !(key === "planRef" && values.plan && !values.planRef)
      && !(key === "codigo" && !focus && !value)
      && !(key === "productivoRef" && !focus && !value);
    if (!field.multiple) field.value = value;
    if (editorKey === "m3" && key === "plan" && !value) wrapper.hidden = true;
    if (type==="month" && !value) wrapper.hidden = true;
    wrapper.append(field);
    if (key === "familia") {
      const guide=element("small",planGuides[value] || "");
      guide.className="field-guide";
      guide.dataset.planGuide="";
      wrapper.append(guide);
    }
    fields.append(wrapper);
  }
  const remove = element("button", "Quitar fila");
  remove.type = "button";
  remove.dataset.remove = "";
  remove.addEventListener("click", () => {
    if (busy) return;
    row.remove();
    updateRowLabels(editorKey, editor);
    editor.querySelector("[data-add]").focus();
    rowChanged();
  });
  row.append(element("legend"), fields);
  if (editorKey === "planes" || editorKey === "m3") {
    const help=element("div");
    help.dataset.rowHelp="";
    help.className="field-help";
    row.append(help);
    const helpKey=editorKey==="planes" ? "familia" : "enfoque";
    const valueForHelp=typeof values[helpKey]==="string" ? values[helpKey] : "";
    if (valueForHelp) showRowHelp(row,helpKey,valueForHelp);
  }
  const guideFields = editorKey==="tareas" ? ["observacion",["Fecha, turno y lugar","Tarea observada","Personas y medios","Condición observada","Fuente"]]
    : editorKey==="m2" ? ["justificacionControl",["Condición de origen","Control considerado en la fuente","Justificación y medidas complementarias","Verificación prevista"]] : null;
  if (guideFields) {
    const button=element("button","Usar plantilla");
    button.type="button";
    button.addEventListener("click",()=>{
      const field=row.querySelector('[data-key="'+guideFields[0]+'"]');
      if (busy || !field) return;
      if (!field.value.trim()) { field.value=outline(guideFields[1]); rowChanged(); }
      else tell("La plantilla se puede insertar en un campo vacío. Conservé el texto que ya escribiste.");
      field.focus();
    });
    row.append(button);
  }
  row.append(remove);
  editor.querySelector("[data-rows]").append(row);
  updateRowLabels(editorKey, editor);
  if (focus) fields.querySelector("[data-key]").focus();
}

function setupRows(info) {
  moduleId = info.moduleId;
  integrationInputs = info.inputs ?? {};
  const keys = {m1:["productivos","procesos","tareas","campo"],m2:["verificacion","m2"],m3:["planes","m3"],m4:["m4","objetivos","contratistas","indicadores","anexos"]};
  for (const key of keys[moduleId] ?? []) {
    const editor = form.querySelector('[data-editor="' + key + '"]');
    if (!editor) continue;
    editors.set(key,editor);
    const schema = rowSchemas[key];
    const values = info.draft?.[schema.group]?.[schema.key];
    if (Array.isArray(values)) values.forEach(row => appendRow(key,editor,row));
    editor.querySelector("[data-add]").addEventListener("click", () => {
      if (busy) return;
      appendRow(key,editor,{},true);
      rowChanged();
    });
  }
  redrawGantt();
  renderPlanCoverage();
}

function setupSteps() {
  steps = [...form.querySelectorAll("[data-module]")]
    .filter(section => section.dataset.module === moduleId && typeof section.querySelector === "function");
  if (!steps.length) return;
  const nav = document.getElementById("step-nav");
  steps.forEach((section, index) => {
    section.id ||= moduleId + "-paso-" + (index + 1);
    const title = section.querySelector("legend");
    title.tabIndex = -1;
    const button = element("button", title.textContent);
    button.type = "button";
    button.setAttribute("aria-controls",section.id);
    button.addEventListener("click", () => showStep(index,true));
    nav.append(button);
  });
  document.getElementById("step-back").addEventListener("click",() => showStep(currentStep - 1,true));
  document.getElementById("step-next").addEventListener("click",() => showStep(currentStep + 1,true));
  document.getElementById("step-controls").hidden = false;
  document.getElementById("step-actions").hidden = false;
  let resumed=0;
  try { resumed=Number(sessionStorage.getItem(recoveryKey+":step"))||0; } catch {}
  showStep(steps[resumed]?resumed:0,false);
}

function showStep(index, focus) {
  if (!steps[index]) return;
  currentStep = index;
  steps.forEach((section,position) => { section.hidden = position !== index; });
  [...document.getElementById("step-nav").children].forEach((button,position) => {
    if (position === index) button.setAttribute("aria-current","step");
    else button.removeAttribute("aria-current");
  });
  document.getElementById("step-status").textContent = "Paso " + (index + 1) + " de " + steps.length;
  document.getElementById("step-back").disabled = index === 0;
  document.getElementById("step-next").hidden = index === steps.length - 1;
  if(recoveryKey) try { sessionStorage.setItem(recoveryKey+":step",String(index)); } catch {}
  if (focus) {
    steps[index].querySelector("legend").focus({preventScroll:true});
    steps[index].scrollIntoView({block:"start"});
  }
}

function renderPlanCoverage() {
  const view = moduleId === "m3" && document.getElementById("plan-coverage");
  if (!view?.replaceChildren) return;
  const plans = rowValues("planes");
  const activities = scheduledActivities(rowValues("m3")).filter(row=>row.responsable);
  const list = element("ul");
  for (const family of families) {
    const matches = plans.filter(row=>row.nombre && row.familia===family);
    const scheduled = matches.some(plan=>recordRefs(plan).length && activities.some(row=>row.planRef===plan.id));
    list.append(element("li", family + " · " +
      (scheduled ? "Con vínculo y actividad programada" : matches.length ? "Ficha en preparación" : "Por documentar")));
  }
  const linked = new Set(plans.flatMap(recordRefs));
  const pending = (integrationInputs?.m2?.data?.m2?.filas ?? []).filter(row=>row.prioridad==="Inmediata" && !linked.has(row.id));
  for (const risk of pending) list.append(element("li","Hallazgo inmediato sin plan vinculado · "+(risk.codigo || risk.riesgo)));
  view.replaceChildren(list);
}

function showCoherence() {
  const panel=document.getElementById("coherence");
  if (!panel?.replaceChildren) return;
  let one=integrationInputs?.m1?.data ?? {},two=integrationInputs?.m2?.data?.m2 ?? {};
  let three=integrationInputs?.m3?.data?.m3 ?? {},four={};
  if (moduleId==="m1") one={flujo:{procesos:rowValues("procesos")},tarea:{actividades:rowValues("tareas")}};
  if (moduleId==="m2") two={filas:rowValues("m2"),verificaciones:rowValues("verificacion")};
  if (moduleId==="m3") three={planesDetallados:rowValues("planes"),filas:rowValues("m3"),gruposFormacion:formValues().find(([key])=>key==="m3.gruposFormacion")?.[1]};
  if (moduleId==="m4") {
    four=Object.fromEntries(formValues().filter(([key])=>key.startsWith("m4.")).map(([key,value])=>[key.slice(3),value]));
    four.soportes=rowValues("anexos");
  }
  const issues=coherenceIssues({one,two,three,four});
  if (issues.length===0) {
    panel.replaceChildren(element("p","No se detectaron pendientes en estas comprobaciones."));
  } else {
    const list=element("ul");
    for (const {target,message} of issues) {
      const item=element("li",message);
      const local=editors.get(target) ?? (moduleId==="m4" && target==="capitulos" ? form.querySelector("[data-chapter]") : null);
      if (local) {
        const button=element("button","Ir al paso");
        button.type="button";
        button.addEventListener("click",()=>{
          revealControl(local);
          local.scrollIntoView({block:"center"});
        });
        item.append(" ",button);
      }
      list.append(item);
    }
    panel.replaceChildren(list);
  }
  if (moduleId==="m3") {
    const hours=trainingHours(three.filas,three.planesDetallados,three.gruposFormacion);
    if (hours.length>0) panel.append(element("p","Horas programadas por persona: "+
      hours.map(({group,quarters})=>group+" ("+quarters.map((h,i)=>"T"+(i+1)+" "+h+" h").join(", ")+")").join(" · ")+"."));
  }
}

function setupProjectFields() {
  const container = document.getElementById("project-fields");
  if (moduleId !== "m1" || !container?.append) return;
  for (const [key,title] of projectFields) {
    const label=element("label",title);
    const input=element("input");
    input.name="proyecto."+key;
    input.maxLength=500;
    label.append(input);
    container.append(label);
  }
}

function showReadiness() {
  const panel = document.getElementById("chapter-readiness");
  if (moduleId !== "m4" || !panel?.replaceChildren) return;
  const current=Object.fromEntries(formValues().filter(([key])=>key.startsWith("m4.")).map(([key,value])=>[key.slice(3),value]));
  for (const key of ["contratistas","indicadores"]) current[key]=rowValues(key);
  const list=element("ul");
  for (const [title,ready] of draftReadiness(current,integrationInputs ?? {})) {
    list.append(element("li",title+" · "+(ready?"Con avance registrado":"Pendiente de desarrollar")));
  }
  panel.replaceChildren(list);
}

function insertOutline(name,fields) {
  if (busy) return;
  const field=form.elements.namedItem(name);
  if (!field) return;
  if (!field.value.trim()) { field.value=outline(fields); rowChanged(); }
  else tell("La plantilla se puede insertar en un campo vacío. Conservé el texto que ya escribiste.");
  field.focus();
}

function setupChapterFields() {
  if (moduleId !== "m4") return;
  for (const container of form.querySelectorAll("[data-chapter]")) {
    const number = Number(container.dataset.chapter);
    const definition = chapterStructure[number - 1];
    if (!definition) continue;
    const fields = element("div");
    fields.className = "fields";
    for (const [key,title,guide] of definition[1]) {
      const label = element("label",title);
      label.className = "wide";
      const control = element("textarea");
      control.name = "m4." + chapterKey(number,key);
      control.maxLength = 2400;
      const help = element("small",guide);
      help.className = "field-guide";
      help.id = control.name.replace(".","-") + "-ayuda";
      control.setAttribute("aria-describedby",help.id);
      label.append(help,control);
      fields.append(label);
    }
    container.append(fields);
    const definitionTemplate=chapterTemplates[number];
    const toolbar=element("div");
    toolbar.className="field-help";
    const general=element("button","Usar plantilla");
    general.type="button";
    general.addEventListener("click",()=>insertOutline("m4.cap"+number,definitionTemplate.fields));
    const url=number===1 ? sources.guia : sources.nt;
    toolbar.append(reference(definitionTemplate.clause,url+"#page="+definitionTemplate.page),general);
    if (number===5) {
      for (const [key,fields] of Object.entries(investigationTemplates)) {
        const button=element("button",key==="accidentes" ? "Plantilla de accidentes" : "Plantilla de enfermedades ocupacionales");
        button.type="button";
        button.addEventListener("click",()=>insertOutline("m4.cap5_"+key,fields));
        toolbar.append(button);
      }
    }
    container.append(toolbar);
  }
  const annexes = document.getElementById("chapter-annexes");
  if (!annexes?.append) return;
  for (const [key,title] of annexStructure) {
    const label = element("label",title);
    const control = element("textarea");
    control.name = "m4.anexo_" + key;
    control.maxLength = 1200;
    label.append(control);
    annexes.append(label);
  }
}

function setupReview() {
  const container = moduleId === "m4" && document.getElementById("review-items");
  if (!container?.append) return;
  for (const [index,[title,criteria]] of reviewGroups.entries()) {
    const chapter=index+1;
    const definitions=chapterStructure[index][1];
    const template=chapterTemplates[chapter];
    const section = element("details");
    section.className = "module-details";
    section.append(element("summary",title));
    const source=element("p","Instrumento de revisión · Capítulo "+chapter+" · ");
    source.append(reference(template.clause,(chapter===1?sources.guia:sources.nt)+"#page="+template.page));
    section.append(source);
    for (const [key, label] of criteria) {
      const group = element("fieldset");
      group.className = "review-item";
      group.append(element("legend",label));
      const controls = element("div");
      controls.className = "fields";
      const select = element("select");
      select.name = "m4.estado_" + key;
      for (const state of ["","Documentado","Pendiente","No aplica, con justificación"]) {
        select.add(new Option(state || "Por revisar",state));
      }
      const observation = element("textarea");
      observation.name = "m4.nota_" + key;
      observation.maxLength = 600;
      const stateLabel = element("label","Estado");
      stateLabel.append(select);
      const noteLabel = element("label","Evidencia, pendiente o justificación");
      noteLabel.append(observation);
      controls.append(stateLabel,noteLabel);
      const targets={
        objetivos:"objetivo_general",legal:"basamento",roles:"responsabilidades",direccion:"suscripcion",
        prevencion:"principios",consulta:"difusion",inventario:"proceso_productivo",etapas:"diagramas",metodo:"validacion",
        exposicion:"riesgos",asamblea:"validacion",medidas:"prioridades",rendimiento:"compromisos",participacion:"compromisos",
        medios:"recursos",compras:"contratacion",contratistas:"coordinacion",subcontratos:"coordinacion",
        evaluacion:"criterios",ajustes:"mejora",anexos:"criterios",expediente:"criterios",
      };
      const fieldKey=definitions.some(([name])=>name===key)?key:targets[key]??(chapter===4?"estructura":definitions[0][0]);
      const edit=element("button","Ir al campo del borrador");
      edit.type="button";
      edit.addEventListener("click",()=>{
        const input=form.elements.namedItem("m4."+chapterKey(chapter,fieldKey));
        if(!input) return;
        revealControl(input);
        input.focus();
      });
      group.append(controls,edit);
      section.append(group);
    }
    container.append(section);
  }
}

function revealControl(control) {
  if (!control) return;
  const step = steps.findIndex(section => section.contains(control));
  if (step >= 0) showStep(step,false);
  for (let parent = control.parentElement; parent && parent !== form; parent = parent.parentElement) {
    if (parent.tagName === "DETAILS") parent.open = true;
  }
}

function validateForm() {
  const controls = [...(form.elements ?? [])];
  for (const control of controls) {
    if (!control.dataset.link || !control.setCustomValidity) continue;
    const available = choices(control.dataset.link);
    control.setCustomValidity([fieldValue(control)].flat().some(value=>value && !available.some(([id])=>id===value))
      ? "Selecciona una referencia que siga disponible en el registro." : "");
  }
  const invalid = controls.find(control => control.willValidate && !control.validity.valid);
  revealControl(invalid);
  if (!form.reportValidity()) {
    tell("Revisa el campo marcado antes de entregar.", "error");
    return false;
  }
  const linkedTasks = choices("tareas");
  const linkedRisks = choices("riesgos");
  const riskWithoutTask = moduleId === "m2" && linkedTasks.length &&
    rowValues("m2").findIndex(row => row.codigo && !row.tareaRef);
  const planWithoutRisk = moduleId === "m3" && linkedRisks.length &&
    rowValues("planes").findIndex(row => !recordRefs(row).length);
  for (const [index,key,field,message] of [
    [riskWithoutTask,"m2","tareaRef","Selecciona la tarea de M1 para cada hallazgo nuevo."],
    [planWithoutRisk,"planes","riesgoRefs","Selecciona los hallazgos de M2 que aborda este plan."],
  ]) {
    if (typeof index !== "number" || index < 0 || !editors.has(key)) continue;
    const row = editors.get(key).querySelectorAll(".row-card")[index];
    const control = row?.querySelector('[data-key="' + field + '"]');
    revealControl(control);
    control?.focus();
    tell(message,"error");
    return false;
  }
  return true;
}

function tell(message, state = "") {
  status.textContent = message;
  status.dataset.state = state;
}

async function api(path, body) {
  const headers = {};
  if (session) headers.Authorization = "Bearer " + session;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(apiRoot + path, {
    method: body === undefined ? "GET" : "POST", headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    referrerPolicy: "no-referrer", cache: "no-store",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    const error=new Error(data?.error ?? "No se pudo contactar al Constructor. Vuelve a abrirlo desde Moodle.");
    error.http=response.status;
    throw error;
  }
  return data;
}

function formValues() {
  return [...new FormData(form)].map(([path, value]) => [path, value.trim()]);
}

function draftFingerprint(values = formValues()) {
  return JSON.stringify([values, [...editors.keys()].map(rowValues), rememberedRisks??draft?.m3?.referenciasRevisadas]);
}

function deliveryStatus(delivery) {
  return delivery.review
    ? "Nota publicada en Moodle: " + delivery.review.score + " de 100 puntos. Revisión técnica: " +
      delivery.review.technicalPoints + " de 40 puntos. Retroalimentación: " + delivery.review.feedback
    : "Pendiente de revisión técnica.";
}

function refreshDelivery() {
  const dirty = draftFingerprint() !== savedValues;
  const current = lastDelivery?.revision === revision && !dirty;
  deliver.disabled = busy || current;
  deliver.textContent = current ? "Entrega registrada" : "Entregar para revisión";
  if (!lastDelivery) return;
  const download=document.getElementById("export-archive");
  if(download) download.hidden=moduleId!=="m4" || !lastDelivery.hasArchive;

  const date = new Date(lastDelivery.submittedAt);
  const when = Number.isNaN(date.valueOf()) ? "" :
    new Intl.DateTimeFormat("es-VE", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Caracas" }).format(date);
  receipt.hidden = false;
  document.getElementById("receipt-title").textContent = current ? "✓ Entrega registrada" : "✓ Última entrega registrada";
  document.getElementById("receipt-detail").textContent =
    (when ? when + " · Hora de Venezuela. " : "") +
    "Comprobación automática: " + lastDelivery.automaticPoints + " de 60 puntos. " + deliveryStatus(lastDelivery) +
    (current ? "" : " Tienes un borrador más reciente que aún no has entregado.");
}

function collectDraft(values = formValues()) {
  const next = structuredClone(draft);
  for (const [path, value] of values) {
    const [group, key] = path.split(".");
    if (!next[group] || typeof next[group] !== "object" || Array.isArray(next[group])) next[group] = {};
    next[group][key] = path === "bitacora.horas" ? (value ? Number(value) : null) : value;
  }
  for (const key of editors.keys()) {
    const schema = rowSchemas[key];
    next[schema.group] ??= {};
    next[schema.group][schema.key] = rowValues(key);
  }
  if(moduleId==="m3" && rememberedRisks) {
    next.m3 ??={};
    next.m3.referenciasRevisadas=rememberedRisks;
  }
  return next;
}

async function saveIfChanged() {
  const values=formValues(),fingerprint=draftFingerprint(values);
  if(fingerprint===savedValues) return;
  if(conflict) throw new Error("Conserva una copia y vuelve a abrir el módulo para comparar las dos versiones.");
  const next=collectDraft(values);
  if (new TextEncoder().encode(JSON.stringify(next)).length > 230000) {
    throw new Error("El borrador supera el tamaño disponible. Usa referencias para el material extenso.");
  }
  const saved = await api("draft", { revision, draft: next });
  draft = next;
  revision = saved.revision;
  savedValues = fingerprint;
  recordSaved(new Date().toISOString());
  if(projectInfo?.progress?.[moduleId]){
    projectInfo.progress[moduleId].revision=revision;
    renderProgress();
  }
  if(draftFingerprint()===savedValues) clearRecovery();
  else stashRecovery();
  pending = undefined;
}

async function update(message, action) {
  if (busy) return;
  busy = true;
  const save = form.querySelector('button[type="submit"]');
  const inputs = [...form.querySelectorAll("input, textarea")];
  save.disabled = true;
  const disabledDuringSave = [...editors.values()].flatMap(editor => [...editor.querySelectorAll("select, [data-remove]")]);
  disabledDuringSave.forEach(control => { control.disabled = true; });
  for (const [key, editor] of editors) updateRowLabels(key,editor);
  refreshDelivery();
  tell(message);
  inputs.forEach(input => { input.readOnly = true; });
  try {
    await action();
  } catch (error) {
    handleSaveError(error);
  } finally {
    inputs.forEach(input => { input.readOnly = false; });
    busy = false;
    save.disabled = false;
    disabledDuringSave.forEach(control => { control.disabled = false; });
    for (const [key, editor] of editors) updateRowLabels(key,editor);
    refreshDelivery();
    if(draftFingerprint()!==savedValues) queueAutosave();
  }
}

form.addEventListener("input", rowChanged);

form.addEventListener("submit", event => {
  event.preventDefault();
  void update("Guardando el borrador…", async () => {
    await saveIfChanged();
    tell("✓ Borrador guardado.", "success");
  });
});

deliver.addEventListener("click", () => {
  if (busy || deliver.disabled) return;
  if (moduleId === "m3" && rowValues("m3").some(row=>row.actividad && !schedule(row))) {
    revealControl(editors.get("m3")?.querySelector("select"));
    tell("Completa el inicio y el cierre previsto de cada actividad, dentro de 2027 y en orden.", "error");
    return;
  }
  if (!validateForm()) return;
  if (moduleId === "m4") {
    const recorded=Object.fromEntries(formValues().filter(([key])=>key.startsWith("m4.")).map(([key,value])=>[key.slice(3),value]));
    for (const key of ["contratistas","indicadores"]) recorded[key]=rowValues(key);
    const missing = draftReadiness(recorded,integrationInputs ?? {}).filter(([,ready])=>!ready);
    if (missing.length) {
      tell("Antes de entregar, desarrolla o referencia estos capítulos: "+missing.map(([title])=>title).join(", ")+".", "error");
      return;
    }
  }
  void update("Enviando la entrega…", async () => {
    await saveIfChanged();
    pending ??= crypto.randomUUID();
    lastDelivery = await api("submit", { revision, requestId: pending });
    if(moduleId==="m4") deliveredArchive=undefined;
    if(projectInfo?.progress?.[moduleId]){
      projectInfo.progress[moduleId].submittedRevision=revision;
      projectInfo.progress[moduleId].published=Boolean(lastDelivery.review);
      renderProgress();
    }
    if(moduleId==="m4"||!lastDelivery.checks) {
      try { lastDelivery=(await api("workspace")).delivery??lastDelivery; } catch {}
    }
    renderChecklist();
    pending = undefined;
    tell("✓ Entrega registrada. " + lastDelivery.automaticPoints + " de 60 puntos automáticos. " + deliveryStatus(lastDelivery), "success");
  });
});

function downloadBlob(blob,filename) {
  const url = URL.createObjectURL(blob);
  const link = element("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function downloadHtml(documentText,filename){
  downloadBlob(new Blob([documentText],{type:"text/html;charset=utf-8"}),filename);
}

function setupGanttDownload(info) {
  if (info.moduleId !== "m3") return;
  function downloadSchedule(includePlans) {
    if (busy) return;
    const documentText = buildGanttDocument({
      label: info.label, activities: filteredActivities(), plans: rowValues("planes"), includePlans,
      riskRows: info.inputs?.m2?.data?.m2?.filas, declaredGroups:formValues().find(([key])=>key==="m3.gruposFormacion")?.[1],
      legacyReference: form.elements.namedItem("m3.gantt").value.trim(),
    });
    if (!documentText) {
      tell("Registra una actividad con fechas previstas o una ficha de plan antes de descargar.", "error");
      return;
    }
    downloadHtml(documentText, includePlans ? "Planes_y_Carta_Gantt_2027.html" : "Carta_Gantt_2027.html");
    tell("Documento preparado. Ábrelo para imprimirlo o guardarlo como PDF.", "success");
  }
  document.getElementById("export-gantt").addEventListener("click",()=>downloadSchedule(false));
  document.getElementById("export-excel")?.addEventListener("click",()=>{
    if (!scheduledActivities(filteredActivities()).length) { tell("Registra una actividad con fechas o cambia los filtros.","error"); return; }
    downloadBlob(excelGantt(filteredActivities(),rowValues("planes")),"Carta_Gantt_2027.xlsx");
  });
  for(const id of ["filter-center","filter-plan","filter-owner"]) document.getElementById(id)?.addEventListener("change",redrawGantt);
  document.getElementById("export-plans-gantt").addEventListener("click",()=>downloadSchedule(true));
}

function setupDocument(info) {
  if (info.moduleId !== "m4") return;
  projectLabel = info.label;
  integrationInputs = info.inputs ?? {};
  const sources = document.getElementById("integration-sources");
  const list = element("ul");
  for (const number of [1, 2, 3]) {
    const source = integrationInputs["m" + number];
    const status = source?.submittedAt ? "Última entrega registrada"
      : Object.keys(source?.data ?? {}).length ? "Borrador guardado" : "Sin datos guardados";
    list.append(element("li", "Módulo " + number + " · " + status));
  }
  sources.replaceChildren(list);
  const profile=integrationInputs.m1?.data?.proyecto ?? {};
  const entity=(String(profile.entidad ?? "").trim() || "[Entidad]");
  const center=(String(profile.centro ?? "").trim() || "[Centro de trabajo]");
  const version=String(profile.version ?? "").trim() || "[Versión]";
  const sections=[
    ["compose-policy","m4.cap2_politica",
      entity+" adopta esta política de SST para "+center+". El equipo se compromete a prevenir accidentes y enfermedades ocupacionales, a reducir riesgos con base en el diagnóstico, y a consultar a las personas trabajadoras y sus representantes.\n\nPrioridades del centro: [incorporar objetivos y medidas de la entidad].\nDifusión, revisión y suscripción: [completar con el SSST, el CSSL y los responsables]."],
    ["compose-letter","m4.compromiso",
      "Borrador para revisión y suscripción\nEntidad: "+entity+"\nCentro: "+center+"\nVersión del PSST: "+version+"\nRepresentante: [completar]\nDirigida al Comité de Seguridad y Salud Laboral.\n\nSe propone asumir el compromiso de ejecutar y revisar los planes del PSST, proporcionar los recursos previstos, facilitar la participación y hacer seguimiento de las medidas preventivas.\n\nCompromisos específicos y responsables: [incorporar los planes, recursos y plazos].\nFecha y firma: [pendientes de validación y suscripción]."],
  ];
  for(const [id,name,content] of sections) {
    document.getElementById(id).addEventListener("click",()=>{
      if (busy) return;
      const field=form.elements.namedItem(name);
      if (field.value.trim()) { field.focus(); return; }
      field.value=content;
      rowChanged();
      field.focus();
    });
  }
  const button = document.getElementById("export-psst");
  button.addEventListener("click", () => void update("Preparando el borrador…", async () => {
    await saveIfChanged();
    const documentText = buildPsstDocument({ label: projectLabel, inputs: integrationInputs, draft });
    downloadHtml(documentText, "Borrador_PSST.html");
    tell("Borrador preparado. Ábrelo en tu navegador para revisarlo o guardarlo como PDF.", "success");
  }));
}

function renderProgress(){
  const view=document.getElementById("project-progress");
  if(!projectInfo?.progress||!view?.replaceChildren) return;
  view.replaceChildren(...modules.map(([id,name,n])=>{
    const tile=element("div");
    tile.className="project-tile";
    if(id===moduleId) tile.setAttribute("aria-current","step");
    tile.append(element("strong",n+" · "+name),element("span",projectState(projectInfo.progress,id)));
    return tile;
  }));
}

function renderChecklist(){
  const view=document.getElementById("learner-checks");
  if(!view?.replaceChildren) return;
  const checks=lastDelivery?.checks;
  view.replaceChildren(element("p",checks ? "Comprobaciones de la última entrega" : "Cada comprobación registrada aporta 12 puntos, hasta 60. La revisión técnica aporta hasta 40."));
  if(!checks) return;
  const list=element("ul");
  for(const [id,has] of Object.entries(checks)) list.append(element("li",(checksLabels[id]||id)+" · "+(has?"12/12":"0/12")));
  view.append(list);
}

function recordSaved(value){
  const node=document.getElementById("saved-time");
  if(!node) return;
  node.textContent=value ? "Guardado "+new Intl.DateTimeFormat("es-VE",{dateStyle:"short",timeStyle:"short",timeZone:"America/Caracas"}).format(new Date(value))+" (VE)" : "Pendiente de guardar";
}

function recoveryRecord(){
  if(!recoveryKey) return null;
  try {
    const item=JSON.parse(sessionStorage.getItem(recoveryKey));
    return item?.draft && Number.isInteger(item.revision) && Date.now()-item.at<2*60*60*1000 ? item : null;
  } catch { return null; }
}

function stashRecovery(){
  if(!recoveryKey||!moduleId||!savedValues||draftFingerprint()===savedValues) return;
  try { sessionStorage.setItem(recoveryKey,JSON.stringify({draft:collectDraft(),revision,at:Date.now()})); } catch {}
}
function clearRecovery(){
  if(!recoveryKey) return;
  try { sessionStorage.removeItem(recoveryKey); } catch {}
}
function queueAutosave(){
  if(!recoveryKey||!savedValues||draftFingerprint()===savedValues) return;
  stashRecovery();
  clearTimeout(autosaveTimer);
  if(conflict) return;
  autosaveTimer=setTimeout(async()=>{
    if(busy || conflict || navigator.onLine===false) return;
    busy=true;
    try { await saveIfChanged(); tell("Borrador guardado automáticamente.","success"); }
    catch(error){ handleSaveError(error); }
    finally { busy=false; refreshDelivery(); }
  },1200);
}
function handleSaveError(error){
  tell(error.message,"error");
  stashRecovery();
  if([401,403,409].includes(error.http)){
    conflict=true;
    const marker=document.getElementById("draft-conflict");
    marker.hidden=false;
    marker.textContent=error.http===409 ? "Existe una versión más reciente. Puedes descargar tus cambios y volver a abrir el módulo para compararlos." :
      "La sesión terminó. Vuelve a abrir el módulo en esta pestaña desde Moodle o descarga una copia de tus cambios.";
    document.getElementById("copy-recovery").hidden=false;
  }
}

function restoreRecovery(item){
  for(const input of form.querySelectorAll("[name]")){
    const [group,key]=input.name.split(".");
    input.value=item.draft[group]?.[key]??"";
  }
  for(const [key,editor] of editors){
    const schema=rowSchemas[key];
    editor.querySelector("[data-rows]").replaceChildren();
    for(const row of item.draft[schema.group]?.[schema.key]??[]) appendRow(key,editor,row);
  }
  refreshLinks();
  document.getElementById("restore-recovery").hidden=true;
  document.getElementById("draft-conflict").hidden=true;
  rowChanged();
}

function caseDraft(){
  const now=moduleId ? collectDraft() : {};
  return {
    one:moduleId==="m1" ? now : integrationInputs?.m1?.data??{},
    two:moduleId==="m2" ? now.m2 : integrationInputs?.m2?.data?.m2??{},
    three:moduleId==="m3" ? now.m3 : integrationInputs?.m3?.data?.m3??{},
  };
}

function riskBaseline(risks){
  return (risks??[]).map(risk=>[risk.id,risk.codigo,risk.tareaRef,risk.riesgo,risk.prioridad,risk.valoracion,risk.controlPropuesto]);
}

function renderProjectDetails(){
  const view=document.getElementById("trace-table");
  if(!projectInfo?.projectKey || !view?.replaceChildren || !moduleId) return;
  const inputs=caseDraft();
  const paths=workTrace(inputs.one,inputs.two,inputs.three);
  view.replaceChildren();
  if(!paths.length) view.append(element("p",moduleId==="m3"?"Las tareas completas y sus vínculos se consultan en el módulo 4.":"Registra las tareas en el módulo 1 para construir la trazabilidad."));
  else {
    const table=element("table");
    table.setAttribute("aria-label","Trazabilidad de tareas");
    const row=table.createTHead().insertRow();
    for(const title of ["Flujo productivo","Proceso de trabajo","Tarea","Hallazgos","Planes","Actividades y evidencia"]){
      const cell=element("th",title);cell.scope="col";row.append(cell);
    }
    const body=table.createTBody();
    const summarize=(rows,key)=>rows.map(item=>[item.codigo,item[key]].filter(Boolean).join(" · ")).join("\n")||"—";
    for(const path of paths){
      const line=body.insertRow();
      for(const value of [path.flow?.nombre,path.process?.nombre,summarize([path.task],"nombre"),
        summarize(path.findings,"riesgo"),summarize(path.plans,"nombre"),
        path.activities.map(item=>[item.actividad,item.evidenciaReal||item.evidenciaEsperada].filter(Boolean).join(" · ")).join("\n")]){
        line.insertCell().textContent=value||"—";
      }
    }
    view.append(table);
  }
  const questionView=document.getElementById("technical-prompts");
  const prompts=technicalPrompts(inputs);
  questionView.replaceChildren();
  if(prompts.length){
    const list=element("ul");
    for(const prompt of prompts) list.append(element("li",prompt));
    questionView.append(list);
  } else questionView.append(element("p","Verifica si las fuentes permiten explicar el trabajo real y si cada medida tiene un criterio de eficacia."));
  const marker=document.getElementById("source-impact");
  const ack=document.getElementById("ack-source");
  let message="";
  if(moduleId==="m3"){
    const before=rememberedRisks??draft?.m3?.referenciasRevisadas;
    const after=riskBaseline(inputs.two.filas);
    const old=new Map((before??[]).map(row=>[row[0],JSON.stringify(row)]));
    const now=new Map(after.map(row=>[row[0],JSON.stringify(row)]));
    const changed=[...new Set([...old.keys(),...now.keys()])].filter(id=>old.get(id)!==now.get(id));
    const affected=(inputs.three?.planesDetallados??[]).filter(plan=>recordRefs(plan).some(id=>changed.includes(id)));
    if(before && changed.length) message="Hay cambios en los hallazgos del módulo 2. "+(affected.length ?
      "Revisa primero estos planes: "+affected.map(plan=>plan.codigo||plan.nombre).join(", ")+".":"Revisa si los hallazgos nuevos requieren vincularse a un plan.");
    ack.hidden=!message;
  }
  if(moduleId==="m4" && deliveredArchive){
    const changes=changedSources(deliveredArchive.inputs,integrationInputs);
    if(changes.length) message="Hay cambios posteriores a la entrega en: "+changes.map(id=>"Módulo "+id.slice(1)).join(", ")+". Revisa los capítulos III y IV y los anexos antes de entregar otra versión.";
  }
  marker.hidden=!message;
  marker.textContent=message;
  const fieldHours=document.getElementById("field-hours");
  if(moduleId==="m1"&&fieldHours) {
    const complete=rowValues("campo").filter(row=>row.fecha&&row.actividad&&row.evidencia&&Number(row.horas)>0);
    fieldHours.textContent=complete.reduce((total,row)=>total+Number(row.horas),0)+" de 32 horas respaldadas con registros de campo.";
  }
}

async function exportArchive(){
  try {
    deliveredArchive=deliveredArchive??await api("archive");
    renderProjectDetails();
    downloadBlob(wordFromReport(buildPsstDocument(deliveredArchive)),"PSST_Entrega_R"+deliveredArchive.version+".docx");
  } catch(error){ tell(error.message,"error"); }
}

function setupProjectPanel(info){
  if(!info.projectKey) return;
  const panel=document.getElementById("project-panel");
  if(!panel) return;
  panel.hidden=false;
  renderProgress();
  recordSaved(info.savedAt);
  const item=recoveryRecord();
  const restore=document.getElementById("restore-recovery");
  const copy=document.getElementById("copy-recovery");
  const marker=document.getElementById("draft-conflict");
  if(item) {
    if(JSON.stringify(item.draft)===JSON.stringify(info.draft)) clearRecovery();
    else {
      marker.hidden=false;
      copy.hidden=false;
      restore.hidden=item.revision!==revision;
      marker.textContent=restore.hidden?"La copia de esta pestaña y el borrador guardado tienen revisiones distintas. Descarga la copia para comparar.":"Hay cambios de esta pestaña disponibles para recuperar.";
      restore.addEventListener("click",()=>restoreRecovery(item));
    }
  }
  copy.addEventListener("click",()=>{
    const data=recoveryRecord();
    if(!data){ tell("No hay una copia de recuperación en esta pestaña.","error");return; }
    downloadBlob(new Blob([JSON.stringify(data.draft,null,2)],{type:"application/json"}),"PSST_"+moduleId+"_recuperacion.json");
  });
  document.getElementById("resume-step").addEventListener("click",()=>showStep(currentStep,true));
  window.addEventListener("pagehide",stashRecovery);
  window.addEventListener("online",queueAutosave);
  const rubric=document.getElementById("learner-rubric");
  const list=element("ol");
  for(const [name,guide] of rubrics[moduleId]){
    const item=element("li");
    item.append(element("strong",name),element("p",guide));
    list.append(item);
  }
  rubric.replaceChildren(element("p","Rúbrica técnica · 4 criterios de 10 puntos"),list);
  renderChecklist();
  const coachButton=document.getElementById("coach-request");
  coachButton.addEventListener("click",async()=>{
    const feedback=document.getElementById("coach-response");
    const consent=document.getElementById("coach-consent").checked;
    if(!consent){ feedback.textContent="Autoriza el envío para solicitar una sugerencia.";return;}
    coachButton.disabled=true;
    feedback.textContent="Preparando sugerencias…";
    try {
      const result=await api("coach",{mode:document.getElementById("coach-mode").value,
        text:document.getElementById("coach-text").value,consent});
      feedback.textContent=result.suggestion+"\n\nRevisa la sugerencia antes de incorporarla a tu PSST.";
    } catch(error){ feedback.textContent=error.message; }
    finally { coachButton.disabled=false; }
  });
  if(moduleId==="m3"){
    if(!draft.m3?.referenciasRevisadas) {
      rememberedRisks=riskBaseline(integrationInputs?.m2?.data?.m2?.filas);
      savedValues=draftFingerprint();
    }
    document.getElementById("ack-source").addEventListener("click",()=>{
      rememberedRisks=riskBaseline(caseDraft().two.filas);
      rowChanged();
    });
  }
  if(moduleId!=="m4") return;
  document.getElementById("export-archive").addEventListener("click",()=>void exportArchive());
  if(info.delivery?.hasArchive) void api("archive").then(data=>{deliveredArchive=data;renderProjectDetails();}).catch(()=>{});
  document.getElementById("export-word").addEventListener("click",()=>void update("Preparando la versión editable…",async()=>{
    await saveIfChanged();
    downloadBlob(wordFromReport(buildPsstDocument({label:info.label,inputs:integrationInputs,draft,version:revision})),"Borrador_PSST_R"+revision+".docx");
    tell("Borrador Word preparado.","success");
  }));
  document.getElementById("export-pdf").addEventListener("click",()=>{
    const report=buildPsstDocument({label:info.label,inputs:integrationInputs,draft:collectDraft(),version:revision});
    const tab=window.open("","_blank");
    if(!tab){downloadHtml(report,"Vista_impresion_PSST.html");tell("Abre el archivo y usa Imprimir para guardarlo como PDF.");return;}
    tab.opener=null;
    tab.document.open();
    const parsed=new DOMParser().parseFromString(report,"text/html");
    const styles=parsed.querySelector("style")?.textContent??"";
    parsed.querySelector("style")?.remove();
    tab.document.write("<!doctype html>"+parsed.documentElement.outerHTML);
    tab.document.close();
    if(styles && typeof tab.CSSStyleSheet==="function"){
      const sheet=new tab.CSSStyleSheet();
      sheet.replaceSync(styles);
      tab.document.adoptedStyleSheets=[sheet];
    }
    tab.focus();
    tab.print();
  });
}


async function start() {
  if (!ticket) throw new Error("Abre la actividad desde el curso en Moodle.");
  const auth = await api("exchange", { ticket });
  session = auth.session;
  const info = await api("workspace");
  projectInfo=info;
  recoveryKey=info.projectKey ? "psst154:"+info.projectKey+":"+info.moduleId : undefined;
  const moduleContent = {
    m2: ["Identificación de procesos peligrosos y evaluación de riesgos",
      "Registra lo observado en campo y entrega la matriz inicial de riesgos para revisión."],
    m3: ["Planes de trabajo y carta Gantt",
      "Organiza las acciones preventivas, los responsables y el cronograma para 2027."],
    m4: ["Borrador del PSST y revisión técnica",
      "Entrega el primer borrador integrado junto con las brechas y evidencias de revisión."],
  };
  const content = moduleContent[info.moduleId];
  if (info.moduleId !== "m1" && !content) {
    startup.textContent = "Esta actividad no está disponible.";
    return;
  }
  if (content) {
    const number = info.moduleId.slice(1);
    document.title = "Módulo " + number + " · Constructor de PSST";
    document.querySelector(".hero .eyebrow").textContent = "Constructor de PSST · Módulo " + number;
    document.querySelector(".hero h1").textContent = content[0];
    document.querySelector(".hero h1 + p").textContent = content[1];
  }
  for (const section of form.querySelectorAll("[data-module]")) {
    section.hidden = section.dataset.module !== info.moduleId;
    section.disabled = section.hidden;
  }
  const workspace = document.getElementById("workspace");
  workspace.textContent = "Proyecto · " + info.label;
  workspace.hidden = false;
  draft = info.draft ?? {};
  moduleId = info.moduleId;
  setupProjectFields();
  setupChapterFields();
  setupReview();
  revision = info.revision;
  lastDelivery = info.delivery;
  for (const input of form.querySelectorAll("[name]")) {
    const [group, key] = input.name.split(".");
    const value = draft[group]?.[key];
    input.value = typeof value === "string" || typeof value === "number" ? value : "";
  }
  setupRows(info);
  showReadiness();
  setupDocument(info);
  setupGanttDownload(info);
  setupSteps();
  showCoherence();
  savedValues = draftFingerprint();
  setupProjectPanel(info);
  renderProjectDetails();
  if (lastDelivery?.revision === revision) {
    tell("✓ Entrega registrada. " + lastDelivery.automaticPoints + " de 60 puntos automáticos. " + deliveryStatus(lastDelivery), "success");
  } else {
    tell("Guarda tu avance o entrega una versión para revisión.");
  }
  startup.hidden = true;
  form.hidden = false;
  refreshDelivery();
}

start().catch(error => {
  startup.textContent = error.message;
  startup.dataset.state = "error";
});
