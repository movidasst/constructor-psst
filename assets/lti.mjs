const apiRoot = "https://edeydaueyxilutczhazm.supabase.co/functions/v1/psst-lti/";
const status = document.getElementById("status");
const form = document.getElementById("draft");
const deliver = document.getElementById("deliver");
const ticket = new URLSearchParams(location.hash.slice(1)).get("ticket");
if (location.hash) history.replaceState(null, "", location.pathname + location.search);

let session;
let revision;
let draft;
let pending;
const tell = message => { status.textContent = message; };

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

function currentDraft() {
  const next = structuredClone(draft);
  for (const [path, value] of new FormData(form)) {
    const [group, key] = path.split(".");
    if (!next[group] || typeof next[group] !== "object" || Array.isArray(next[group])) next[group] = {};
    next[group][key] = path === "bitacora.horas" ? (value.trim() ? Number(value) : null) : value.trim();
  }
  return next;
}

async function saveIfChanged() {
  const next = currentDraft();
  if (JSON.stringify(next) === JSON.stringify(draft)) return;
  const saved = await api("draft", { revision, draft: next });
  draft = next;
  revision = saved.revision;
  pending = undefined;
}

async function update(action) {
  const buttons = [...form.querySelectorAll("button")];
  buttons.forEach(button => { button.disabled = true; });
  try {
    await action();
  } catch (error) {
    tell(error.message);
  } finally {
    buttons.forEach(button => { button.disabled = false; });
  }
}

form.addEventListener("submit", event => {
  event.preventDefault();
  void update(async () => {
    await saveIfChanged();
    tell("Borrador guardado.");
  });
});

deliver.addEventListener("click", () => {
  if (!form.reportValidity()) return;
  void update(async () => {
    await saveIfChanged();
    pending ??= crypto.randomUUID();
    const result = await api("submit", { revision, requestId: pending });
    pending = undefined;
    tell("Entrega registrada. Comprobación automática: " + result.automaticPoints + " de 60. Falta la revisión técnica.");
  });
});

async function start() {
  if (!ticket) throw new Error("Abre la actividad desde el curso en Moodle.");
  const auth = await api("exchange", { ticket });
  session = auth.session;
  const info = await api("workspace");
  if (info.moduleId !== "m1") {
    tell("Tu proyecto está vinculado. Este módulo se habilitará cuando su entrega esté lista.");
    return;
  }
  document.getElementById("workspace").textContent = "Módulo 1 · " + info.label;
  draft = info.draft;
  revision = info.revision;
  for (const input of form.querySelectorAll("[name]")) {
    const [group, key] = input.name.split(".");
    const value = draft[group]?.[key];
    input.value = typeof value === "string" || typeof value === "number" ? value : "";
  }
  form.hidden = false;
  tell("Completa la ficha, guarda tu borrador o envía una versión para revisión.");
}

start().catch(error => tell(error.message));
