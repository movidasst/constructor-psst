export const projectFields = [
  ["entidad","Razón social"],["centro","Centro de trabajo y ubicación"],["actividad","Actividad de bienes o servicios"],
  ["periodo","Período del programa"],["version","Versión del borrador"],["equipo","Equipo que lo elabora"],
];

export const planGuides = {
  "Educación e información":"Registra necesidades por grupos expuestos, temas, método, horas por persona y trimestre, facilitadores y evaluación.",
  "Inducción y cambios de puesto":"Registra población, cambios que activan la inducción, contenido, práctica, responsable y evidencia de comprensión.",
  "Inspecciones":"Define áreas y turnos, frecuencia, instrumento, participantes, hallazgos y verificación de las medidas.",
  "Monitoreo de riesgos y condiciones de trabajo":"Indica exposición, método de evaluación, responsable, seguimiento de resultados y fuente.",
  "Vigilancia epidemiológica de la salud":"Indica población, fuentes agregadas, frecuencia de análisis, responsable y reportes.",
  "Utilización del tiempo libre":"Identifica población, actividades, cronograma, responsables y registro de participación.",
  "Reglas y procedimientos de trabajo seguro":"Identifica tareas, procedimientos, medio de difusión, verificación y vigencia.",
  "Protección personal y colectiva":"Registra selección por riesgo, dotación, mantenimiento y verificación de los controles.",
  "Atención preventiva de la salud":"Define programación, puestos y exposiciones, evaluaciones previstas y responsable del seguimiento.",
  "Ingeniería, ergonomía y mantenimiento":"Define método de estudio, equipos o puestos, revisión, mantenimiento y comprobación de la medida.",
  "Contingencias y emergencias":"Identifica escenarios, organización, recursos, comunicaciones, actividades de preparación y evaluación.",
  "Desalojo de instalaciones":"Registra áreas, rutas, puntos de encuentro, personas que requieren apoyo y verificación mediante ejercicios.",
  "Recursos económicos":"Registra unidades, costo unitario, importe total, fuente presupuestaria y responsables de revisión.",
};

export const statuses = ["Pendiente", "En curso", "Ejecutada", "Reprogramada"];
const year = 2027;
const datePattern = /^2027-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

function validDate(value) {
  return typeof value === "string" && datePattern.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}

export function schedule(row) {
  if (row.fechaInicio || row.fechaFin) {
    if (!validDate(row.fechaInicio) || !validDate(row.fechaFin) || row.fechaFin < row.fechaInicio) return null;
    return { start:Number(row.fechaInicio.slice(5,7)), end:Number(row.fechaFin.slice(5,7)),
      from:row.fechaInicio, to:row.fechaFin };
  }
  const legacy = /^(?:[1-9]|1[0-2])$/;
  if (!legacy.test(row.inicio) || !legacy.test(row.fin) || Number(row.inicio)>Number(row.fin)) return null;
  return {start:Number(row.inicio),end:Number(row.fin),
    from:year+"-"+String(row.inicio).padStart(2,"0"),to:year+"-"+String(row.fin).padStart(2,"0")};
}

export function recordRefs(row) {
  return [...new Set([...(Array.isArray(row.riesgoRefs) ? row.riesgoRefs : []),row.riesgoRef].filter(Boolean))];
}

export function draftReadiness(four, inputs) {
  const one=inputs.m1?.data;
  const two=inputs.m2?.data?.m2;
  const three=inputs.m3?.data?.m3;
  const hasChapter = number => Object.entries(four ?? {}).some(([key,value]) =>
    (key === "cap"+number || key.startsWith("cap"+number+"_")) && typeof value==="string" && Boolean(value.trim()) && !value.includes("[Completar]"));
  const has = value => typeof value === "string" && Boolean(value.trim());
  return [
    ["I · Generalidades",hasChapter(1)],
    ["II · Política",hasChapter(2)],
    ["III · Procesos y riesgos",hasChapter(3) || Boolean(one?.flujo?.procesos?.length && two?.filas?.length)],
    ["IV · Planes y cronograma",hasChapter(4) || Boolean(three?.planesDetallados?.length && three?.filas?.some(schedule))],
    ["V · Investigación",hasChapter(5)],
    ["VI · Compromiso",hasChapter(6) || has(four?.compromiso)],
    ["VII · Otras consideraciones",hasChapter(7) || Boolean(four?.contratistas?.length)],
    ["VIII · Evaluación",hasChapter(8) || Boolean(four?.indicadores?.length)],
  ];
}
