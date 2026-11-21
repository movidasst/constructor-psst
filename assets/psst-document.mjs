import { coherenceIssues, trainingHours } from "./psst-coach.mjs?v=project-2";
import { draftReadiness, projectFields, recordRefs, schedule } from "./psst-program.mjs?v=coach-1";
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
  return rows(activities).filter(row=>hasValue(row.actividad) && schedule(row));
}

function ganttTable(scheduled, includeDetails = false) {
  const columns = includeDetails
    ? [["Plan","plan"],["Actividad","actividad"],["Responsable","responsable"],["Inicio","inicioPrevisto"],["Cierre","finPrevisto"],["Estado","estado"],["Enfoque","enfoque"]]
    : [["Actividad","actividad"],["Responsable","responsable"],["Estado","estado"]];
  return table([...columns,...months.map((month,index)=>[month,index+1])],scheduled.map(row=>{
    const planned=schedule(row);
    return {...row,inicioPrevisto:planned.from,finPrevisto:planned.to,estado:row.estado || "Pendiente",
      ...Object.fromEntries(months.map((_,index)=>[index+1,index+1>=planned.start && index+1<=planned.end ? "●" : ""]))};
  }));
}

function planSections(plans, riskLabel) {
  return rows(plans).map(row=>"<h3>"+escape([row.codigo,row.nombre].filter(Boolean).join(" · "))+"</h3>"+facts([
    ["Familia",row.familia],["Hallazgos",riskLabel(row)],["Objetivo",row.objetivo],["Meta",row.meta],["Alcance",row.alcance],
    ["Frecuencia",row.frecuencia],["Responsables",row.responsable],["Procedimiento",row.procedimiento],
    ["Instrumentos",row.instrumentos],["Recursos",row.recursos],["Seguimiento",row.seguimiento],["Contenido específico",row.detalleFamilia],
  ])).join("");
}

function activityEvidence(activities) {
  const entries=rows(activities).filter(row=>[row.enfoque,row.detalleEnfoque,row.evidenciaEsperada,row.evidenciaReal,row.eficacia].some(hasValue));
  return table([["Plan","plan"],["Actividad","actividad"],["Enfoque","enfoque"],["Procedimiento y criterio","detalleEnfoque"],
    ["Evidencia esperada","evidenciaEsperada"],["Criterio de eficacia","eficacia"],["Evidencia registrada","evidenciaReal"]],entries);
}

function educationSchedule(activities,plans,groups) {
  return table([["Grupo","group"],["T1","t1"],["T2","t2"],["T3","t3"],["T4","t4"]],
    trainingHours(activities,plans,groups).map(({group,quarters})=>({
      group,t1:quarters[0]+" h",t2:quarters[1]+" h",t3:quarters[2]+" h",t4:quarters[3]+" h",
    })));
}

