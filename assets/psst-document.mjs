import {annualInvestment, investmentRows, sectionCoverage, sourceSections, structuredSections} from "./psst-coverage.mjs?v=anual-1";
import { exposureRows, exposureSummary } from "./psst-exposure.mjs?v=exposicion-1";
import { operationalSchedule, orderedFlows, organizationTree, statusLabels, technicalChecks } from "./psst-builder.mjs?v=organigrama-1";
import { coherenceIssues, familyTemplates, planReviewNotes, surveillanceFields, annualTraining, trainingHours } from "./psst-coach.mjs?v=anual-1";
import { projectFields, recordRefs, schedule } from "./psst-program.mjs?v=coach-1";
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

export function contractorSheet(row, risks = []) {
  const risk = risks.find(item => item.id === row.riesgoRef);
  const finding = risk ? [risk.codigo, risk.riesgo].filter(Boolean).join(" · ")
    : row.riesgoRef ? "Referencia por verificar" : "";
  const data = facts([
    ["Obra o servicio",row.nombre],["Empresas participantes",row.parte],["Procesos y áreas compartidas",row.procesos],
    ["Hallazgo del módulo 2",finding],["Controles acordados",row.controles],
    ["Responsable de la contratante",row.referenteInterno],["Responsable de la contratista",row.referenteExterno],
    ["Antes del inicio",row.acuerdoInicio],["Durante la ejecución",row.acuerdoEjecucion],
    ["Al cierre",row.acuerdoCierre],["Responsable de verificar",row.responsable],["Soporte y estado del acuerdo",row.evidencia]
  ]);
  return data ? "<h3>Ficha de coordinación · "+escape(row.nombre || "Servicio por identificar")+"</h3>"+data : "";
}

export function scheduledActivities(activities) {
  return rows(activities).filter(row=>hasValue(row.actividad) && schedule(row));
}

function ganttTable(scheduled, includeDetails = false) {
  if (!scheduled.length) return "";
  const calendar = table([["Actividad","actividad"],["Responsable","responsable"],["Estado","estado"],
    ...months.map((month,index)=>[month,index+1])],scheduled.map(row=>{
      const current=operationalSchedule(row);
      return {...row,estado:row.estado || "Pendiente",
        ...Object.fromEntries(months.map((_,index)=>[index+1,index+1>=current.start && index+1<=current.end ? "●" : ""]))};
    }));
  const details = includeDetails ? table([["Actividad","actividad"],["Plan","plan"],["Fechas originales","original"],
    ["Fechas vigentes","current"],["Motivo de reprogramación","motivoReprogramacion"]],scheduled.map(row=>{
      const planned=schedule(row), current=operationalSchedule(row);
      return {...row,original:planned.from+" a "+planned.to,current:current.from+" a "+current.to};
    })) : "";
  return '<div class="gantt-calendar">'+calendar+'</div>'+ (details ? '<h3>Fechas y reprogramaciones</h3>'+details : "");
}

function planSections(plans, riskLabel, trace=()=> "") {
  return rows(plans).map(row=>"<h3>"+escape([row.codigo,row.nombre].filter(Boolean).join(" · "))+"</h3>"+facts([
    ["Familia",row.familia],["Hallazgos",riskLabel(row)],["Objetivo",row.objetivo],["Meta",row.meta],["Alcance",row.alcance],
    ["Frecuencia",row.frecuencia],["Responsables",row.responsable],["Procedimiento",row.procedimiento],
    ["Instrumentos",row.instrumentos],["Recursos",row.recursos],["Seguimiento",row.seguimiento],["Contenido específico",row.detalleFamilia],
  ])+facts(surveillanceFields(row.familia).map(({key,label})=>[
    label,planReviewNotes(row.revisionArt18)["vigilancia/"+row.familia]?.[key]
  ]))+trace(row)).join("");
}

function activityEvidence(activities) {
  const entries=rows(activities).filter(row=>[row.enfoque,row.detalleEnfoque,row.evidenciaEsperada,row.evidenciaReal,row.eficacia].some(hasValue));
  return table([["Plan","plan"],["Actividad","actividad"],["Enfoque","enfoque"],["Procedimiento y criterio","detalleEnfoque"],
    ["Evidencia esperada","evidenciaEsperada"],["Criterio de eficacia","eficacia"],["Evidencia registrada","evidenciaReal"]],entries);
}

