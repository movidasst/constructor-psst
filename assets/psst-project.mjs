import { recordRefs, schedule } from "./psst-program.mjs?v=project-2";

export const modules = [
  ["m1","Procesos y observación","1"], ["m2","Evaluación de riesgos","2"],
  ["m3","Planes y cronograma","3"], ["m4","Borrador y revisión","4"],
];
export const rubrics = {
  m1: [["Mapa productivo y procesos de trabajo","Distingue el flujo del bien o servicio de los procesos de trabajo y vincula sus etapas."],
    ["Tareas observadas","Describe la secuencia real, el personal, los medios y las condiciones."],
    ["Participación y contraste","Documenta aportes, diferencias y lo que se acordó verificar."],
    ["Evidencias y horas de campo","Relaciona fuentes fechadas con las tareas y el tiempo declarado."]],
  m2: [["Trazabilidad","Relaciona cada hallazgo con el proceso, tarea y condición observada."],
    ["Evaluación de riesgos","Justifica el método, la exposición, los controles existentes y la valoración."],
    ["Controles y prioridades","Prioriza las medidas y explica cómo se comprobará su eficacia."],
    ["Evidencias y pendientes","Indica fuente, responsable y plazo de las verificaciones por realizar."]],
  m3: [["Vínculo con los hallazgos","Relaciona planes y actividades con uno o varios procesos y hallazgos."],
    ["Estructura y enfoque","Desarrolla la estructura general y el contenido específico de la familia del plan."],
    ["Cronograma y recursos","Programa actividades con fechas, responsables y recursos coherentes."],
    ["Evidencia y eficacia","Define la evidencia de ejecución y cómo comprobará el resultado."]],
  m4: [["Contenido de los ocho capítulos","Desarrolla los apartados y documenta las brechas de la versión entregada."],
    ["Coherencia del programa","Relaciona diagnóstico, planes, responsables y cronograma."],
    ["Instrumentos y anexos","Aporta referencias verificables y documenta el contraste con los instrumentos."],
    ["Revisión y seguimiento","Establece cómo se valida, ajusta y hace seguimiento al PSST."]],
};
export const checksLabels = {
  alcance:"Alcance",flujo:"Mapa e inventario",tarea:"Tareas observadas",mesa:"Participación",bitacora:"Bitácora",
  etapa:"Alcance de evaluación",matriz:"Matriz de riesgos",procesos:"Procesos y hallazgos",
  pendientes:"Pendientes",evidencia:"Evidencias",planes:"Planes",gantt:"Cronograma",responsables:"Responsables",
  recursos:"Recursos",seguimiento:"Seguimiento",borrador:"Borrador",brechas:"Brechas",validacion:"Validación",
};

export function projectState(progress, id) {
  const item=progress?.[id];
  if (!item) return "Por iniciar";
  if (item.submittedRevision !== null && item.submittedRevision !== undefined) {
    if (item.revision>item.submittedRevision) return "Cambios por entregar";
    return item.published ? "Nota publicada" : "En revisión";
  }
  return item.revision>0 ? "Borrador" : "Por iniciar";
}

const list = rows => Array.isArray(rows) ? rows : [];
export function workTrace(one={},two={},three={}) {
  const tasks=list(one.tarea?.actividades), flows=list(one.flujo?.productivos), processes=list(one.flujo?.procesos);
  const risks=list(two.filas), plans=list(three.planesDetallados), activities=list(three.filas);
  return tasks.map(task=>{
    const process=processes.find(row=>row.id===task.procesoRef);
    const flow=flows.find(row=>row.id===process?.productivoRef);
    const findings=risks.filter(row=>row.tareaRef===task.id);
    const links=plans.filter(plan=>recordRefs(plan).some(id=>findings.some(risk=>risk.id===id)));
    const actions=activities.filter(activity=>links.some(plan=>plan.id===activity.planRef));
    return {task,process,flow,findings,plans:links,activities:actions};
  });
}

export function changedSources(delivered, active) {
  return ["m1","m2","m3"].filter(id => {
    const prior=delivered?.[id];
    const current=active?.[id];
    if (!prior || !current) return false;
    return JSON.stringify(prior.data)!==JSON.stringify(current.data);
  });
}

export function technicalPrompts({one={},two={},three={}}) {
  const out=[];
  for (const path of workTrace(one,two,three)) {
    const label=path.task.codigo || path.task.nombre;
    if (!path.task.observacion) out.push(label+" · ¿Qué observaste durante una secuencia completa?");
    if (!path.task.consulta) out.push(label+" · ¿Qué cambia entre turnos según quienes ejecutan la tarea?");
    for (const risk of path.findings) {
      if (!risk.valoracion) out.push((risk.codigo||label)+" · ¿Qué método, datos o mediciones faltan para sustentar la valoración?");
      if (risk.controlPropuesto && !risk.justificacionControl) out.push((risk.codigo||label)+" · ¿Qué medida sobre el origen consideraste y cómo comprobarás la mejora?");
    }
  }
  return out.slice(0,12);
}

export function activityRows(activities,plans,year=2027) {
  return list(activities).filter(row=>row.actividad && schedule(row)).map(row=>{
    const timing=schedule(row);
    const plan=list(plans).find(item=>item.id===row.planRef);
    return [row.centro||"",plan?.codigo||plan?.nombre||row.plan||"",row.actividad,row.responsable||"",row.estado||"Pendiente",
      timing.from,timing.to,row.inicioReal||"",row.cierreReal||"",row.recursos||plan?.recursos||"",
      row.evidenciaEsperada||"",row.evidenciaReal||"",...Array.from({length:12},(_,i)=>timing.start<=i+1&&timing.end>=i+1?1:"")];
  });
}
