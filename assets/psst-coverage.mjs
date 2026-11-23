export const chapterRoute = [
  ["I", "Generalidades", "M1", "Datos, objetivos, alcance y responsables."],
  ["II", "Política de SST", "M4", "Política, consulta, firma, difusión y revisión."],
  ["III", "Descripción del trabajo y riesgos", "M1 + M2", "M1 describe y documenta. M2 evalúa y prepara el cierre del diagnóstico."],
  ["IV", "Planes de trabajo", "M3", "Fichas, actividades, inversión y carta Gantt."],
  ["V", "Investigación", "M4", "Cómo investigar accidentes y enfermedades ocupacionales."],
  ["VI", "Compromiso de cumplimiento", "M4", "Responsable, compromisos y carta."],
  ["VII", "Otras consideraciones", "M4", "Contratistas, coordinación y condiciones particulares."],
  ["VIII", "Evaluación del programa", "M4", "Indicadores, revisión y seguimiento."],
];
export const annexRoute = "M1 aporta las evidencias de campo, M2 la matriz y M3 los planes, el presupuesto y la Gantt. M4 reúne el índice de anexos y los soportes de revisión.";

const filled = value => typeof value === "string" && value.trim() && !/\[completar\]/i.test(value);
const join = (...parts) => parts.filter(filled).join(" · ");

export function sourceSections(inputs = {}) {
  const one = inputs.m1?.data ?? {};
  const two = inputs.m2?.data?.m2 ?? {};
  const three = inputs.m3?.data?.m3 ?? {};
  const profile = one.proyecto ?? {};
  const fields = one.generalidades ?? {};
  const base = {...fields};
  if (!filled(base.entidad)) base.entidad = join(profile.entidad,profile.centro,profile.actividad,one.alcance?.centro);
  if (!filled(base.alcance)) base.alcance = join(one.alcance?.centro,one.alcance?.area);
  const fromM1 = Object.fromEntries(Object.entries(base).map(([key,value])=>["cap1_"+key,value]));
  return {...fromM1,cap3_validacion: two.validacionDiagnostico || one.mesa?.asamblea,
    cap4_presupuesto: three.revisionInversion};
}

export function sectionCoverage(chapterStructure, draft, sources, supported) {
  return chapterStructure.flatMap(([title,sections],i) => sections.map(([key,label]) => {
    const chapter = i+1;
    const id = "cap"+chapter+"_"+key;
    const status = filled(draft[id]) ? "Redactado" : filled(sources[id]) || supported[id] ? "Con datos de origen" : "Por completar";
    return {chapter,title,label,id,status};
  }));
}

function decimal(value) {
  const text = String(value ?? "").trim().replace(",", ".");
  return /^\d+(?:\.\d+)?$/.test(text) && Number.isFinite(Number(text)) ? Number(text) : null;
}
export function investmentRows(entries = [], plans = []) {
  return entries.filter(row=>row.concepto).map(row => {
    const amount = decimal(row.cantidad), unitCost = decimal(row.unitario);
    const total = amount === null || unitCost === null ? null : amount * unitCost;
    return {...row,plan:plans.find(plan=>plan.id===row.planRef)?.codigo ?? "",
      total:total === null || !Number.isFinite(total) ? "Por estimar" : total.toFixed(2)};
  });
}

const hasRows = (rows, key) => Array.isArray(rows) && rows.some(row=>filled(row[key]));
export function structuredSections(inputs = {}, draft = {}) {
  const one = inputs.m1?.data ?? {};
  const two = inputs.m2?.data?.m2 ?? {};
  const three = inputs.m3?.data?.m3 ?? {};
  return {
    cap1_objetivos_especificos: hasRows(draft.objetivos,"nombre"),
    cap3_organigrama: hasRows(one.alcance?.estructura,"nombre") || filled(one.alcance?.organigrama),
    cap3_proceso_productivo: hasRows(one.flujo?.productivos,"nombre") || filled(one.flujo?.proceso),
    cap3_diagramas: hasRows(one.flujo?.etapasMapa,"nombre") || hasRows(one.flujo?.productivos,"secuencia") || filled(one.flujo?.referencia),
    cap3_riesgos: hasRows(two.filas,"riesgo") || filled(two.matriz),
    cap4_prioridades: hasRows(three.planesDetallados,"nombre") && three.planesDetallados.some(plan=>plan.riesgoRefs?.length||plan.riesgoRef),
    cap4_estructura: hasRows(three.planesDetallados,"nombre"),
    cap4_presupuesto: hasRows(three.partidas,"concepto"),
    cap4_cronograma: Array.isArray(three.filas) && three.filas.some(row=>filled(row.actividad) &&
      ((row.fechaInicio && row.fechaFin) || (row.inicio && row.fin))),
    cap6_carta: filled(draft.compromiso),
    cap7_contratacion: hasRows(draft.contratistas,"nombre"),
    cap8_criterios: hasRows(draft.indicadores,"nombre"),
  };
}

export const workingFormats = [
  ["asamblea","Registro de asamblea y validación",["Centro y fecha","Convocatoria y agenda","Nómina general y fecha de corte","Asistencia","Votos y resultado","Acta, acuerdos y responsables"]],
  ["formacion","Registro de formación e inducción",["Actividad, fecha y modalidad","Puestos y riesgos","Facilitador y duración","Participación y asistencia","Aprendizaje comprobado","Nivelación y evidencias"]],
  ["proteccion","Registro de dotación de EPP",["Puesto y riesgo","Equipo, modelo y talla","Cantidad y entrega","Instrucciones y verificación de uso","Reposición y evidencia de recepción"]],
  ["inspeccion","Ficha de inspección preventiva",["Centro, área, fecha y turno","Equipo participante","Elemento y condición observada","Medida, responsable y plazo","Fecha y firma de verificación de eficacia"]],
  ["accidente","Ficha interna de investigación de accidentes",["Código, fecha y lugar","Aviso y constancias de comunicación","Cronología, hechos y fuentes","Causas inmediatas y básicas","Medidas, responsable y fecha","Verificación de eficacia"]],
  ["enfermedad","Ficha interna de investigación de enfermedad ocupacional",["Código del caso y responsable del SSST","Historia ocupacional y exposiciones","Fuentes y valoraciones reservadas","Declaración y constancia","Medidas colectivas y seguimiento"]],
  ["seguimiento","Registro de evaluación del PSST",["Período, participantes y acta","Indicador, fuente, meta y resultado","Medidas, responsable y plazo","Seguimiento","Constancia del informe del CSSL"]],
];
