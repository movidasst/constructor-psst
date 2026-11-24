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
  "Educación e información":entry("art. 18.1",8,["Necesidad y riesgos","Puestos, grupos y accesibilidad","Objetivo de aprendizaje","Contenido y actividades","Estrategia, facilitador y lugar","Horas por persona y trimestre (mínimo 16; justificar aumentos por exposición)","Evaluación, nivelación y evidencias"]),
  "Inducción y cambios de puesto":entry("art. 18.2",8,["Ingreso o cambio que activa la inducción","Puestos y riesgos","Contenidos y recorrido","Práctica y verificación","Facilitador, registro y actualización"]),
  "Inspecciones":entry("art. 18.2.5",9,["Áreas, equipos, turnos y enfoque","Frecuencia y participantes","Instrumento y elementos a inspeccionar","Informe de hallazgos y discusión en el CSSL en dos días continuos","Medida, responsable, plazo y verificación firmada y fechada"]),
  "Monitoreo de riesgos y condiciones de trabajo":entry("art. 18.2.5.5",9,["Exposición priorizada","Puestos, personas y condiciones","Variable, método e instrumento","Frecuencia y criterio de evaluación","Participación del CSSL en el monitoreo","Registro actualizado, medidas y seguimiento"]),
  "Vigilancia epidemiológica de la salud":entry("art. 18.2.6",9,["Población y exposiciones","Fuentes agregadas","Análisis y frecuencia","Responsables, reporte y medidas","Seguimiento de resultados"]),
  "Utilización del tiempo libre":entry("art. 18.2.7",10,["Población y necesidades","Jornada, alimentación, descansos y vacaciones previstos y disfrutados","Cronograma y responsables","Registro de participación y evaluación"]),
  "Reglas y procedimientos de trabajo seguro":entry("art. 18.2.8",10,["Tareas y riesgos aplicables","Documento, versión y responsable","Difusión y práctica","Verificación de aplicación y actualización"]),
  "Protección personal y colectiva":entry("art. 18.2.9",10,["Riesgo y controles existentes","Criterios de selección","Dotación, uso, mantenimiento y reposición","Responsable y registro","Verificación del control"]),
  "Atención preventiva de la salud":entry("art. 18.2.10",10,["Puestos, exposiciones y población","Evaluaciones previstas","Cronograma y responsable","Seguimiento y registro agregado"]),
  "Ingeniería, ergonomía y mantenimiento":entry("art. 18.2.13",11,["Equipo, puesto y problema","Estudio o método de evaluación","Medida y responsables","Registro del proyecto y revisión correspondiente","Mantenimiento predictivo, preventivo y correctivo con personal calificado","Verificación y revisión"]),
  "Contingencias y emergencias":entry("art. 18.2.11",10,["Escenarios y áreas","Organización, roles y comunicaciones","Medios y recursos","Preparación y ejercicios","Evaluación y acciones de mejora"]),
  "Desalojo de instalaciones":entry("art. 18.2.11 y Guía, capítulo IV",10,["Áreas, ocupación y apoyos","Rutas y puntos de encuentro","Roles, señal y comunicaciones","Ejercicio, evidencia y mejoras"]),
  "Recursos económicos":entry("art. 18.2.12",11,["Actividad financiada","Unidades requeridas","Costo unitario y total","Fuente y estado presupuestario","Responsable de revisión"]),
};

export function planReviewNotes(value, family) {
  let record;
  try { record=JSON.parse(value || "{}"); } catch { return {}; }
  if (!record || typeof record !== "object" || Array.isArray(record)) return {};
  if (family === undefined) return record;
  const notes={...record[family]};
  if(family==="Utilización del tiempo libre"){
    notes["Jornada, alimentación, descansos y vacaciones previstos y disfrutados"] ??= notes["Actividades de recreación, descanso o turismo social"];
  }
  return Object.fromEntries((familyTemplates[family]?.fields ?? [])
    .filter(key=>typeof notes?.[key]==="string").map(key=>[key,notes[key]]));
}

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

