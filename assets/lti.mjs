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

function refreshDelivery() {
  const dirty = JSON.stringify(formValues()) !== savedValues;
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
  const fingerprint = JSON.stringify(values);
  if (fingerprint === savedValues) return;
  const next = structuredClone(draft);
  for (const [path, value] of values) {
    const [group, key] = path.split(".");
    if (!next[group] || typeof next[group] !== "object" || Array.isArray(next[group])) next[group] = {};
    next[group][key] = path === "bitacora.horas" ? (value ? Number(value) : null) : value;
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
    refreshDelivery();
  }
}

form.addEventListener("input", () => {
  tell("Tienes cambios en el borrador.");
  refreshDelivery();
});

form.addEventListener("submit", event => {
  event.preventDefault();
  void update("Guardando el borrador…", async () => {
    await saveIfChanged();
    tell("✓ Borrador guardado.", "success");
  });
});

deliver.addEventListener("click", () => {
  if (busy || deliver.disabled) return;
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
  savedValues = JSON.stringify(formValues());
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
