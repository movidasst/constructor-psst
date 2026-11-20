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
  m2: { singular: "Riesgo", fields: [
    ["etapa","Etapa o tarea",true], ["peligro","Peligro o condición observada",true],
    ["riesgo","Riesgo y posible consecuencia",true], ["expuestos","Personas o puestos expuestos"],
    ["controles","Controles existentes"], ["valoracion","Valoración según el método elegido"],
    ["evidencia","Referencia de la evidencia"], ["pendiente","Pendiente de evaluación"],
  ] },
  m3: { singular: "Actividad", fields: [
    ["plan","Plan de trabajo",true], ["actividad","Actividad preventiva",true],
    ["hallazgo","Hallazgo o riesgo de origen"], ["responsable","Responsable",true],
    ["inicio","Mes de inicio",true,"month"], ["fin","Mes de cierre",true,"month"],
    ["recursos","Recursos previstos"], ["seguimiento","Indicador o evidencia de ejecución"],
  ] },
  m4: { singular: "Brecha", fields: [
    ["capitulo","Capítulo o sección"], ["brecha","Brecha o hallazgo",true],
    ["accion","Acción para atenderla"], ["responsable","Responsable"],
    ["plazo","Plazo o fecha acordada"], ["evidencia","Evidencia o referencia"],
  ] },
};
let editor;
let moduleId;

function element(tag, content) {
  const node = document.createElement(tag);
  if (content !== undefined) node.textContent = content;
  return node;
}

function rowValues() {
  if (!editor) return [];
  return [...editor.querySelectorAll(".row-card")].map(row =>
    Object.fromEntries([...row.querySelectorAll("[data-key]")].map(input => [input.dataset.key, input.value.trim()]))
  );
}

function redrawGantt() {
  if (moduleId !== "m3") return;
  const view = document.getElementById("gantt-view");
  const rows = rowValues().filter(row => row.actividad && Number(row.inicio) >= 1 && Number(row.fin) >= Number(row.inicio));
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

function updateRowLabels() {
  const schema = rowSchemas[moduleId];
  const rows = [...editor.querySelectorAll(".row-card")];
  rows.forEach((row, index) => {
    const label = schema.singular + " " + (index + 1);
    row.querySelector("legend").textContent = label;
    row.querySelector("button").setAttribute("aria-label", "Quitar " + label.toLowerCase());
  });
  editor.querySelector("[data-add]").disabled = busy || rows.length >= 30;
}

function rowChanged() {
  redrawGantt();
  tell("Tienes cambios en el borrador.");
  refreshDelivery();
}

function appendRow(values = {}, focus = false) {
  const row = element("fieldset");
  row.className = "row-card";
  const fields = element("div");
  fields.className = "fields";
  for (const [key, label, required, type] of rowSchemas[moduleId].fields) {
    const wrapper = element("label", label);
    const field = element(type === "month" ? "select" : "input");
    if (type === "month") {
      field.add(new Option("Elige un mes", ""));
      months.forEach((month,index) => field.add(new Option(month, String(index + 1))));
    } else {
      field.maxLength = 300;
    }
    field.dataset.key = key;
    field.required = Boolean(required);
    field.value = typeof values?.[key] === "string" ? values[key] : "";
    wrapper.append(field);
    fields.append(wrapper);
  }
  const remove = element("button", "Quitar fila");
  remove.type = "button";
  remove.dataset.remove = "";
  remove.addEventListener("click", () => {
    if (busy) return;
    row.remove();
    updateRowLabels();
    editor.querySelector("[data-add]").focus();
    rowChanged();
  });
  row.append(element("legend"), fields, remove);
  editor.querySelector("[data-rows]").append(row);
  updateRowLabels();
  if (focus) fields.querySelector("[data-key]").focus();
}

function setupRows(info) {
  moduleId = info.moduleId;
  if (!rowSchemas[moduleId]) return;
  editor = form.querySelector('[data-editor="' + moduleId + '"]');
  if (!editor) return;
  const values = info.draft?.[moduleId]?.filas;
  if (Array.isArray(values)) values.slice(0,30).forEach(row => appendRow(row));
  editor.querySelector("[data-add]").addEventListener("click", () => {
    if (busy || rowValues().length >= 30) return;
    appendRow({}, true);
    rowChanged();
  });
  redrawGantt();
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
  return JSON.stringify([values, rowValues()]);
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
  if (editor) {
    next[moduleId] ??= {};
    next[moduleId].filas = rowValues();
    if (new TextEncoder().encode(JSON.stringify(next)).length > 58000) {
      throw new Error("El borrador supera el tamaño disponible. Usa referencias para el material extenso.");
    }
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
  const disabledDuringSave = editor ? [...editor.querySelectorAll("select, [data-remove]")] : [];
  disabledDuringSave.forEach(control => { control.disabled = true; });
  if (editor) updateRowLabels();
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
    if (editor) updateRowLabels();
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
  if (editor && moduleId === "m3" && rowValues().some(row =>
    row.inicio && row.fin && Number(row.fin) < Number(row.inicio))) {
    tell("El mes de cierre debe ser igual o posterior al de inicio.", "error");
    return;
  }
  if (!form.reportValidity()) {
    tell("Corrige el campo marcado antes de entregar.", "error");
    return;
  }
  void update("Enviando la entrega…", async () => {
    await saveIfChanged();
    pending ??= crypto.randomUUID();
    lastDelivery = await api("submit", { revision, requestId: pending });
    pending = undefined;
    tell("✓ Entrega registrada. " + lastDelivery.automaticPoints + " de 60 puntos automáticos. Pendiente de revisión.", "success");
  });
});

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
  document.getElementById("m1-nav").hidden = info.moduleId !== "m1";
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
  draft = info.draft;
  revision = info.revision;
  lastDelivery = info.delivery;
  for (const input of form.querySelectorAll("[name]")) {
    const [group, key] = input.name.split(".");
    const value = draft[group]?.[key];
    input.value = typeof value === "string" || typeof value === "number" ? value : "";
  }
  setupRows(info);
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
