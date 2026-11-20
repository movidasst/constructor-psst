import { reviewGroups } from "./psst-review.mjs?v=linked-1";

import { annexStructure, chapterKey, chapterStructure } from "./psst-chapters.mjs?v=chapters-1";

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

export function scheduledActivities(activities) {
  return rows(activities).filter(row => hasValue(row.actividad)
    && /^(?:[1-9]|1[0-2])$/.test(row.inicio)
    && /^(?:[1-9]|1[0-2])$/.test(row.fin) && Number(row.inicio) <= Number(row.fin));
}

function ganttTable(scheduled, includeDetails = false) {
  const columns = includeDetails
    ? [["Plan","plan"],["Actividad","actividad"],["Responsable","responsable"]]
    : [["Actividad","actividad"]];
  return table([...columns,...months.map((month,index)=>[month,index+1])],
    scheduled.map(row=>({...row,...Object.fromEntries(months.map((_,index)=>
      [index+1,index+1>=Number(row.inicio) && index+1<=Number(row.fin) ? "●" : ""]))})));
}

export function buildGanttDocument({ label, activities, plans = [], legacyReference }) {
  const scheduled = scheduledActivities(activities).map(row => {
    const plan = plans.find(item=>item.id===row.planRef);
    return {...row,plan:plan ? [plan.codigo,plan.nombre].filter(Boolean).join(" · ") : row.plan};
  });
  const incomplete = rows(activities).filter(row=>hasValue(row.actividad)).length - scheduled.length;
  if (!scheduled.length && !hasValue(legacyReference)) return "";
  const chart = ganttTable(scheduled,true);
  return `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Carta Gantt 2027</title>
<style>@page{size:A4 landscape;margin:12mm}body{font:14px system-ui,sans-serif;color:#183047;max-width:1150px;margin:1.5rem auto;padding:0 1rem}
header{border-top:5px solid #007b85;padding:.65rem 0}h1{color:#00205b;margin:.4rem 0}.note{white-space:pre-wrap;overflow-wrap:anywhere}.calendar{overflow-x:auto}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px}
th,td{padding:5px;border:1px solid #bbced2;text-align:center;overflow-wrap:anywhere;vertical-align:top}th{background:#e3f1f1}td:nth-child(-n+3),th:nth-child(-n+3){text-align:left}th:nth-child(1){width:13%}th:nth-child(2){width:23%}th:nth-child(3){width:14%}td:nth-child(n+4){color:#005861;font-weight:700}
@media print{body{max-width:none;margin:0;padding:0}.calendar{overflow:visible}table{font-size:8.5pt}thead{display:table-header-group}tr{break-inside:avoid}}</style>
<body><header><p>Academia Movida de SST · Taller práctico de PSST</p><h1>Carta Gantt 2027</h1><p>${escape(label)} · Cronograma de los planes de trabajo</p></header>
${chart ? '<p>● Mes de ejecución programado</p><div class="calendar">'+chart+'</div>' : ""}
${incomplete ? "<p>Actividades con fechas pendientes o inválidas: "+incomplete+".</p>" : ""}
${hasValue(legacyReference) ? "<h2>Referencia al cronograma anterior</h2>"+note(legacyReference) : ""}
</body></html>`;
}

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
  const gantt = ganttTable(scheduledActivities(activities));
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
  const recovered = {
    cap3_organigrama: hasValue(one.alcance?.organigrama),
    cap3_diagramas: hasValue(one.flujo?.referencia) || processRows.some(row=>hasValue(row.evidencia)),
    cap3_riesgos: matrix.length>0 || hasValue(two.matriz),
    cap3_validacion: hasValue(one.mesa?.asamblea),
    cap4_prioridades: activities.some(row=>hasValue(row.hallazgo)),
    cap4_estructura: planRows.length>0,
    cap4_presupuesto: planRows.some(row=>hasValue(row.recursos)),
    cap4_cronograma: Boolean(gantt) || hasValue(three.gantt),
    cap6_carta: hasValue(four.compromiso),
  };
  const chapterSections = chapterStructure.map(([title,sections], index) => {
    const number = index+1;
    const legacy = note(four["cap"+number]);
    const content = sections.map(([key,section]) => {
      const field = chapterKey(number,key);
      const placeholder = recovered[field]
        ? "Hay información de apoyo incorporada en este capítulo. Completa o valida la redacción del apartado."
        : "Pendiente de completar o indicar su referencia.";
      return "<h3>"+escape(section)+"</h3>"+(note(four[field]) || '<p class="pending">'+placeholder+'</p>');
    }).join("");
    return "<section><h2>Capítulo "+number+" · "+escape(title)+"</h2>"+
      (legacy ? "<h3>Notas generales o referencia adicional</h3>"+legacy : "")+content+(extras[index]??"")+"</section>";
  }).join("");
  const annexIndex = table([["Apartado","label"],["Referencia","value"]],annexStructure.map(([key,label])=>({
    label,value:hasValue(four["anexo_"+key]) ? four["anexo_"+key] : "Pendiente de identificar",
  })));
  return `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Borrador del PSST</title>
<style>body{font:15px system-ui,sans-serif;max-width:1020px;margin:2rem auto;padding:0 1.2rem;color:#183047}h1,h2,h3{color:#00205b}h2{border-bottom:1px solid #bad9d9;padding-bottom:.35rem}header{border-top:5px solid #007b85;padding-top:.8rem}.note,td{white-space:pre-wrap;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%;font-size:.86rem;margin:1rem 0}th,td{border:1px solid #d1e2e7;padding:.35rem;text-align:left;vertical-align:top}th{background:#e3f1f1}.pending{color:#6d4b08}@media print{body{margin:0;padding:0}table{font-size:8pt}thead{display:table-header-group}tr{break-inside:avoid}}</style>
<body><header><p>Academia Movida de SST · Taller práctico de PSST</p><h1>Borrador del Programa de Seguridad y Salud en el Trabajo</h1><p>${escape(label)} · Versión de trabajo para revisión</p></header>
<h2>Introducción</h2>${note(four.introduccion) || '<p class="pending">Pendiente de redactar la introducción.</p>'}
<h2>Fuentes del taller</h2>${facts([1,2,3].map(n => {
  const source = inputs["m"+n];
  return ["Módulo "+n,source?.submittedAt ? "Última entrega registrada" : "Borrador de trabajo, entrega por verificar"];
}))}
${chapterSections}
<h2>Índice de anexos y soportes</h2>${annexIndex}
<h2>Anexo · Evidencias y brechas</h2>
${facts([["Organización de la mesa",one.mesa?.organizacion],["Bitácora",one.bitacora?.referencia],["Horas",one.bitacora?.horas],
 ["Registro de campo",one.bitacora?.evidencias],["Pendientes de campo",one.bitacora?.pendientes],["Evidencias",four.evidencia],
 ["Participación y revisión",four.validacion],["Revisión del SSST y Comité",four.cssl],["Resultado de la revisión",four.resultado],["Acciones pendientes",four.pendientes],
 ["Borrador anterior",four.borrador],["Brechas anteriores",four.brechas]])}
${table([["Capítulo","capitulo"],["Brecha","brecha"],["Acción","accion"],["Responsable","responsable"],["Plazo","plazo"],["Evidencia","evidencia"]],rows(four.filas))}<h2>Anexo · Contraste con los instrumentos</h2>
${table([["Capítulo","chapter"],["Criterio","label"],["Estado","state"],["Evidencia u observación","note"]],reviews)}</body></html>`;
}