export function buildGanttDocument({ label, activities, plans = [], legacyReference, riskRows = [], declaredGroups = "", includePlans = false }) {
  const allActivities = rows(activities).map(row => {
    const plan = plans.find(item=>item.id===row.planRef);
    return {...row,plan:plan ? [plan.codigo,plan.nombre].filter(Boolean).join(" · ") : row.plan};
  });
  const scheduled = scheduledActivities(allActivities);
  const pendingDates = allActivities.filter(row=>hasValue(row.actividad) && !schedule(row));
  const criteria = activityEvidence(allActivities);
  const education = educationSchedule(allActivities,plans,declaredGroups);
  const pendingList = table([["Actividad","actividad"],["Responsable","responsable"],["Estado","estado"]],
    pendingDates.map(row=>({...row,estado:row.estado || "Pendiente"})));
  const riskLabel = row => recordRefs(row).map(ref=>riskRows.find(risk=>risk.id===ref)?.codigo || "Referencia por verificar").join(", ");
  if (!scheduled.length && !hasValue(legacyReference) && !pendingDates.length && !(includePlans && rows(plans).length)) return "";
  const title=includePlans ? "Planes de trabajo y carta Gantt 2027" : "Carta Gantt 2027";
  const chart = ganttTable(scheduled,true);
  return `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>@page{size:A4 landscape;margin:12mm}body{font:14px system-ui,sans-serif;color:#183047;max-width:1150px;margin:1.5rem auto;padding:0 1rem}
header{border-top:5px solid #007b85;padding:.65rem 0}h1{color:#00205b;margin:.4rem 0}.note{white-space:pre-wrap;overflow-wrap:anywhere}.calendar{overflow-x:auto}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px}
th,td{padding:5px;border:1px solid #bbced2;text-align:center;overflow-wrap:anywhere;vertical-align:top}th{background:#e3f1f1}td:nth-child(-n+3),th:nth-child(-n+3){text-align:left}th:nth-child(1){width:9%}th:nth-child(2){width:15%}th:nth-child(3){width:9%}th:nth-child(4),th:nth-child(5){width:7%}th:nth-child(6){width:8%}td:nth-child(n+7){color:#005861;font-weight:700}
@media print{body{max-width:none;margin:0;padding:0}.calendar{overflow:visible}table{font-size:8.5pt}thead{display:table-header-group}tr{break-inside:avoid}}</style>
<body><header><p>Academia Movida de SST · Taller práctico de PSST</p><h1>${title}</h1><p>${escape(label)} · Cronograma de los planes de trabajo</p></header>
${includePlans ? planSections(plans,riskLabel)
  +(criteria ? "<h2>Enfoques y evidencias de las actividades</h2>"+criteria : "")
  +(education ? "<h2>Horas de formación programadas por persona</h2>"+education : "")
  +"<h2>Carta Gantt 2027</h2>" : ""}
${chart ? '<p>● Mes de ejecución programado</p><div class="calendar">'+chart+'</div>' : ""}
${pendingList ? "<h2>Actividades pendientes de fechar</h2>"+pendingList : ""}
${hasValue(legacyReference) ? "<h2>Referencia al cronograma anterior</h2>"+note(legacyReference) : ""}
</body></html>`;
}

