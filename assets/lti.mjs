import { approaches, chapterTemplates, coherenceIssues, familyTemplates, investigationTemplates, outline, sources, trainingHours } from "./psst-coach.mjs?v=coach-1";
import { draftReadiness, planGuides, projectFields, recordRefs, schedule, statuses } from "./psst-program.mjs?v=coach-1";
import { buildGanttDocument, buildPsstDocument, scheduledActivities } from "./psst-document.mjs?v=coach-1";
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
    ["responsable","Responsable de completarlo"],
  ]},
  procesos: { group:"flujo", key:"procesos", singular:"Proceso", fields:[
    ["codigo","Código (p. ej., P-01)",true], ["nombre","Nombre del proceso de trabajo",true],
    ["productivoRef","Flujo productivo o de servicio",true,"productivos"], ["area","Área o departamento"], ["entradas","Entradas, materiales y sustancias"],
    ["secuencia","Etapas y organización del trabajo"], ["salidas","Productos, residuos y disposición"],
    ["contratistas","Contratistas e interacciones"], ["evidencia","Diagrama, croquis u otra evidencia"],
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
    ["fechaInicio","Fecha prevista de inicio",false,"date"], ["fechaFin","Fecha prevista de cierre",false,"date"],
    ["estado","Estado de ejecución",false,"estados"], ["inicio","Mes de inicio guardado",false,"month"], ["fin","Mes de cierre guardado",false,"month"],
    ["enfoque","Enfoque de la actividad",false,"enfoques"], ["detalleEnfoque","Procedimiento y criterio según el enfoque"],
    ["evidenciaEsperada","Evidencia esperada"], ["eficacia","Criterio de eficacia"], ["evidenciaReal","Evidencia de ejecución"],
    ["grupo","Grupo de formación (si aplica)"], ["horasPersona","Horas de formación por persona (si aplica)",false,"hours"],
    ["objetivo","Objetivo, meta y alcance"], ["frecuencia","Frecuencia"],
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

function redrawGantt() {
  if (moduleId !== "m3") return;
  const view = document.getElementById("gantt-view");
  const rows = scheduledActivities(rowValues("m3"));
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
  if (!event || ["actividad","inicio","fin","fechaInicio","fechaFin","responsable","estado"].includes(key)) redrawGantt();
  if (key === "familia" || key === "enfoque") showRowHelp(event.target.closest(".row-card"));
  if (["m1","m2","m3","m4"].includes(moduleId)) showCoherence();
  if (!event || moduleId === "m3") renderPlanCoverage();
  if (!event || moduleId === "m4") showReadiness();
  tell("Tienes cambios en el borrador.");
  refreshDelivery();
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
  const keys = {m1:["productivos","procesos","tareas"],m2:["m2"],m3:["planes","m3"],m4:["m4","objetivos","contratistas","indicadores","anexos"]};
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
  showStep(0,false);
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
  if (moduleId==="m2") two={filas:rowValues("m2")};
  if (moduleId==="m3") three={planesDetallados:rowValues("planes"),filas:rowValues("m3")};
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
    const hours=trainingHours(three.filas,three.planesDetallados);
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
  for (const [title, criteria] of reviewGroups) {
    const section = element("details");
    section.className = "module-details";
    section.append(element("summary",title));
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
      group.append(controls);
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
  if (!response.ok || !data) throw new Error(data?.error ?? "No se pudo contactar al Constructor. Vuelve a abrirlo desde Moodle.");
  return data;
}

function formValues() {
  return [...new FormData(form)].map(([path, value]) => [path, value.trim()]);
}

function draftFingerprint(values = formValues()) {
  return JSON.stringify([values, [...editors.keys()].map(rowValues)]);
}

function refreshDelivery() {
  const dirty = draftFingerprint() !== savedValues;
  const current = lastDelivery?.revision === revision && !dirty;
  deliver.disabled = busy || current;
  deliver.textContent = current ? "Entrega registrada" : "Entregar para revisión";
  if (!lastDelivery) return;

  const date = new Date(lastDelivery.submittedAt);
  const when = Number.isNaN(date.valueOf()) ? "" :
    new Intl.DateTimeFormat("es-VE", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Caracas" }).format(date);
  receipt.hidden = false;
  document.getElementById("receipt-title").textContent = current ? "✓ Entrega registrada" : "✓ Última entrega registrada";
  document.getElementById("receipt-detail").textContent =
    (when ? when + " · Hora de Venezuela. " : "") +
    "Comprobación automática: " + lastDelivery.automaticPoints + " de 60 puntos. Pendiente de revisión técnica." +
    (current ? "" : " Tienes un borrador más reciente que aún no has entregado.");
}

async function saveIfChanged() {
  const values = formValues();
  const fingerprint = draftFingerprint(values);
  if (fingerprint === savedValues) return;
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
  if (new TextEncoder().encode(JSON.stringify(next)).length > 230000) {
    throw new Error("El borrador supera el tamaño disponible. Usa referencias para el material extenso.");
  }
  const saved = await api("draft", { revision, draft: next });
  draft = next;
  revision = saved.revision;
  savedValues = fingerprint;
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
    tell(error.message, "error");
  } finally {
    inputs.forEach(input => { input.readOnly = false; });
    busy = false;
    save.disabled = false;
    disabledDuringSave.forEach(control => { control.disabled = false; });
    for (const [key, editor] of editors) updateRowLabels(key,editor);
    refreshDelivery();
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
    pending = undefined;
    tell("✓ Entrega registrada. " + lastDelivery.automaticPoints + " de 60 puntos automáticos. Pendiente de revisión.", "success");
  });
});

function downloadHtml(documentText, filename) {
  const url = URL.createObjectURL(new Blob([documentText], { type: "text/html;charset=utf-8" }));
  const link = element("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function setupGanttDownload(info) {
  if (info.moduleId !== "m3") return;
  function downloadSchedule(includePlans) {
    if (busy) return;
    const documentText = buildGanttDocument({
      label: info.label, activities: rowValues("m3"), plans: rowValues("planes"), includePlans,
      riskRows: info.inputs?.m2?.data?.m2?.filas,
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

async function start() {
  if (!ticket) throw new Error("Abre la actividad desde el curso en Moodle.");
  const auth = await api("exchange", { ticket });
  session = auth.session;
  const info = await api("workspace");
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
  if (lastDelivery?.revision === revision) {
    tell("✓ Entrega registrada. " + lastDelivery.automaticPoints + " de 60 puntos automáticos. Pendiente de revisión.", "success");
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