export function trainingHours(activities, plans, declaredGroups="") {
  const education=new Set(rowList(plans).filter(plan=>plan.familia==="Educación e información").map(plan=>plan.id));
  const groups=new Map();
  function groupFor(name) {
    const group=name.trim();
    const key=group.toLocaleLowerCase("es");
    if (!groups.has(key)) groups.set(key,{group,quarters:[0,0,0,0]});
    return groups.get(key);
  }
  for(const name of (typeof declaredGroups==="string"?declaredGroups.split("\n"):[]).filter(has)) groupFor(name);
  for (const activity of rowList(activities)) {
    if (!education.has(activity.planRef) || !has(activity.grupo)) continue;
    const entry=groupFor(activity.grupo);
    const timing=schedule(activity);
    if(!timing) continue;
    const start=Math.ceil(timing.start/3)-1,end=Math.ceil(timing.end/3)-1;
    const total=Number(activity.horasPersona);
    if(start===end){
      if(Number.isFinite(total)&&total>0) entry.quarters[start]+=total;
      continue;
    }
    const allocated=trainingAllocation(activity);
    if(allocated) allocated.forEach((value,i)=>{entry.quarters[i]+=value;});
  }
  return [...groups.values()];
}

function trainingAllocation(row){
  const timing=schedule(row);
  if(!timing) return null;
  const start=Math.ceil(timing.start/3)-1,end=Math.ceil(timing.end/3)-1;
  const allocation=[1,2,3,4].map(i=>Number(row["horasT"+i]||0));
  if(allocation.some((value,i)=>!Number.isFinite(value)||value<0||(value>0&&(i<start||i>end)))) return null;
  const total=Number(row.horasPersona);
  const allocated=allocation.reduce((a,b)=>a+b,0);
  return allocated>0 && (!total||Math.abs(total-allocated)<0.00001) ? allocation : null;
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
  const verification=new Map(rowList(two.verificaciones).filter(row=>row.tareaRef).map(row=>[row.tareaRef,row]));
  const planned=new Set(plans.flatMap(recordRefs));
  const activePlans=new Set(activities.filter(row=>has(row.responsable) && schedule(row)).map(row=>row.planRef));
  for (const process of processes) {
    if (process.id && !tasks.some(task=>task.procesoRef===process.id))
      add("tareas",(process.codigo||process.nombre)+" · Proceso sin tareas registradas.");
  }
  for (const task of tasks) {
    const progress=verification.get(task.id);
    if (task.id && (risks.length||verification.size) && !assessed.has(task.id) && !progress)
      add("m2",(task.codigo||task.nombre)+" · Registra el estado de la evaluación de esta tarea.");
    if (progress?.estado==="Pendiente de medición" && (!has(progress.responsable)||!has(progress.fecha)))
      add("verificacion",(task.codigo||task.nombre)+" · Asigna fecha y responsable para medir.");
    if (progress?.estado==="Hallazgo registrado" && !assessed.has(task.id))
      add("m2",(task.codigo||task.nombre)+" · Vincula el hallazgo que registraste.");
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
  const education=new Set(plans.filter(plan=>plan.familia==="Educación e información").map(plan=>plan.id));
  for (const activity of activities) {
    if (!has(activity.actividad)) continue;
    if (![activity.enfoque,activity.evidenciaEsperada,activity.eficacia].every(has))
      add("m3",activity.actividad+" · Completa el enfoque, la evidencia esperada o el criterio de eficacia.");
    const timing=schedule(activity);
    if(education.has(activity.planRef) && timing && Math.ceil(timing.start/3)!==Math.ceil(timing.end/3) && !trainingAllocation(activity))
      add("m3",activity.actividad+" · Distribuye las horas entre los trimestres activos y comprueba la suma.");
    if (activity.inicioReal && activity.cierreReal && activity.inicioReal>activity.cierreReal)
      add("m3",activity.actividad+" · Revisa el orden de las fechas reales.");
    if (activity.estado==="Ejecutada" && !has(activity.evidenciaReal))
      add("m3",activity.actividad+" · Registra la evidencia de ejecución disponible.");
  }
  for (const {group,quarters} of trainingHours(activities,plans,three.gruposFormacion)) {
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

const surveillanceExamples = {
  "Monitoreo de riesgos y condiciones de trabajo": [
    "¿En cuáles estaciones sigue siendo insuficiente el control después de la intervención? Vincula arriba los hallazgos del módulo 2.",
    "Ejemplo: se verificaron 4 de 6 compresores intervenidos. De los 4 verificados, 3 cumplieron. Indica período, unidad, fuentes y ambos denominadores.",
    "Define la medición inicial, el método comparable y el criterio técnico que obliga a intervenir.",
    "Identifica la actividad del plan, quién la ejecuta y en qué fecha. Prográmala en la carta Gantt.",
    "Compara antes y después. En el ejemplo, un equipo requiere otra intervención y dos siguen pendientes. Registra la nueva medición y comunica el resultado al CSSL."
  ],
  "Vigilancia epidemiológica de la salud": [
    "¿En qué puestos o turnos se observa la señal de salud y con qué exposición conviene contrastarla?",
    "Distingue consultas de personas únicas. Registra período, población de referencia y fuentes agregadas. Omite nombres, diagnósticos individuales e historias clínicas.",
    "Define la línea base y qué variación activará una investigación. Un reporte aislado requiere contraste antes de atribuir una causa.",
    "Indica quién analizará la señal con los delegados de prevención y qué actividad con fecha incorporarás al cronograma.",
    "Describe la verificación posterior y la publicación mensual de estadísticas agregadas. Protege la identidad incluso en grupos pequeños."
  ],
  "Utilización del tiempo libre": [
    "¿Qué turnos presentan diferencias entre descanso programado y efectivamente disfrutado?",
    "Contrasta jornada, horas extras, pausas de alimentación, descansos obligatorios y convencionales y vacaciones. Registra período, unidad y fuentes de programación y disfrute real.",
    "Documenta la línea base y qué desviación activará una revisión con las personas afectadas.",
    "Asigna responsable y fecha para corregir la programación y vincula la actividad con el cronograma.",
    "Comprueba el disfrute efectivo en el período siguiente. Registra pendientes y comunica resultados agregados."
  ]
};

export function surveillanceFields(family) {
  const examples=surveillanceExamples[family];
  if (!examples) return [];
  return ["¿Qué se vigilará y por qué?","¿Qué se medirá, en quiénes y durante qué período?",
    "¿Qué resultado activará una decisión?","¿Quién actuará y cuándo?",
    "¿Cómo se verificará la eficacia y a quién se informará?"].map((label,index)=>({
      key:"sve"+(index+1),label,help:examples[index]
    }));
}

export function annualTraining(activities,plans,declared="",exposures=[]) {
  const identified=exposures.filter(row=>row.puesto).map(row=>[row.puesto,row.turno].filter(Boolean).join(" · "));
  return trainingHours(activities,plans,[declared,...identified].filter(Boolean).join("\n")).map(({group,quarters})=>({
    group,quarters,total:quarters.reduce((sum,h)=>sum+h,0),
    gaps:quarters.flatMap((h,i)=>h<16?["T"+(i+1)+" faltan "+(16-h)+" h"]:[])
  }));
}

export const planExamples = new Map([
  [
    "Educación e información",
    [
      "Hallazgos y puestos por turno",
      "Programa prácticas trimestrales de circulación segura para los puestos expuestos y registra las horas por persona.",
      "Comprueba en una práctica que cada participante identifica la ruta y sabe qué hacer si está bloqueada."
    ]
  ],
  [
    "Inducción y cambios de puesto",
    [
      "Ingresos, cambios y tareas nuevas",
      "Antes de asignar a una persona a despacho, recorre con ella la ruta y practica cómo avisar de una desviación.",
      "Registra la demostración y el refuerzo cuando la práctica quede incompleta."
    ]
  ],
  [
    "Inspecciones",
    [
      "Áreas, turnos y controles que requieren revisión",
      "Programa recorridos de despacho para revisar barreras, visibilidad y obstrucciones durante el relevo.",
      "Registra cada hallazgo, su revisión, la corrección y la comprobación en el turno afectado."
    ]
  ],
  [
    "Monitoreo de riesgos y condiciones de trabajo",
    [
      "Puestos expuestos, tiempos y mediciones previas",
      "Define una campaña de ruido por puesto y turno con método, responsable y criterio de interpretación.",
      "Documenta si la medición representa la exposición y qué acción corresponde según el resultado."
    ]
  ],
  [
    "Vigilancia epidemiológica de la salud",
    [
      "Exposiciones y registros agregados por grupo",
      "Compara señales de salud y exposición entre grupos, con denominadores y períodos comparables.",
      "Registra la decisión preventiva y cuándo se repetirá el análisis, con resguardo de los datos personales."
    ]
  ],
  [
    "Utilización del tiempo libre",
    [
      "Jornadas, descansos, vacaciones y necesidades por turno",
      "Revisa con cada turno qué descansos se disfrutan y programa ajustes cuando la cobertura del servicio los dificulte.",
      "Contrasta lo programado con lo efectivamente disfrutado y documenta el ajuste."
    ]
  ],
  [
    "Reglas y procedimientos de trabajo seguro",
    [
      "Tarea, secuencia observada y controles críticos",
      "Redacta el procedimiento de descarga con los pasos previos y la actuación ante un cambio de maniobra.",
      "Pide a quienes realizan el trabajo que lo apliquen en una práctica y registra los ajustes."
    ]
  ],
  [
    "Protección personal y colectiva",
    [
      "Riesgo, controles disponibles y condiciones de uso",
      "Define la separación física de rutas y los criterios de selección y mantenimiento de la protección complementaria.",
      "Verifica en el turno que las barreras separan efectivamente las rutas y que la protección se usa cuando corresponde."
    ]
  ],
  [
    "Atención preventiva de la salud",
    [
      "Puestos, exposiciones y población que orientan la atención",
      "El SSST programa las evaluaciones que correspondan a cada grupo y define cómo dará seguimiento a los casos.",
      "Verifica cobertura y seguimiento con registros agregados y custodia clínica separada."
    ]
  ],
  [
    "Ingeniería, ergonomía y mantenimiento",
    [
      "Equipos, condiciones observadas e historial de fallas",
      "Evalúa la ruta de carga y modifica el cruce. Programa además la inspección y reparación de barreras.",
      "Comprueba en operación que la intervención redujo la coincidencia de peatones y equipos."
    ]
  ],
  [
    "Contingencias y emergencias",
    [
      "Escenarios, personal por turno, medios y comunicaciones",
      "Ensaya la respuesta ante una emergencia en despacho y asigna aviso, coordinación y acceso de ayuda.",
      "Registra tiempos y problemas observados y programa otro ejercicio para comprobar las correcciones."
    ]
  ],
  [
    "Desalojo de instalaciones",
    [
      "Ocupación por turno, rutas, visitantes y apoyos requeridos",
      "Practica el desalojo con personal propio y transportistas y verifica el recuento en el punto de encuentro.",
      "Corrige obstrucciones o fallas de recuento y vuelve a comprobar el recorrido."
    ]
  ],
  [
    "Recursos económicos",
    [
      "Actividades, unidades, cotizaciones y meses de ejecución",
      "Vincula la compra e instalación de barreras a la actividad de despacho y distribuye el gasto en el cronograma.",
      "Comprueba los subtotales por cantidad y costo unitario e identifica las partidas pendientes de cotización."
    ]
  ]
]);