export function buildPsstDocument({ label, inputs = {}, draft = {}, version, submittedAt }) {
  const one = inputs.m1?.data ?? {};
  const two = inputs.m2?.data?.m2 ?? {};
  const three = inputs.m3?.data?.m3 ?? {};
  const four = draft.m4 ?? {};
  const productionFlows = rows(one.flujo?.productivos);
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
  const gantt = ganttTable(scheduledActivities(activities),true);
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
    ["Código","codigo"],["Flujo","flujo"],["Proceso","nombre"],["Área","area"],["Entradas","entradas"],["Secuencia","secuencia"],
    ["Salidas","salidas"],["Contratistas","contratistas"],["Evidencia","evidencia"],
  ],processRows.map(row=>({...row,flujo:labelFor(productionFlows,row.productivoRef)})));
  const tasks = table([
    ["Código","codigo"],["Proceso","proceso"],["Etapa","etapa"],["Tarea","nombre"],["Descripción","descripcion"],
    ["Puestos y exposición","puestos"],["Medios","medios"],["Organización","organizacion"],["Evidencia","evidencia"],
  ],taskRows.map(row=>({...row,proceso:labelFor(processRows,row.procesoRef)})));
  const planSheets = planSections(planRows,row=>recordRefs(row).map(ref=>labelFor(riskRows,ref)).join(", "));
  const productionMap = table([["Código","codigo"],["Bien o servicio","nombre"],["Entradas","entradas"],
    ["Secuencia","secuencia"],["Salidas","salidas"],["Evidencia","evidencia"]],productionFlows);
  const objectives = table([["Código","codigo"],["Resultado","nombre"],["Plan","plan"],["Indicador","indicador"]],
    rows(four.objetivos).map(row=>({...row,plan:labelFor(planRows,row.planRef),indicador:labelFor(rows(four.indicadores),row.indicadorRef)})));
  const contractorTable=table([["Obra o servicio","nombre"],["Parte","parte"],["Procesos","procesos"],["Hallazgo","riesgo"],
    ["Coordinación y controles","controles"],["Responsable","responsable"],["Evidencia","evidencia"]],
    rows(four.contratistas).map(row=>({...row,riesgo:labelFor(riskRows,row.riesgoRef)})));
  const indicators = table([["Código","codigo"],["Indicador","nombre"],["Plan","plan"],["Criterio","formula"],["Línea base","base"],
    ["Meta","meta"],["Fuente","fuente"],["Frecuencia","frecuencia"],["Responsable","responsable"],["Respuesta","respuesta"]],
    rows(four.indicadores).map(row=>({...row,plan:labelFor(planRows,row.planRef)})));
  const fieldNotes=taskRows.filter(row=>[row.observacion,row.consulta,row.contraste].some(hasValue));
  const pendingRiskEntries=matrix.filter(row=>[row.estadoEvaluacion,row.responsableEvaluacion,row.fechaEvaluacion,
    row.controlPropuesto,row.justificacionControl].some(hasValue));
  const observationTable=table([["Tarea","codigo"],["Observación","observacion"],["Consulta","consulta"],["Por contrastar","contraste"]],fieldNotes);
  const evaluationTable=table([["Hallazgo","codigo"],["Estado","estadoEvaluacion"],["Medida propuesta","controlPropuesto"],
    ["Justificación","justificacionControl"],["Responsable de verificar","responsableEvaluacion"],["Fecha prevista","fechaEvaluacion"]],pendingRiskEntries);
  const evaluationCriteria=activityEvidence(activities);
  const education=educationSchedule(activities,planRows,three.gruposFormacion);
  const issues=coherenceIssues({one,two,three,four});
  const annexTable = table([["Código","codigo"],["Soporte","nombre"],["Capítulo","capitulo"],["Versión","version"],
    ["Ubicación","ubicacion"],["Estado","estado"],["Responsable","responsable"],["Custodio y acceso","custodio"],["Revisión de acceso","revisionAcceso"]],rows(four.soportes));
  const verification=table([["Tarea","tarea"],["Estado","estado"],["Fuente","evidencia"],["Justificación","justificacion"],["Responsable","responsable"],["Verificación prevista","fecha"]],
    rows(two.verificaciones).map(row=>({...row,tarea:labelFor(taskRows,row.tareaRef)})));
  const fieldLog=table([["Fecha","fecha"],["Actividad","actividad"],["Horas","horas"],["Método","tipo"],["Referencia","evidencia"],["Tarea","tarea"]],
    rows(one.bitacora?.registros).map(row=>({...row,tarea:labelFor(taskRows,row.tareaRef)})));
  const scheduledDetails=table([["Centro","centro"],["Plan","plan"],["Actividad","actividad"],["Inicio real","inicioReal"],
    ["Cierre real","cierreReal"],["Estado","estado"],["Responsable","responsable"],["Recursos","recursos"]],activities);
  const extras = {
    0: objectives,
    2: process + (productionMap ? "<h3>Mapa productivo o de servicio</h3>"+productionMap : "") + (inventory ? "<h3>Inventario de procesos</h3>"+inventory : "") +
      (tasks ? "<h3>Etapas y tareas</h3>"+tasks : "") + (observationTable ? "<h3>Observaciones y consultas</h3>"+observationTable : "") +
      (verification ? "<h3>Estado de las evaluaciones por tarea</h3>"+verification : "") + (risks ? "<h3>Matriz inicial de riesgos</h3>"+risks : "") + (evaluationTable ? "<h3>Medidas y verificaciones pendientes</h3>"+evaluationTable : "") +
      facts([["Matriz anterior o referencia",two.matriz],["Evaluaciones pendientes",two.pendientes],["Evidencia de campo",two.evidencia]]),
    3: (planSheets ? "<h3>Fichas de los planes</h3>"+planSheets : "") + plans +
      (evaluationCriteria ? "<h3>Enfoques y evidencias de las actividades</h3>"+evaluationCriteria : "") +
      (education ? "<h3>Horas de formación programadas por persona</h3>"+education : "") + note(three.cobertura) + (gantt ? "<h3>Carta Gantt 2027</h3>"+gantt : "") +
      facts([["Planes anteriores",three.planes],["Cronograma anterior",three.gantt],["Responsables",three.responsables],["Recursos",three.recursos],["Seguimiento",three.seguimiento]]),
    5: note(four.compromiso),
    6: contractorTable,
    7: indicators + (evaluationCriteria ? "<h3>Criterios de eficacia a verificar</h3>"+evaluationCriteria : ""),
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
  const profile = facts(projectFields.map(([key,title])=>[title,one.proyecto?.[key]]));
  const readiness = facts(draftReadiness(four,inputs).map(([title,ready])=>[title,ready ? "Con avance registrado" : "Pendiente de desarrollar"]));
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
<style>body{font:15px system-ui,sans-serif;max-width:1020px;margin:2rem auto;padding:0 1.2rem;color:#183047}h1,h2,h3{color:#00205b}h2{border-bottom:1px solid #bad9d9;padding-bottom:.35rem}header{border-top:5px solid #007b85;padding-top:.8rem}.note,td{white-space:pre-wrap;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%;font-size:.86rem;margin:1rem 0}th,td{border:1px solid #d1e2e7;padding:.35rem;text-align:left;vertical-align:top}th{background:#e3f1f1}.pending{color:#6d4b08}@page{size:A4 landscape;margin:12mm}@media print{body{margin:0;padding:0;max-width:none}table{font-size:8pt}thead{display:table-header-group}tr{break-inside:avoid}}</style>
<body><header><p>Academia Movida de SST · Taller práctico de PSST</p><h1>Borrador del Programa de Seguridad y Salud en el Trabajo</h1><p>${escape(label)} · Borrador para revisión${version!==undefined ? " · Revisión " + escape(version) : ""}${submittedAt ? " · Entrega " + escape(submittedAt) : ""}</p>${profile}</header>
<h2>Índice</h2><ol>${chapterStructure.map(([title])=>"<li>"+escape(title)+"</li>").join("")}<li>Anexos y evidencias</li></ol>
<h2>Introducción</h2>${note(four.introduccion) || '<p class="pending">Pendiente de redactar la introducción.</p>'}
<h2>Fuentes del taller</h2>${facts([1,2,3].map(n => {
  const source = inputs["m"+n];
  return ["Módulo "+n,source?.submittedAt ? "Última entrega registrada" : "Borrador de trabajo, entrega por verificar"];
}))}
<h2>Avance de elaboración</h2>${readiness}
${chapterSections}
<h2>Índice de anexos y soportes</h2>${annexIndex}${annexTable}
${issues.length ? "<h2>Revisión de coherencia</h2><ul>"+issues.map(item=>"<li>"+escape(item.message)+"</li>").join("")+"</ul>" : ""}
<h2>Anexo · Evidencias y brechas</h2>
${fieldLog}
${facts([["Organización de la mesa",one.mesa?.organizacion],["Bitácora",one.bitacora?.referencia],["Horas",one.bitacora?.horas],
 ["Registro de campo",one.bitacora?.evidencias],["Pendientes de campo",one.bitacora?.pendientes],["Evidencias",four.evidencia],
 ["Participación y revisión",four.validacion],["Revisión del SSST y Comité",four.cssl],["Resultado de la revisión",four.resultado],["Acciones pendientes",four.pendientes],
 ["Borrador anterior",four.borrador],["Brechas anteriores",four.brechas]])}
${table([["Capítulo","capitulo"],["Brecha","brecha"],["Acción","accion"],["Responsable","responsable"],["Plazo","plazo"],["Evidencia","evidencia"]],rows(four.filas))}<h2>Anexo · Contraste con los instrumentos</h2>
${table([["Capítulo","chapter"],["Criterio","label"],["Estado","state"],["Evidencia u observación","note"]],reviews)}</body></html>`;
}
