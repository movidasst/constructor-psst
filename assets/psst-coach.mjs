import { recordRefs, schedule } from "./psst-program.mjs?v=coach-1";

export const sources = {
  nt: "https://www.piensosst.com/wp-content/uploads/2025/03/GO-NT-04-2023.pdf",
  guia: "https://www.piensosst.com/wp-content/uploads/2025/03/Guia-de-Elaboracion-PSST.pdf",
  ley: "https://medicinalaboraldevenezuela.com.ve/archivo/LOPCYMAT.pdf#page=32",
};
export const approaches = {
  Preventivo: ["Acción anticipada para reducir la exposición o la posibilidad de falla.",
    "Define qué condición quieres evitar, en qué tareas, con qué frecuencia y cómo verificarás el control.",
    "Verificar los dispositivos de advertencia antes de cada turno."],
  Predictivo: ["Seguimiento de datos o señales para anticipar deterioro y decidir cuándo intervenir.",
    "Define variable, método, frecuencia, criterio técnico de intervención y quién interpretará el resultado.",
    "Registrar el desgaste observado y compararlo con el criterio técnico aplicable."],
  Correctivo: ["Intervención sobre una condición o deficiencia identificada.",
    "Vincula el hallazgo, indica la medida y define la evidencia que permitirá comprobar su eficacia.",
    "Corregir una falla en la señal de advertencia y dejar el registro de la prueba funcional."],
  Divulgativo: ["Comunicación de información preventiva a las personas que la necesitan.",
    "Identifica destinatarios, mensaje, medio, fecha y cómo se comprobará la recepción o comprensión.",
    "Explicar al equipo el procedimiento de circulación actualizado y verificar su comprensión."],
};

const entry = (clause,page,fields) => ({clause,page,fields});
export const familyTemplates = {
  "Educación e información":entry("art. 18.1",8,["Necesidad y riesgos","Puestos, grupos y accesibilidad","Objetivo de aprendizaje","Contenido y actividades","Estrategia, facilitador y lugar","Duración por participante y trimestre","Evaluación, nivelación y evidencias"]),
  "Inducción y cambios de puesto":entry("art. 18.2",8,["Ingreso o cambio que activa la inducción","Puestos y riesgos","Contenidos y recorrido","Práctica y verificación","Facilitador, registro y actualización"]),
  "Inspecciones":entry("art. 18.2.5",9,["Áreas, equipos, turnos y enfoque","Frecuencia y participantes","Lista de verificación","Registro de hallazgos","Asignación, plazo y cierre eficaz"]),
  "Monitoreo de riesgos y condiciones de trabajo":entry("art. 18.2.5.5",9,["Exposición priorizada","Puestos, personas y condiciones","Variable, método e instrumento","Frecuencia y criterio de evaluación","Respuesta, control y seguimiento"]),
  "Vigilancia epidemiológica de la salud":entry("art. 18.2.6",9,["Población y exposiciones","Fuentes agregadas","Análisis y frecuencia","Responsables, reporte y medidas","Seguimiento de resultados"]),
  "Utilización del tiempo libre":entry("art. 18.2.7",10,["Población y necesidades","Actividades de recreación, descanso o turismo social","Cronograma y responsables","Registro de participación y evaluación"]),
  "Reglas y procedimientos de trabajo seguro":entry("art. 18.2.8",10,["Tareas y riesgos aplicables","Documento, versión y responsable","Difusión y práctica","Verificación de aplicación y actualización"]),
  "Protección personal y colectiva":entry("art. 18.2.9",10,["Riesgo y controles existentes","Criterios de selección","Dotación, uso, mantenimiento y reposición","Responsable y registro","Verificación del control"]),
  "Atención preventiva de la salud":entry("art. 18.2.10",10,["Puestos, exposiciones y población","Evaluaciones previstas","Cronograma y responsable","Seguimiento y registro agregado"]),
  "Ingeniería, ergonomía y mantenimiento":entry("art. 18.2.13",11,["Equipo, puesto y problema","Estudio o método de evaluación","Medida y responsables","Mantenimiento y criterio técnico","Verificación y revisión"]),
  "Contingencias y emergencias":entry("art. 18.2.11",10,["Escenarios y áreas","Organización, roles y comunicaciones","Medios y recursos","Preparación y ejercicios","Evaluación y acciones de mejora"]),
  "Desalojo de instalaciones":entry("art. 18.2.11 y Guía, capítulo IV",10,["Áreas, ocupación y apoyos","Rutas y puntos de encuentro","Roles, señal y comunicaciones","Ejercicio, evidencia y mejoras"]),
  "Recursos económicos":entry("art. 18.2.12",11,["Actividad financiada","Unidades requeridas","Costo unitario y total","Fuente y estado presupuestario","Responsable de revisión"]),
};

