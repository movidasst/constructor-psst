import { reviewGroups } from "./psst-review.mjs?v=linked-1";

const chapters = [
  "Generalidades", "Política de Seguridad y Salud en el Trabajo",
  "Proceso productivo, procesos de trabajo y procesos peligrosos", "Planes de trabajo",
  "Investigación de accidentes de trabajo y enfermedades ocupacionales",
  "Compromiso de cumplimiento", "Otras consideraciones", "Evaluación del programa",
];
const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const escape = value => String(value ?? "").replace(/[&<>"']/g, c =>
  ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
const hasValue = value => (typeof value === "string" && Boolean(value.trim())) || typeof value === "number";
const note = value => hasValue(value) ? "<p class=\"note\">" + escape(value) + "</p>" : "";
const table = (columns, rows) => rows.length ? '<table><thead><tr>' +
  columns.map(([label]) => '<th scope="col">'+escape(label)+'</th>').join("") +
  '</tr></thead><tbody>' + rows.map(row => "<tr>" +
    columns.map(([,key]) => '<td>'+escape(row[key])+'</td>').join("") + "</tr>").join("") +
  "</tbody></table>" : "";
const rows = value => Array.isArray(value) ? value.filter(row => row && Object.values(row).some(hasValue)) : [];
const facts = entries => table([["Dato","label"],["Registro","value"]],
  entries.filter(([,value]) => hasValue(value)).map(([label,value]) => ({label,value})));

export function buildPsstDocument({ label, inputs = {}, draft = {} }) {
  const one = inputs.m1?.data ?? {};
  const two = inputs.m2?.data?.m2 ?? {};
  const three = inputs.m3?.data?.m3 ?? {};
  const four = draft.m4 ?? {};
  const processRows = rows(one.flujo?.procesos);
  const taskRows = rows(one.tarea?.actividades);
  const planRows = rows(three.planesDetallados);
  const riskRows = rows(two.filas);
  const labelFor = (records,ref) => records.find(record=>record.id===ref)?.codigo || (ref ? "Referencia por verificar" : "");
  const matrix = riskRows.map(row => ({...row,tareaCodigo:labelFor(taskRows,row.tareaRef)}));
  const activities = rows(three.filas).map(row => ({...row,plan:labelFor(planRows,row.planRef) || row.plan,
    hallazgo:labelFor(riskRows,row.riesgoRef) || row.hallazgo}));
  const reviews = reviewGroups.flatMap(([chapter,criteria]) => criteria.map(([key,label]) =>
    ({chapter,label,state:four["estado_"+key] || "Por revisar",note:four["nota_"+key]})));
  const scheduled = activities.filter(r => r.actividad && /^[1-9]$|^1[0-2]$/.test(r.inicio)
    && /^[1-9]$|^1[0-2]$/.test(r.fin) && Number(r.inicio) <= Number(r.fin));
  const gantt = table([["Actividad","actividad"],...months.map((month,index) => [month,index + 1])],
    scheduled.map(r => Object.assign({ actividad:r.actividad }, Object.fromEntries(months.map((_,index) =>
      [index+1,index+1 >= Number(r.inicio) && index+1 <= Number(r.fin) ? "●" : ""])))));
  const process = facts([
    ["Centro",one.alcance?.centro],["Área, turno y alcance",one.alcance?.area],
    ["Organigrama y estructura del SSST",one.alcance?.organigrama],
    ["Proceso",one.flujo?.proceso],["Secuencia",one.flujo?.secuencia],["Diagrama",one.flujo?.referencia],
    ["Etapa y tarea",one.tarea?.etapa],["Descripción",one.tarea?.descripcion],
    ["Participación",one.mesa?.metodo],["Aportes",one.mesa?.aportes],["Referencia",one.mesa?.referencia],["Asamblea",one.mesa?.asamblea],
    ["Método de evaluación",two.metodo],["Alcance de evaluación",two.etapa],["Observaciones",two.procesos],
  ]);
  const risks = table([
    ["ID","codigo"],["Tarea","tareaCodigo"],["Etapa","etapa"],["Proceso peligroso","proceso"],["Peligro","peligro"],["Riesgo / daño","riesgo"],
    ["Exposición","expuestos"],["Controles","controles"],["Valoración","valoracion"],
    ["Evidencia","evidencia"],["Por evaluar","pendiente"],
  ],matrix);
  const plans = table([
    ["Plan","plan"],["Actividad","actividad"],["Hallazgo","hallazgo"],["Objetivo / meta","objetivo"],
    ["Frecuencia","frecuencia"],["Procedimiento / instrumento","procedimiento"],["Responsable","responsable"],
    ["Recursos / presupuesto","recursos"],["Seguimiento","seguimiento"],
  ],activities);
  const inventory = table([
    ["Código","codigo"],["Proceso","nombre"],["Área","area"],["Entradas","entradas"],["Secuencia","secuencia"],
    ["Salidas","salidas"],["Contratistas","contratistas"],["Evidencia","evidencia"],
  ],processRows);
  const tasks = table([
    ["Código","codigo"],["Proceso","proceso"],["Etapa","etapa"],["Tarea","nombre"],["Descripción","descripcion"],
    ["Puestos y exposición","puestos"],["Medios","medios"],["Organización","organizacion"],["Evidencia","evidencia"],
  ],taskRows.map(row=>({...row,proceso:labelFor(processRows,row.procesoRef)})));
  const planSheets = planRows.map(row => "<h4>"+escape([row.codigo,row.nombre].filter(Boolean).join(" · "))+"</h4>"+facts([
    ["Familia",row.familia],["Hallazgo",labelFor(riskRows,row.riesgoRef)],["Objetivo",row.objetivo],
    ["Meta",row.meta],["Alcance",row.alcance],["Frecuencia",row.frecuencia],["Responsables",row.responsable],
    ["Procedimiento",row.procedimiento],["Instrumentos",row.instrumentos],["Recursos",row.recursos],["Seguimiento",row.seguimiento],
  ])).join("");
  const extras = {
    2: process + (inventory ? "<h3>Inventario de procesos</h3>"+inventory : "") +
      (tasks ? "<h3>Etapas y tareas</h3>"+tasks : "") + (risks ? "<h3>Matriz inicial de riesgos</h3>"+risks : "") +
      facts([["Matriz anterior o referencia",two.matriz],["Evaluaciones pendientes",two.pendientes],["Evidencia de campo",two.evidencia]]),
    3: (planSheets ? "<h3>Fichas de los planes</h3>"+planSheets : "") + plans + note(three.cobertura) + (gantt ? "<h3>Carta Gantt 2027</h3>"+gantt : "") +
      facts([["Planes anteriores",three.planes],["Cronograma anterior",three.gantt],["Responsables",three.responsables],["Recursos",three.recursos],["Seguimiento",three.seguimiento]]),
    5: note(four.compromiso),
  };
  return `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Borrador del PSST</title>
<style>body{font:15px system-ui,sans-serif;max-width:1020px;margin:2rem auto;padding:0 1.2rem;color:#183047}h1,h2,h3{color:#00205b}h2{border-bottom:1px solid #bad9d9;padding-bottom:.35rem}header{border-top:5px solid #007b85;padding-top:.8rem}.note,td{white-space:pre-wrap;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%;font-size:.86rem;margin:1rem 0}th,td{border:1px solid #d1e2e7;padding:.35rem;text-align:left;vertical-align:top}th{background:#e3f1f1}.pending{color:#6d4b08}@media print{body{margin:0;padding:0}table{font-size:8pt}thead{display:table-header-group}tr{break-inside:avoid}}</style>
<body><header><p>Academia Movida de SST · Taller práctico de PSST</p><h1>Borrador del Programa de Seguridad y Salud en el Trabajo</h1><p>${escape(label)} · Versión de trabajo para revisión</p></header>
<h2>Fuentes del taller</h2>${facts([1,2,3].map(n => {
  const source = inputs["m"+n];
  return ["Módulo "+n,source?.submittedAt ? "Última entrega registrada" : "Borrador de trabajo, entrega por verificar"];
}))}
${chapters.map((title,index) => '<section><h2>Capítulo '+(index+1)+' · '+title+'</h2>'+
  (note(four["cap"+(index+1)]) || "<p class=pending>Texto del capítulo pendiente de elaborar o validar.</p>")+
  (extras[index]??"")+'</section>').join("")}
<h2>Anexo · Evidencias y brechas</h2>
${facts([["Organización de la mesa",one.mesa?.organizacion],["Bitácora",one.bitacora?.referencia],["Horas",one.bitacora?.horas],
 ["Registro de campo",one.bitacora?.evidencias],["Pendientes de campo",one.bitacora?.pendientes],["Evidencias",four.evidencia],
 ["Participación y revisión",four.validacion],["Revisión del SSST y Comité",four.cssl],["Resultado de la revisión",four.resultado],["Acciones pendientes",four.pendientes],
 ["Borrador anterior",four.borrador],["Brechas anteriores",four.brechas]])}
${table([["Capítulo","capitulo"],["Brecha","brecha"],["Acción","accion"],["Responsable","responsable"],["Plazo","plazo"],["Evidencia","evidencia"]],rows(four.filas))}<h2>Anexo · Contraste con los instrumentos</h2>
${table([["Capítulo","chapter"],["Criterio","label"],["Estado","state"],["Evidencia u observación","note"]],reviews)}</body></html>`;
}