function educationSchedule(activities,plans,groups,exposures=[]) {
  return table([["Grupo","group"],["T1","t1"],["T2","t2"],["T3","t3"],["T4","t4"],["Año","total"],["Pendientes","gaps"]],
    annualTraining(activities,plans,groups,exposures).map(({group,quarters,total,gaps})=>({
      total:total+" h",gaps:gaps.join(", ")||"Cuatro trimestres cubiertos",
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
th,td{padding:5px;border:1px solid #bbced2;text-align:center;overflow-wrap:anywhere;vertical-align:top}th{background:#e3f1f1}td:nth-child(-n+3),th:nth-child(-n+3){text-align:left}.gantt-calendar th:nth-child(1){width:24%}.gantt-calendar th:nth-child(2){width:14%}.gantt-calendar th:nth-child(3){width:12%}.gantt-calendar td:nth-child(n+4){color:#005861;font-weight:700}
@media print{body{max-width:none;margin:0;padding:0}.calendar{overflow:visible}table{font-size:8.5pt}h2,h3{break-after:avoid}thead{display:table-header-group}tr{break-inside:avoid}}</style>
<body><header><p>Academia Movida de SST · Taller práctico de PSST</p><h1>${title}</h1><p>${escape(label)} · Cronograma de los planes de trabajo</p></header>
${includePlans ? planSections(plans,riskLabel)
  +(criteria ? "<h2>Enfoques y evidencias de las actividades</h2>"+criteria : "")
  +(education ? "<h2>Horas de formación programadas por persona</h2>"+education : "")
  +"<h2>Carta Gantt 2027</h2>" : ""}
${chart ? '<p>● Mes de ejecución según fechas vigentes. Las fechas originales y reprogramaciones se detallan debajo.</p><div class="calendar">'+chart+'</div>' : ""}
${pendingList ? "<h2>Actividades pendientes de fechar</h2>"+pendingList : ""}
${hasValue(legacyReference) ? "<h2>Referencia al cronograma anterior</h2>"+note(legacyReference) : ""}
</body></html>`;
}

export function organizationDiagram(records) {
  const nodes = organizationTree(records);
  if (!nodes.length) return "";
  const branches = new Map();
  for (const node of nodes) {
    const parent = node.cycle ? undefined : node.parent?.id;
    if (!branches.has(parent)) branches.set(parent, []);
    branches.get(parent).push(node);
  }
  const boxes = [], lines = [];
  let column = 0, depth = 0;
  function place(node, level) {
    const y = 20 + level * 110;
    depth = Math.max(depth, level);
    const children = (branches.get(node.id) ?? []).map(child => place(child, level + 1));
    const x = children.length ? (children[0] + children.at(-1)) / 2 : 120 + 240 * column++;
    for (const child of children) lines.push(`<path d="M ${x} ${y+72} V ${y+91} H ${child} V ${y+110}"/>`);
    const label = String(node.nombre).match(/.{1,24}(?:\s|$)|.{1,24}/gu) ?? [];
    const visible = label.slice(0, 3);
    if (label.length > 3) visible[2] = visible[2].trimEnd() + "…";
    boxes.push(`<g><title>${escape(node.nombre)}</title><rect x="${x-106}" y="${y}" width="212" height="72" rx="9" fill="${level ? "#edf8f7" : "#00205b"}" stroke="#007b85"/><text x="${x}" y="${y+32-(visible.length-1)*8}" text-anchor="middle" fill="${level ? "#00205b" : "#ffffff"}">${visible.map((part,i)=>`<tspan x="${x}" dy="${i ? 16 : 0}">${escape(part.trim())}</tspan>`).join("")}</text>${node.orphan || node.cycle ? `<text x="${x}" y="${y+65}" text-anchor="middle" fill="${level ? "#9c2623" : "#ffdb6e"}" font-size="12">Revisar relación de reporte</text>` : ""}</g>`);
    return x;
  }
  for (const root of branches.get(undefined) ?? []) place(root, 0);
  const width = 240 * column, height = 110 * depth + 110;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Organigrama del centro" font-family="Arial,sans-serif" font-size="14"><g stroke="#007b85" stroke-width="2" fill="none">${lines.join("")}</g>${boxes.join("")}</svg>`;
}

function diagramSections(data,kind){
  const org = kind !== "flow" && organizationDiagram(data.alcance?.estructura);
  const chart = org ? org.replace("<svg ", '<svg style="max-width:100%;height:auto" ') +
    "<p>Organigrama gráfico disponible como anexo SVG desde el módulo 1.</p>" : "";
  const flows=kind!=="org"?orderedFlows(data).filter(flow=>flow.stages.length).map(flow=>"<h3>"+escape(flow.nombre)+"</h3>"+
    table([["Orden","orden"],["Etapa","nombre"],["Área","area"],["Entrada","entradas"],["Salida","salidas"],["Desvío o devolución","excepcion"]],
      flow.stages.map((row,i)=>({...row,orden:i+1})))).join(""):"";
  const fallback=kind!=="flow"&&!org ? note(data.alcance?.organigrama) : "";
  return (org||fallback?"<h3>Organigrama del centro</h3>"+(chart||fallback):"")+
    (flows?"<h3>Mapa de etapas del proceso productivo</h3>"+flows:"");
}

export function buildDiagramDocument({label,inputs={}},kind){
  const body=diagramSections(inputs.m1?.data??{},kind);
  const heading=kind==="org"?"Organigrama del centro":kind==="flow"?"Mapa del proceso productivo":"Organigrama y mapa del proceso productivo";
  return '<!doctype html><html lang="es"><meta charset="utf-8"><title>'+heading+'</title><body><h1>'+heading+'</h1><p>'+
    escape(label)+'</p>'+(body||"<p>Diagrama pendiente de elaborar en el Módulo 1.</p>")+'</body></html>';
}

export function buildPsstDocument({ label, inputs = {}, draft = {}, version, submittedAt, includeReview=false }) {
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
  const matrix = riskRows.map(row => ({...row,tareaCodigo:labelFor(taskRows,row.tareaRef),exposicionResumen:exposureSummary(row,two)}));
  const activities = rows(three.filas).map(row => ({...row,plan:labelFor(planRows,row.planRef) || row.plan,
    hallazgo:labelFor(riskRows,row.riesgoRef) || row.hallazgo}));
  const reviews = reviewGroups.flatMap(([chapter,criteria]) => criteria.map(([key,label]) =>
    ({chapter,label,state:four["estado_"+key] || "Por revisar",note:four["nota_"+key]})));
  const gantt = ganttTable(scheduledActivities(activities),true);
  const process = facts([
    ["Centro",one.alcance?.centro],["Área, turno y alcance",one.alcance?.area],
    ["Organigrama y estructura del SSST",one.alcance?.organigrama],
    ["Proceso productivo",one.flujo?.proceso],["Secuencia",one.flujo?.secuencia],["Diagrama",one.flujo?.referencia],
    ["Etapa y tarea",one.tarea?.etapa],["Descripción",one.tarea?.descripcion],
    ["Participación",one.mesa?.metodo],["Aportes",one.mesa?.aportes],["Referencia",one.mesa?.referencia],["Asamblea",one.mesa?.asamblea],
    ["Método de evaluación",two.metodo],["Alcance de evaluación",two.etapa],["Observaciones",two.procesos],["Síntesis y prioridades",two.sintesis],
  ]);
  const risks = table([
    ["ID","codigo"],["Tarea","tareaCodigo"],["Etapa","etapa"],["Proceso peligroso","proceso"],["Peligro","peligro"],["Riesgo / daño","riesgo"],
    ["Situación","situacion"],["Puestos y personas expuestas","exposicionResumen"],["Controles","controles"],["Valoración","valoracion"],
    ["Evidencia","evidencia"],["Por evaluar","pendiente"],
  ],matrix);
  const exposureDetail=table([["Hallazgo","hallazgo"],["Tarea","tarea"],["Puesto","puesto"],["Área o zona","area"],["Turno","turno"],
    ["Personal","grupo"],["Personas expuestas","cantidadVisible"],["Frecuencia","frecuencia"],["Duración","duracion"],["Fuente del conteo","fuente"]],exposureRows(two,taskRows));
  const unassignedActivities = table([
    ["Plan","plan"],["Actividad","actividad"],["Hallazgo","hallazgo"],["Objetivo / meta","objetivo"],
    ["Frecuencia","frecuencia"],["Procedimiento / instrumento","procedimiento"],["Responsable","responsable"],
    ["Recursos / presupuesto","recursos"],["Seguimiento","seguimiento"],
  ],activities.filter(row=>!planRows.some(plan=>plan.id===row.planRef)));
  const elements=processRows.map(row=>{
    const detail=facts([["Objeto o sujeto",row.objetoSujeto],["Medios de trabajo",row.mediosProceso],
      ["Actividad real",row.actividadProceso],["Organización del trabajo",row.organizacionProceso],
      ["División del trabajo",row.divisionProceso]]);
    return detail?"<h3>"+escape([row.codigo,row.nombre].filter(Boolean).join(" · "))+"</h3>"+detail:"";
  }).join("");
  const inventory = table([
    ["Código","codigo"],["Proceso productivo","flujo"],["Proceso de trabajo","nombre"],["Área","area"],["Entradas","entradas"],["Secuencia","secuencia"],
    ["Salidas","salidas"],["Contratistas","contratistas"],["Evidencia","evidencia"],
  ],processRows.map(row=>({...row,flujo:labelFor(productionFlows,row.productivoRef)})));
  const tasks = table([
    ["Código","codigo"],["Proceso","proceso"],["Etapa","etapa"],["Tarea","nombre"],["Descripción","descripcion"],
    ["Puestos y exposición","puestos"],["Medios","medios"],["Organización","organizacion"],["Evidencia","evidencia"],
  ],taskRows.map(row=>({...row,proceso:labelFor(processRows,row.procesoRef)})));
  const planSheets = planSections(planRows,row=>recordRefs(row).map(ref=>labelFor(riskRows,ref)).join(", "),plan=>{
    const trace = activities.filter(activity=>activity.planRef===plan.id).map(activity=>{
      const risk=matrix.find(item=>item.id===activity.riesgoRef);
      const task=taskRows.find(item=>item.id===risk?.tareaRef);
      const process=processRows.find(item=>item.id===task?.procesoRef);
      const dates=schedule(activity);
      return {...activity,process:process?.nombre || task?.etapa,people:risk?.exposicionResumen,
        finding:[risk?.codigo,risk?.situacion || risk?.riesgo].filter(Boolean).join(" · "),
        dates:dates ? dates.from+" a "+dates.to : "Por programar"};
    });
    return table([["Proceso de trabajo","process"],["Puestos y exposición","people"],["Hallazgo","finding"],
      ["Acción","actividad"],["Responsable","responsable"],["Fechas","dates"],["Verificación de eficacia","eficacia"]],trace);
  });
  const productionMap = table([["Código","codigo"],["Bien o servicio","nombre"],["Entradas","entradas"],
    ["Secuencia","secuencia"],["Salidas","salidas"],["Evidencia","evidencia"]],productionFlows);
  const objectives = table([["Código","codigo"],["Resultado","nombre"],["Plan","plan"],["Indicador","indicador"]],
    rows(four.objetivos).map(row=>({...row,plan:labelFor(planRows,row.planRef),indicador:labelFor(rows(four.indicadores),row.indicadorRef)})));
  const contractorSheets = rows(four.contratistas).map(row => contractorSheet(row,riskRows)).join("");
  const indicators = table([["Código","codigo"],["Indicador","nombre"],["Plan","plan"],["Criterio","formula"],["Línea base","base"],
    ["Meta","meta"],["Fuente","fuente"],["Frecuencia","frecuencia"],["Responsable","responsable"],["Respuesta","respuesta"]],
    rows(four.indicadores).map(row=>({...row,plan:labelFor(planRows,row.planRef)})));
  const fieldNotes=taskRows.filter(row=>[row.observacion,row.consulta,row.devolucion,row.contraste].some(hasValue));
  const pendingRiskEntries=matrix.filter(row=>[row.estadoEvaluacion,row.responsableEvaluacion,row.fechaEvaluacion,
    row.controlPropuesto,row.justificacionControl,row.criterioEficacia].some(hasValue));
  const observationTable=table([["Tarea","codigo"],["Fecha","fechaCampo"],["Observación","observacion"],["Consulta","consulta"],["Confirmación o corrección","devolucion"],["Por contrastar","contraste"],["Fuente","evidencia"]],fieldNotes);
  const evaluationTable=table([["Hallazgo","codigo"],["Estado","estadoEvaluacion"],["Medida propuesta","controlPropuesto"],
    ["Justificación","justificacionControl"],["Criterio de eficacia","criterioEficacia"],["Responsable de verificar","responsableEvaluacion"],["Fecha prevista","fechaEvaluacion"]],pendingRiskEntries);
  const evaluationCriteria=activityEvidence(activities);
  const education=educationSchedule(activities,planRows,three.gruposFormacion,two.gruposExpuestos);
  const issues=[...coherenceIssues({one,two,three,four}),...technicalChecks({one,two,three,four})];
  const annexTable = table([["Código","codigo"],["Soporte","nombre"],["Capítulo","capitulo"],["Versión","version"],
    ["Ubicación","ubicacion"],["Estado","estado"],["Responsable","responsable"],["Grupo","grupo"],["Custodio y acceso","custodio"],["Revisión de acceso","revisionAcceso"]],rows(four.soportes).map(row=>({...row,grupo:annexStructure.find(([key])=>key===row.familia)?.[1]})));
  const verification=table([["Tarea","tarea"],["Estado","estado"],["Fuente","evidencia"],["Justificación","justificacion"],["Responsable","responsable"],["Verificación prevista","fecha"]],
    rows(two.verificaciones).map(row=>({...row,tarea:labelFor(taskRows,row.tareaRef)})));
  const fieldLog=table([["Fecha","fecha"],["Actividad","actividad"],["Horas","horas"],["Método","tipo"],["Referencia","evidencia"],["Tarea","tarea"]],
    rows(one.bitacora?.registros).map(row=>({...row,tarea:labelFor(taskRows,row.tareaRef)})));
  const budget=annualInvestment(rows(three.partidas),planRows,activities);
  const budgetSummary=table([["Alcance","scope"],["Moneda","currency"],["T1","q1"],["T2","q2"],["T3","q3"],["T4","q4"],["Sin mes","undated"],["Importe conocido","total"],["Partidas por estimar","pending"]],
    budget.summary.map(s=>({...s,q1:s.quarters[0],q2:s.quarters[1],q3:s.quarters[2],q4:s.quarters[3]})));
  const lessons=activities.filter(a=>planRows.find(p=>p.id===a.planRef)?.familia==="Educación e información");
  const trainingSheets=lessons.map(a=>"<h3>"+escape(a.actividad)+"</h3>"+facts([
    ["Grupo y turno",a.grupo],["Fecha prevista",a.fechaInicio],["Horas programadas por persona",a.horasPersona],
    ["Teoría y práctica",a.contenidoForm],["Facilitador, lugar y currículo",a.facilitadorForm],["Evaluación",a.evaluacionForm],
    ["Asistencia y horas recibidas",a.asistenciaForm],["Nivelación",a.nivelacionForm],["Evidencia",a.evidenciaReal]])).join("");
  const investment = table([["Plan","plan"],["Actividad","actividad"],["Mes","mes"],["Recurso","concepto"],["Cantidad","cantidad"],["Unidad","unidad"],
    ["Costo unitario","unitario"],["Importe","total"],["Moneda","moneda"],["Fuente","fuente"],["Responsable","responsable"]],
    budget.rows);
  const extras = {
    0: objectives,
    2: process + diagramSections(one) + (productionMap ? "<h3>Descripción del proceso productivo</h3>"+productionMap : "") + (inventory ? "<h3>Inventario de procesos de trabajo</h3>"+inventory+elements : "") +
      (tasks ? "<h3>Etapas y tareas</h3>"+tasks : "") + (observationTable ? "<h3>Observaciones y consultas</h3>"+observationTable : "") +
      (verification ? "<h3>Estado de las evaluaciones por tarea</h3>"+verification : "") + (risks ? "<h3>Matriz inicial de riesgos</h3>"+risks : "") + (exposureDetail ? "<h3>Exposición por puesto, área y turno</h3>"+exposureDetail : "") + (evaluationTable ? "<h3>Medidas y verificaciones pendientes</h3>"+evaluationTable : "") +
      facts([["Matriz anterior o referencia",two.matriz],["Evaluaciones pendientes",two.pendientes],["Evidencia de campo",two.evidencia]]),
    3: (investment ? "<h3>Plan anual de inversión 2027</h3>"+budgetSummary+investment : "") + (planSheets ? "<h3>Fichas de los planes</h3>"+planSheets : "") + (unassignedActivities ? "<h3>Actividades sin ficha de plan vinculada</h3>"+unassignedActivities : "") +
      (evaluationCriteria ? "<h3>Enfoques y evidencias de las actividades</h3>"+evaluationCriteria : "") +
      (education ? "<h3>Plan anual de capacitación 2027 · horas programadas por persona</h3>"+education : "") + trainingSheets + note(three.cobertura) + (gantt ? "<h3>Carta Gantt 2027</h3>"+gantt : "") +
      facts([["Planes anteriores",three.planes],["Cronograma anterior",three.gantt],["Responsables",three.responsables],["Recursos",three.recursos],["Seguimiento",three.seguimiento]]),
    5: note(four.compromiso),
    6: contractorSheets,
    7: indicators + (evaluationCriteria ? "<h3>Criterios de eficacia a verificar</h3>"+evaluationCriteria : ""),
  };
  const actuals=table([["Actividad","actividad"],["Estado","estado"],["Inicio real","inicioReal"],["Cierre real","cierreReal"],
    ["Nueva fecha inicial","nuevoInicio"],["Nuevo cierre","nuevoFin"],["Motivo del cambio","motivoReprogramacion"],
    ["Evidencia","evidenciaReal"],["Eficacia","resultadoEficacia"],["Verificada","verificacionEficacia"],["Observación","notaEficacia"]],
    activities.filter(row=>row.inicioReal||row.cierreReal||row.evidenciaReal||row.resultadoEficacia||row.nuevoInicio||row.estado==="Ejecutada"||row.estado==="Reprogramada"));
  if(actuals) extras[7]+="<h3>Seguimiento de ejecución y eficacia</h3>"+actuals;
  const stage=statusLabels[four.estadoExpediente]??statusLabels.borrador;
  const recovered = structuredSections(inputs,four);
  const fromModules = sourceSections(inputs);
  const profile = facts(projectFields.map(([key,title])=>[title,one.proyecto?.[key]]));
  const readiness = table([["Capítulo","chapter"],["Apartado","label"],["Estado","status"]],
    sectionCoverage(chapterStructure,four,fromModules,recovered));
  const chapterSections = chapterStructure.map(([title,sections], index) => {
    const number = index+1;
    const legacy = note(four["cap"+number]);
    const content = sections.map(([key,section]) => {
      const field = chapterKey(number,key);
      const placeholder = recovered[field]
        ? "Hay información de apoyo incorporada en este capítulo. Completa o valida la redacción del apartado."
        : "Pendiente de completar o indicar su referencia.";
      return "<h3>"+escape(section)+"</h3>"+(note(four[field]) || note(fromModules[field]) || '<p class="pending">'+placeholder+'</p>');
    }).join("");
    return '<section data-chapter-preview="'+number+'" id="capitulo-'+number+'"><h2>Capítulo '+number+" · "+escape(title)+"</h2>"+
      (legacy ? "<h3>Notas generales o referencia adicional</h3>"+legacy : "")+content+(extras[index]??"")+"</section>";
  }).join("");
  const annexIndex = table([["Apartado","label"],["Referencia","value"]],annexStructure.map(([key,label])=>({
    label,value:hasValue(four["anexo_"+key]) ? four["anexo_"+key] :
      rows(four.soportes).filter(row=>row.familia===key && row.nombre && row.ubicacion)
        .map(row=>[row.codigo,row.nombre,row.ubicacion].filter(Boolean).join(" · ")).join("\n") || "Pendiente de identificar",
  })));
  const reviewTable=table([["Capítulo","chapter"],["Criterio","label"],["Estado","state"],["Evidencia u observación","note"]],reviews);
  const planReview=planRows.flatMap(plan=>{
    const template=familyTemplates[plan.familia];
    const notes=planReviewNotes(plan.revisionArt18,plan.familia);
    return (template?.fields ?? []).map(criterion=>({
      plan:[plan.codigo,plan.nombre].filter(Boolean).join(" · "),
      clause:template.clause,criterion,note:notes[criterion]?.trim() || "Por documentar"
    }));
  });
  if(includeReview) return '<!doctype html><html lang="es"><meta charset="utf-8"><body>'+
    '<h1>Informe de revisión del taller</h1><p>'+escape(label)+'</p>'+
    "<h2>Avance de elaboración</h2>"+readiness+"<h2>Revisión de los planes de trabajo</h2>"+
    table([["Plan","plan"],["Referencia","clause"],["Criterio","criterion"],["Soporte u observación","note"]],planReview)+"<h2>Contraste con los instrumentos</h2>"+reviewTable+"</body></html>";
  return `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Borrador del PSST</title>
<style>body{font:15px system-ui,sans-serif;max-width:1020px;margin:2rem auto;padding:0 1.2rem;color:#183047}h1,h2,h3{color:#00205b}h2{border-bottom:1px solid #bad9d9;padding-bottom:.35rem}header{border-top:5px solid #007b85;padding-top:.8rem}.note,td{white-space:pre-wrap;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%;font-size:.86rem;margin:1rem 0}th,td{border:1px solid #d1e2e7;padding:.35rem;text-align:left;vertical-align:top}th{background:#e3f1f1}.pending{color:#6d4b08}@page{size:A4 landscape;margin:12mm}@media print{body{margin:0;padding:0;max-width:none}table{font-size:8pt}h2,h3{break-after:avoid}thead{display:table-header-group}tr{break-inside:avoid}}</style>
<body><header><p>Academia Movida de SST · Taller práctico de PSST</p><h1>Borrador del Programa de Seguridad y Salud en el Trabajo</h1><p>${escape(label)} · ${escape(stage)}${version!==undefined ? " · Revisión " + escape(version) : ""}${submittedAt ? " · Entrega " + escape(submittedAt) : ""}</p>${profile}</header>
<h2>Índice</h2><ol>${chapterStructure.map(([title],i)=>'<li><a href="#capitulo-'+(i+1)+'">'+escape(title)+'</a></li>').join("")}<li><a href="#anexos">Anexos y evidencias</a></li></ol>
${facts([["Estado del expediente",stage],["Responsable, fecha y soportes de revisión",four.referenciaExpediente]])}
<h2>Introducción</h2>${note(four.introduccion) || '<p class="pending">Pendiente de redactar la introducción.</p>'}
${chapterSections}
<h2 id="anexos">Índice de anexos y soportes</h2>${annexIndex}${annexTable}
${issues.length ? "<h2>Revisión de coherencia</h2><ul>"+issues.map(item=>"<li>"+escape(item.message)+"</li>").join("")+"</ul>" : ""}
<h2>Anexo · Evidencias y brechas</h2>
${fieldLog}
${facts([["Organización de la mesa",one.mesa?.organizacion],["Bitácora",one.bitacora?.referencia],["Horas",one.bitacora?.horas],
 ["Registro de campo",one.bitacora?.evidencias],["Pendientes de campo",one.bitacora?.pendientes],["Evidencias",four.evidencia],
 ["Participación y revisión",four.validacion],["Revisión del SSST y Comité",four.cssl],["Resultado de la revisión",four.resultado],["Acciones pendientes",four.pendientes],
 ["Borrador anterior",four.borrador],["Brechas anteriores",four.brechas]])}
${table([["Capítulo","capitulo"],["Brecha","brecha"],["Acción","accion"],["Responsable","responsable"],["Plazo","plazo"],["Evidencia","evidencia"]],rows(four.filas))}</body></html>`;
}