export const chapterTemplates = {
  1: entry("Guía de Elaboración, capítulo I",7,["Entidad, centros y alcance","Objetivos y procesos de referencia","Roles, base legal y definiciones"]),
  2: entry("NT-04-2023, arts. 15 y 16",7,["Política específica del centro","Compromisos y objetivos","Consulta, suscripción, difusión y revisión"]),
  3: entry("NT-04-2023, art. 14",6,["Mapa productivo y procesos de trabajo","Diagnóstico por etapa y fuente de evidencia","Consulta, validación y verificaciones pendientes"]),
  4: entry("NT-04-2023, arts. 17 y 18",8,["Hallazgos y prioridades","Planes, responsables y recursos","Cronograma, ejecución y eficacia"]),
  5: entry("NT-04-2023, arts. 19 y 20",11,["Activación y responsables","Fuentes, procedimiento y registros","Medidas, seguimiento y control de acceso a los registros"]),
  6: entry("NT-04-2023, arts. 21 y 22",11,["Entidad y representante","Compromisos, recursos y participación","Referencia de la carta y estado de su revisión"]),
  7: entry("NT-04-2023, arts. 23 y 24",12,["Actividad y partes que intervienen","Procesos, riesgos de interacción y coordinación","Soportes y criterios aplicables"]),
  8: entry("NT-04-2023, art. 26",13,["Indicadores, metas y fuentes","Frecuencia, responsable y participación","Comunicación, acuerdos y seguimiento"]),
};
export const investigationTemplates = {
  accidentes:["Aviso y activación","SSST, participantes y responsables","Descripción, fuentes y reconstrucción",
    "Análisis de causas inmediatas y básicas","Medidas, responsable y plazo","Formato y comprobación de eficacia"],
  enfermedades:["Información inicial y activación","Responsable del SSST","Trayectoria y exposición ocupacional",
    "Fuentes, evaluaciones y procedimiento aplicable","Medidas y seguimiento","Formato y resguardo de registros"],
};
export function outline(fields) {
  return fields.map(field=>field+": [Completar]").join("\n\n");
}
const has = value => typeof value === "string" && value.trim() !== "";
const rowList = value => Array.isArray(value) ? value : [];

export function trainingHours(activities, plans) {
  const education=new Set(rowList(plans).filter(plan=>plan.familia==="Educación e información").map(plan=>plan.id));
  const groups=new Map();
  for (const activity of rowList(activities)) {
    if (!education.has(activity.planRef) || !has(activity.grupo)) continue;
    const timing=schedule(activity);
    const hours=Number(activity.horasPersona);
    if (!timing || !Number.isFinite(hours) || hours<=0 || Math.ceil(timing.start/3)!==Math.ceil(timing.end/3)) continue;
    const group=activity.grupo.trim();
    const key=group.toLocaleLowerCase("es");
    const current=groups.get(key) ?? {group,quarters:[0,0,0,0]};
    current.quarters[Math.ceil(timing.start/3)-1]+=hours;
    groups.set(key,current);
  }
  return [...groups.values()];
}

export function coherenceIssues({one={},two={},three={},four={}}) {
  const issues=[];
  const add=(target,message)=>issues.push({target,message});
  const processes=rowList(one.flujo?.procesos);
  const tasks=rowList(one.tarea?.actividades);
  const risks=rowList(two.filas);
  const plans=rowList(three.planesDetallados);
  const activities=rowList(three.filas);
  const assessed=new Set(risks.map(row=>row.tareaRef).filter(Boolean));
  const planned=new Set(plans.flatMap(recordRefs));
  const activePlans=new Set(activities.filter(row=>has(row.responsable) && schedule(row)).map(row=>row.planRef));
  for (const process of processes) {
    if (process.id && !tasks.some(task=>task.procesoRef===process.id))
      add("tareas",(process.codigo||process.nombre)+" · Proceso sin tareas registradas.");
  }
  for (const task of tasks) {
    if (task.id && risks.length && !assessed.has(task.id))
      add("m2",(task.codigo||task.nombre)+" · Tarea sin hallazgo vinculado. Verifica si ya fue evaluada.");
  }
  for (const risk of risks) {
    const name=risk.codigo||risk.riesgo||"Hallazgo";
    if (risk.prioridad==="Inmediata" && !planned.has(risk.id)) add("planes",name+" · Hallazgo inmediato sin plan vinculado.");
    if (risk.estadoEvaluacion==="Pendiente de medición" && (!has(risk.responsableEvaluacion) || !has(risk.fechaEvaluacion)))
      add("m2",name+" · Define responsable y fecha de la medición pendiente.");
  }
  for (const plan of plans) {
    if (has(plan.nombre) && !activePlans.has(plan.id)) add("m3",(plan.codigo||plan.nombre)+" · Plan sin actividad programada con responsable.");
    if (plan.detalleFamilia?.includes("[Completar]")) add("planes",(plan.codigo||plan.nombre)+" · Plantilla específica con apartados pendientes.");
  }
  for (const activity of activities) {
    if (!has(activity.actividad)) continue;
    if (![activity.enfoque,activity.evidenciaEsperada,activity.eficacia].every(has))
      add("m3",activity.actividad+" · Completa el enfoque, la evidencia esperada o el criterio de eficacia.");
    if (activity.estado==="Ejecutada" && !has(activity.evidenciaReal))
      add("m3",activity.actividad+" · Registra la evidencia de ejecución disponible.");
  }
  for (const {group,quarters} of trainingHours(activities,plans)) {
    quarters.forEach((hours,i)=>{
      if (hours<16) add("m3",group+" · Trimestre "+(i+1)+": "+hours+" horas programadas por persona de las 16 previstas.");
    });
  }
  for (const [key,value] of Object.entries(four)) {
    if (key.startsWith("cap") && typeof value==="string" && value.includes("[Completar]"))
      add("capitulos",key.split("_")[0].replace("cap","Capítulo ")+" · Hay campos de plantilla por completar.");
  }
  if ((has(four.cap5_accidentes)||has(four.cap5_enfermedades)) && !has(four.anexo_investigacion) &&
    !rowList(four.soportes).some(item=>/investigaci|accidente|enfermedad/i.test(item.nombre ?? "")))
    add("anexos","Capítulo V · Identifica el formato de investigación en anexos.");
  return issues;
}
