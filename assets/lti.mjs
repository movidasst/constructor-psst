import { buildGanttDocument, buildPsstDocument, scheduledActivities } from "./psst-document.mjs?v=print-1";
import { reviewGroups } from "./psst-review.mjs?v=linked-1";

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
  procesos: { group:"flujo", key:"procesos", singular:"Proceso", fields:[
    ["codigo","Código (p. ej., P-01)",true], ["nombre","Nombre del proceso de trabajo",true],
    ["area","Área o departamento"], ["entradas","Entradas, materiales y sustancias"],
    ["secuencia","Etapas y organización del trabajo"], ["salidas","Productos, residuos y disposición"],
    ["contratistas","Contratistas e interacciones"], ["evidencia","Diagrama, croquis u otra evidencia"],
  ] },
  tareas: { group:"tarea", key:"actividades", singular:"Tarea", fields:[
    ["codigo","Código (p. ej., T-01)",true], ["procesoRef","Proceso del inventario",true,"procesos"],
    ["etapa","Etapa",true], ["nombre","Tarea observada",true], ["descripcion","Secuencia real de la tarea",true],
    ["puestos","Puestos y personal expuesto"], ["medios","Herramientas, equipos y objetos"],
    ["organizacion","Turnos, ritmo y organización"], ["evidencia","Fuente o evidencia"],
  ] },
  planes: { group:"m3", key:"planesDetallados", singular:"Plan", fields:[
    ["codigo","Código del plan",true], ["nombre","Nombre del plan",true],
    ["familia","Familia de plan",true,"familias"], ["riesgoRef","Hallazgo prioritario",false,"riesgos"],
    ["objetivo","Objetivo",true], ["meta","Meta verificable",true], ["alcance","Alcance",true],
    ["frecuencia","Frecuencia",true], ["responsable","Personal y responsabilidades",true],
    ["procedimiento","Procedimiento de ejecución",true], ["instrumentos","Formularios e instrumentos",true],
    ["recursos","Recursos y presupuesto",true], ["seguimiento","Indicador o evidencia",true],
  ] },
  m2: { group:"m2", key:"filas", singular: "Riesgo", fields: [
    ["codigo","Código del hallazgo (p. ej., R-01)",true], ["tareaRef","Tarea registrada en M1",false,"tareas"],
    ["proceso","Proceso peligroso asociado"],
    ["etapa","Etapa o tarea",true], ["peligro","Peligro o condición observada",true],
    ["riesgo","Riesgo y posible consecuencia",true], ["expuestos","Personas o puestos expuestos"],
    ["controles","Controles existentes"], ["valoracion","Valoración según el método elegido"],
    ["evidencia","Referencia de la evidencia"], ["pendiente","Pendiente de evaluación"],
  ] },
  m3: { group:"m3", key:"filas", singular: "Actividad", fields: [
    ["planRef","Plan de trabajo",true,"planes"], ["plan","Nombre del plan en una versión anterior"],
    ["actividad","Actividad preventiva",true], ["riesgoRef","Hallazgo de M2",false,"riesgos"], ["hallazgo","Referencia complementaria del hallazgo"], ["responsable","Responsable",true],
    ["inicio","Mes de inicio",true,"month"], ["fin","Mes de cierre",true,"month"],
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

const families = [
  "Educación e información", "Inducción y cambios de puesto", "Inspecciones",
  "Monitoreo de riesgos y condiciones de trabajo", "Vigilancia epidemiológica de la salud",
  "Utilización del tiempo libre", "Reglas y procedimientos de trabajo seguro",
  "Protección personal y colectiva", "Atención preventiva de la salud", "Ingeniería, ergonomía y mantenimiento",
  "Contingencias y emergencias", "Desalojo de instalaciones", "Recursos económicos",
];

function rowValues(key) {
  const editor = editors.get(key);
  if (!editor) return [];
  return [...editor.querySelectorAll(".row-card")].map(row => ({
    id: row.dataset.id,
    ...Object.fromEntries([...row.querySelectorAll("[data-key]")].map(input => [input.dataset.key, input.value.trim()])),
  }));
}

function choices(type) {
  const data = type === "procesos" || type === "planes" ? rowValues(type)
    : type === "tareas" ? (integrationInputs.m1?.data?.tarea?.actividades ?? [])
    : (integrationInputs.m2?.data?.m2?.filas ?? []);
  if (type === "familias") return families.map(name => [name,name]);
  return (Array.isArray(data) ? data : []).filter(row => row.id && (row.nombre || row.riesgo))
    .map(row => [row.id, [row.codigo,row.nombre || row.riesgo].filter(Boolean).join(" · ")]);
}

function fillSelect(field, available, value) {
  field.replaceChildren(new Option("Selecciona", ""));
  for (const [id,name] of available) field.add(new Option(name,id));
  if (value && !available.some(([id]) => id === value)) field.add(new Option("Referencia anterior · revisa el vínculo",value));
  field.value = value;
}

function refreshLinks() {
  for (const editor of editors.values()) {
    for (const control of editor.querySelectorAll("[data-link]")) {
      fillSelect(control,choices(control.dataset.link),control.value);
    }
  }
}

function redrawGantt() {
  if (moduleId !== "m3") return;
  const view = document.getElementById("gantt-view");
  const rows = scheduledActivities(rowValues("m3"));
  if (!rows.length) {
    view.replaceChildren(element("p", "Agrega una actividad y elige sus meses para ver el cronograma."));
    return;
  }
  const table = element("table");
  table.setAttribute("aria-label", "Carta Gantt 2027");
  const header = table.createTHead().insertRow();
  for (const label of ["Actividad", ...months]) {
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
    for (let month = 1; month <= 12; month++) {
      const cell = line.insertCell();
      if (month >= Number(row.inicio) && month <= Number(row.fin)) {
        cell.dataset.active = "";
        cell.textContent = "●";
        cell.setAttribute("aria-label", "Programada en " + months[month - 1]);
      }
    }
  }
  view.replaceChildren(table);
}

function updateRowLabels(key, editor) {
  const schema = rowSchemas[key];
  const rows = [...editor.querySelectorAll(".row-card")];
  rows.forEach((row, index) => {
    const label = schema.singular + " " + (index + 1);
    row.querySelector("legend").textContent = label;
    row.querySelector("button").setAttribute("aria-label", "Quitar " + label.toLowerCase());
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
  if (!event || ["actividad","inicio","fin"].includes(key)) redrawGantt();
  if (!event || ["familia","nombre"].includes(key)) renderPlanCoverage();
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
    const field = element(type ? "select" : "input");
    const value = typeof values?.[key] === "string" ? values[key] : "";
    if (type === "month") {
      field.add(new Option("Elige un mes", ""));
      months.forEach((month,index) => field.add(new Option(month, String(index + 1))));
    } else if (type) {
      field.dataset.link = type;
      fillSelect(field,choices(type),value);
    } else {
      field.maxLength = 800;
    }
    field.dataset.key = key;
    field.required = Boolean(required) && !(key === "planRef" && values.plan && !values.planRef)
      && !(key === "codigo" && !focus && !value);
    field.value = value;
    if (editorKey === "m3" && key === "plan" && !value) wrapper.hidden = true;
    wrapper.append(field);
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
  row.append(element("legend"), fields, remove);
  editor.querySelector("[data-rows]").append(row);
  updateRowLabels(editorKey, editor);
  if (focus) fields.querySelector("[data-key]").focus();
}

function setupRows(info) {
  moduleId = info.moduleId;
  integrationInputs = info.inputs ?? {};
  const keys = {m1:["procesos","tareas"],m2:["m2"],m3:["planes","m3"],m4:["m4"]};
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
  const covered = new Set(rowValues("planes").filter(row => row.nombre).map(row => row.familia));
  const list = element("ul");
  for (const family of families) {
    list.append(element("li", family + " · " + (covered.has(family) ? "Con ficha de plan" : "Por documentar")));
  }
  view.replaceChildren(list);
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
    control.setCustomValidity(control.value && !available.some(([id]) => id === control.value)
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
    rowValues("planes").findIndex(row => !row.riesgoRef);
  for (const [index,key,field,message] of [
    [riskWithoutTask,"m2","tareaRef","Selecciona la tarea de M1 para cada hallazgo nuevo."],
    [planWithoutRisk,"planes","riesgoRef","Relaciona cada plan nuevo con un hallazgo prioritario de M2."],
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
  if (moduleId === "m3" && rowValues("m3").some(row =>
    row.inicio && row.fin && Number(row.fin) < Number(row.inicio))) {
    revealControl(editors.get("m3")?.querySelector("select"));
    tell("El mes de cierre debe ser igual o posterior al de inicio.", "error");
    return;
  }
  if (!validateForm()) return;
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
  document.getElementById("export-gantt").addEventListener("click", () => {
    if (busy) return;
    const documentText = buildGanttDocument({
      label: info.label, activities: rowValues("m3"), plans: rowValues("planes"),
      legacyReference: form.elements.namedItem("m3.gantt").value.trim(),
    });
    if (!documentText) {
      tell("Registra una actividad con los meses de inicio y cierre antes de descargar.", "error");
      return;
    }
    downloadHtml(documentText, "Carta_Gantt_2027.html");
    tell("Carta Gantt preparada. Ábrela para imprimirla o guardarla como PDF.", "success");
  });
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
    m2: ["Procesos peligrosos y evaluación de riesgos",
      "Registra lo observado en campo y entrega la matriz inicial de riesgos para revisión."],
    m3: ["Planes de trabajo y carta Gantt 2027",
      "Organiza las acciones preventivas, los responsables y el cronograma para 2027."],
    m4: ["Integración y revisión final del PSST",
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
  setupReview();
  revision = info.revision;
  lastDelivery = info.delivery;
  for (const input of form.querySelectorAll("[name]")) {
    const [group, key] = input.name.split(".");
    const value = draft[group]?.[key];
    input.value = typeof value === "string" || typeof value === "number" ? value : "";
  }
  setupRows(info);
  setupDocument(info);
  setupGanttDownload(info);
  setupSteps();
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
