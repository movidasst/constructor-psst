import { renderTimeline } from "./psst-gantt.mjs?v=1";
import { annexRoute, chapterRoute, annualInvestment, investmentRows, sectionCoverage, sourceSections, structuredSections, workingFormats } from "./psst-coverage.mjs?v=investigacion-1";
import { readProof, clearProof } from "./lti-proof.mjs?v=bound-1";
import { exposureRows } from "./psst-exposure.mjs?v=exposicion-1";
import { pdfFromReport } from "./psst-pdf.mjs?v=documento-2";
import { executionStats, followupLabels, nextCode, operationalSchedule, orderedFlows, organizationImport, organizationTree, practiceStore, recordsOf, statusLabels, technicalChecks } from "./psst-builder.mjs?v=organigrama-1";
import { fieldHelp } from "./psst-field-help.mjs?v=organigrama-1";
import { tutorials, glossary } from "./psst-tutorial.mjs?v=secuencia-1";
import { checksLabels, changedSources, modules, projectState, rubrics, technicalPrompts, workTrace } from "./psst-project.mjs?v=organigrama-1";
import { excelGantt, workbookForPSST, zipDocuments, wordFromReport } from "./psst-office.mjs?v=iperc-2";
import { approaches, chapterTemplates, coherenceIssues, familyTemplates, outline, sources, trainingHours, annualTraining, planReviewNotes, surveillanceFields, planExamples } from "./psst-coach.mjs?v=planes-guiados-1";
import { draftReadiness, planGuides, projectFields, recordRefs, schedule, statuses } from "./psst-program.mjs?v=sve-1";
import { buildDiagramDocument, buildGanttDocument, buildPsstDocument, contractorSheet, organizationDiagram, scheduledActivities } from "./psst-document.mjs?v=iperc-2";
import { reviewGroups } from "./psst-review.mjs?v=linked-1";
import { annexStructure, chapterKey, chapterStructure } from "./psst-chapters.mjs?v=secuencia-1";

const apiRoot = "https://edeydaueyxilutczhazm.supabase.co/functions/v1/psst-lti/";
const status = document.getElementById("status");
const startup = document.getElementById("startup");
const form = document.getElementById("draft");
const deliver = document.getElementById("deliver");
const receipt = document.getElementById("receipt");
const grant = new URLSearchParams(location.hash.slice(1));
const ticket = grant.get("ticket");
if (location.hash) history.replaceState(null, "", location.pathname + location.search);

let session;
let practice;
let revision;
let draft;
let savedValues;
let lastDelivery;
let pending;
let busy = false;
let projectInfo;
let recoveryKey;
let autosaveTimer;
let conflict = false;
let deliveredArchive;
let rememberedRisks;

const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const rowSchemas = {
  estructura: {group:"alcance",key:"estructura",singular:"Cargo o área",fields:[
    ["nombre","Nombre del cargo o área",true],["reportaA","Reporta a",false,"cargos"],["observacion","Función o coordinación"],
  ]},
  mapa: {group:"flujo",key:"etapasMapa",singular:"Etapa del proceso productivo",fields:[
    ["flujoRef","Proceso productivo",true,"productivos"],["nombre","Etapa",true],
    ["area","Área o responsable"],["entradas","Qué recibe"],["salidas","Qué entrega"],
    ["excepcion","Desvío, devolución o condición particular"],
  ]},
  productivos: {group:"flujo",key:"productivos",singular:"Proceso productivo",fields:[
    ["codigo","Código del proceso productivo",true],["nombre","Nombre del proceso productivo",true],
    ["entradas","Entradas e insumos"],["secuencia","Secuencia de etapas e interfaces",true],
    ["salidas","Resultados y salidas"],["evidencia","Referencia al diagrama de flujo"],
  ]},
  objetivos: {group:"m4",key:"objetivos",singular:"Objetivo específico",fields:[
    ["codigo","Código del objetivo",true],["nombre","Resultado que se busca",true],
    ["planRef","Plan relacionado",false,"planesEntregados"],["indicadorRef","Indicador de seguimiento",false,"indicadores"],
  ]},
  contratistas: {group:"m4",key:"contratistas",singular:"Obra o servicio de terceros",fields:[
    ["nombre","Obra o servicio",true],["parte","Empresas que participan en la obra o servicio"],["procesos","Procesos y áreas que comparten"],
    ["riesgoRef","Hallazgo registrado en M2",false,"riesgos"],["controles","Coordinación y controles de la interacción"],
    ["referenteInterno","Responsable de la empresa contratante"],["referenteExterno","Responsable de la empresa contratista"],
    ["acuerdoInicio","Antes · ¿qué acuerdan ambas partes y quién confirma que pueden comenzar?"],
    ["acuerdoEjecucion","Durante · ¿quién verifica los controles y cómo comunican un cambio o una desviación?"],
    ["acuerdoCierre","Al cierre · ¿quién registra pendientes, asigna plazos y verifica las correcciones?"],
    ["responsable","Responsable de verificar"],["evidencia","Referencia del acuerdo y estado: previsto, acordado o verificado"],
  ]},
  indicadores: {group:"m4",key:"indicadores",singular:"Indicador",fields:[
    ["codigo","Código",true],["nombre","Indicador",true],["planRef","Plan o actividad que se evalúa",false,"planesEntregados"],
    ["formula","Fórmula o criterio de evaluación",true],["base","Línea base y fecha"],["meta","Meta y unidad",true],
    ["fuente","Fuente de datos",true],["frecuencia","Periodicidad",true],["responsable","Responsable",true],
    ["respuesta","Qué hacer si hay desviación"],
  ]},
  anexos: {group:"m4",key:"soportes",singular:"Anexo",fields:[
    ["codigo","Código",true],["nombre","Documento o evidencia",true],["familia","Grupo de anexo",false,"anexoFamilias"],["capitulo","Capítulo o código al que respalda"],
    ["version","Versión y fecha"],["ubicacion","Ubicación o referencia"],["estado","Estado del soporte",false,"soportes"],
    ["responsable","Responsable de completarlo"],["custodio","Custodio y personas autorizadas"],
    ["revisionAcceso","Fecha de revisión del acceso",false,"verification-date"],
  ]},
  procesos: { group:"flujo", key:"procesos", singular:"Proceso de trabajo", fields:[
    ["codigo","Código (p. ej., P-01)",true], ["nombre","Nombre del proceso de trabajo",true],
    ["productivoRef","Proceso productivo",true,"productivos"], ["etapaMapaRef","Etapa del mapa",false,"etapasMapa"], ["area","Área o departamento"], ["entradas","Entradas, materiales y sustancias"],
    ["objetoSujeto","Objeto o sujeto · ¿sobre qué material, información o persona se realiza el trabajo?"], ["mediosProceso","Medios · ¿con qué equipos, herramientas o instalaciones se trabaja?"], ["actividadProceso","Actividad · ¿qué hacen realmente las personas para obtener el resultado?"], ["organizacionProceso","Organización · ¿cómo se establecen turnos, ritmo, pausas y coordinación?"], ["divisionProceso","División del trabajo · ¿quién hace cada parte y a quién entrega el resultado?"], ["secuencia","Secuencia y organización descritas"], ["salidas","Productos, residuos y disposición"],
    ["contratistas","Contratistas e interacciones"], ["evidencia","Diagrama, croquis u otra evidencia"],
  ] },
  campo: { group:"bitacora", key:"registros", singular:"Actividad de campo", fields:[
    ["fecha","Fecha",true,"verification-date"],["actividad","Actividad realizada",true],["horas","Horas registradas",true,"hours"],
    ["tareaRef","Tarea observada",false,"tareasPropias"],["tipo","Fuente o método",false,"tiposEvidencia"],
    ["evidencia","Código o referencia privada de la evidencia",true],
  ] },
  verificacion: { group:"m2", key:"verificaciones", singular:"Revisión de tarea", fields:[
    ["tareaRef","Tarea inventariada",true,"tareas"],["estado","Estado de la tarea",true,"estadosTarea"],
    ["evidencia","Fuente o referencia privada"],["justificacion","Justificación y alcance de la revisión",true],
    ["responsable","Responsable de verificar"],["fecha","Fecha prevista",false,"verification-date"],
  ] },
  tareas: { group:"tarea", key:"actividades", singular:"Tarea", fields:[
    ["codigo","Código (p. ej., T-01)",true], ["procesoRef","Proceso del inventario",true,"procesos"],
    ["etapa","Etapa",true], ["nombre","Tarea observada",true], ["descripcion","Secuencia real de la tarea",true],
    ["puestos","Puestos y personal expuesto"], ["medios","Herramientas, equipos y objetos"],
    ["organizacion","Turnos, ritmo y organización"], ["evidencia","Fuente o evidencia"],
    ["fechaCampo","Fecha de observación",false,"verification-date"], ["observacion","1. Observar · hechos vistos en el puesto"], ["consulta","2. Conversar · aporte de quien hace la tarea"], ["devolucion","3. Devolver · qué confirmó o corrigió la persona al leerle la descripción"], ["contraste","Diferencias y aspectos por confirmar"],
  ] },
  inversion: {group:"m3",key:"partidas",singular:"Partida",fields:[
    ["planRef","Plan que necesita el recurso",true,"planes"],["actividadRef","Actividad financiada",false,"actividadesPlan"],["mesGasto","Mes previsto del gasto",false,"budgetMonth"],["concepto","Recurso o compra",true],
    ["cantidad","Cantidad",true],["unidad","Unidad",false],["unitario","Costo por unidad",true],
    ["moneda","Moneda",true],["fuente","Fuente del precio"],["responsable","Responsable"],
  ]},
  planes: { group:"m3", key:"planesDetallados", singular:"Plan", fields:[
    ["codigo","Código del plan",true], ["nombre","Nombre del plan",true],
    ["familia","Familia de plan",true,"familias"], ["riesgoRefs","Hallazgos vinculados",false,"riesgos-multiple"],
    ["detalleFamilia","Desarrollo específico de la familia"],
    ["objetivo","Objetivo",true], ["meta","Meta verificable",true], ["alcance","Alcance",true],
    ["frecuencia","Frecuencia",true], ["responsable","Personal y responsabilidades",true],
    ["procedimiento","Procedimiento de ejecución",true], ["instrumentos","Formularios e instrumentos",true],
    ["recursos","Recursos y presupuesto",true], ["seguimiento","Indicador o evidencia",true],
  ] },
  expuestos: {group:"m2",key:"gruposExpuestos",singular:"Puesto o grupo expuesto",fields:[
    ["hallazgoRef","Hallazgo de la matriz",true,"riesgosPropios"],["puesto","Puesto de trabajo o función",true],
    ["area","Área o zona de exposición",true],["turno","Turno o franja de exposición",true],
    ["grupo","Tipo de personal",true,"personasExpuestas"],["cantidad","Cantidad de personas expuestas",false,"headcount"],
    ["frecuencia","Frecuencia de exposición"],["duracion","Duración aproximada de la exposición"],
    ["fuente","Fuente del conteo o cómo se confirmará",true],
  ]},
  m2: { group:"m2", key:"filas", singular:"Hallazgo IPERC", fields:[
    ["codigo","Código del hallazgo",true], ["tareaRef","Tarea registrada en M1",false,"tareas"],
    ["etapa","Etapa o tarea",true], ["situacion","Situación de trabajo",false,"situacionesTrabajo"],
    ["trabajoReal","Trabajo previsto y variaciones observadas"],
    ["peligro","Fuente o condición con capacidad de causar daño",true], ["proceso","Proceso peligroso asociado"],
    ["expuestos","Nota sobre personas expuestas o registro anterior"],
    ["interaccion","Vía de exposición, patrón y magnitud cuando aplique"],
    ["evento","Evento posible · qué podría ocurrir"],
    ["riesgo","Consecuencia posible · qué daño podría causar",true],
    ["controles","Controles existentes y evidencia de su funcionamiento"],
    ["metodoHallazgo","Método, versión y escala para este hallazgo"],
    ["valoracion","Valoración inicial · factores, fundamento y resultado"],
    ["prioridad","Prioridad de actuación",false,"prioridades"],
    ["evidencia","Referencia de la evidencia"], ["pendiente","Dato o medición que falta"],
    ["estadoEvaluacion","Estado de la evaluación",false,"evaluaciones"], ["responsableEvaluacion","Responsable de verificar"],
    ["fechaEvaluacion","Fecha prevista de verificación",false,"verification-date"],
    ["controlPropuesto","Medida propuesta y nivel en la jerarquía"], ["justificacionControl","Qué variable cambia y por qué"],
    ["criterioEficacia","¿Qué resultado demostrará que la medida funciona?"],
    ["estadoResidual","Estado del riesgo residual",false,"estadosResiduales"],
    ["valoracionResidual","Valoración residual · factores y resultado con el mismo método"],
    ["evidenciaResidual","Evidencia de eficacia · registro, fecha y resultado observado"],
  ] },
  m3: { group:"m3", key:"filas", singular: "Actividad", fields: [
    ["planRef","Plan de trabajo",true,"planes"], ["plan","Nombre del plan en una versión anterior"],
    ["actividad","Actividad preventiva",true], ["riesgoRef","Hallazgo de M2",false,"riesgos"], ["hallazgo","Referencia complementaria del hallazgo"], ["responsable","Responsable",true],
    ["centro","Centro de trabajo"],["fechaInicio","Fecha prevista de inicio",false,"date"], ["fechaFin","Fecha prevista de cierre",false,"date"],
    ["inicioReal","Fecha real de inicio",false,"verification-date"],["cierreReal","Fecha real de cierre",false,"verification-date"],["estado","Estado de ejecución",false,"estados"], ["inicio","Mes de inicio guardado",false,"month"], ["fin","Mes de cierre guardado",false,"month"],
    ["enfoque","Enfoque de la actividad",false,"enfoques"], ["detalleEnfoque","Procedimiento y criterio según el enfoque"],
    ["evidenciaEsperada","Evidencia esperada"], ["eficacia","Criterio de eficacia"], ["evidenciaReal","Evidencia de ejecución"],
    ["grupo","Grupo o puesto y turno"],["contenidoForm","Contenido teórico y práctica en el puesto"],["facilitadorForm","Facilitador, lugar y referencia de su currículo"],["evaluacionForm","Aprendizaje esperado y cómo se comprobará"],["asistenciaForm","Horas recibidas por persona y referencia al registro de asistencia"],["nivelacionForm","Nivelación y verificación posterior"], ["horasPersona","Horas de formación por persona (si aplica)",false,"hours"],
    ...Array.from({length:4},(_,i)=>["horasT"+(i+1),"Horas por persona en trimestre "+(i+1)+" (si cruza trimestres)",false,"hours"]), ["objetivo","Objetivo, meta y alcance"], ["frecuencia","Frecuencia"],
    ["procedimiento","Procedimiento e instrumento"], ["recursos","Recursos y presupuesto"],
    ["seguimiento","Indicador o evidencia de ejecución"],
    ["nuevoInicio","Nuevo inicio previsto",false,"verification-date"],["nuevoFin","Nuevo cierre previsto",false,"verification-date"],
    ["motivoReprogramacion","Motivo de reprogramación"],["resultadoEficacia","Resultado de eficacia",false,"resultadoEficacia"],
    ["verificacionEficacia","Fecha de comprobación",false,"verification-date"],["notaEficacia","Resultado observado o ajuste necesario"],
  ] },
  m4: { group:"m4", key:"filas", singular: "Brecha", fields: [
    ["capitulo","Capítulo o sección"], ["brecha","Brecha o hallazgo",true],
    ["accion","Acción para atenderla"], ["responsable","Responsable"],
    ["plazo","Plazo o fecha acordada"], ["evidencia","Evidencia o referencia"],
  ] },
};
const editors = new Map();
let steps = [];
let currentStep = 0;
let stage = "overview";
let displayStage;
let moduleId;
let projectLabel;
let integrationInputs;

function element(tag, content) {
  const node = document.createElement(tag);
  if (content !== undefined) node.textContent = content;
  return node;
}

const families = Object.keys(planGuides);
const optionLists = {
  familias:families, estados:statuses, prioridades:["Inmediata","Programada","Por determinar"],
  estadosResiduales:["Pendiente","Previsto","Verificado"],
  enfoques:Object.keys(approaches), evaluaciones:["En evaluación","Valorada","Pendiente de medición"],
  resultadoEficacia:followupLabels,
  personasExpuestas:["Personal propio","Contratistas","Visitantes","Otro personal"],
  situacionesTrabajo:["Rutinaria","No rutinaria","Emergencia previsible"],
  tiposEvidencia:["Observación directa","Entrevista o consulta","Medición","Fotografía","Video","Revisión documental","Croquis"],
  estadosTarea:["Por observar","Evaluada","Pendiente de medición","Hallazgo registrado"],
  soportes:["Formato en preparación","Formato disponible","Evidencia existente","Pendiente de obtener"],
};

function fieldValue(control) {
  if (control.multiple) return [...(control.selectedOptions ?? [])].map(option=>option.value).filter(Boolean);
  return control.value.trim();
}

function rowValues(key) {
  const editor = editors.get(key);
  if (!editor) return [];
  return [...editor.querySelectorAll(".row-card")].map(row => ({
    id: row.dataset.id,
    ...Object.fromEntries([...row.querySelectorAll("[data-key]")].map(input => [input.dataset.key, fieldValue(input)])),
  }));
}

function choices(type) {
  if(type==="actividadesPlan") return rowValues("m3").filter(r=>r.actividad).map(r=>[r.id,r.actividad]);
  if (type === "anexoFamilias") return annexStructure;
  if (optionLists[type]) return optionLists[type].map(name=>[name,name]);
  const data = ["procesos","planes","productivos","indicadores"].includes(type) ? rowValues(type)
    : type==="cargos" ? rowValues("estructura")
    : type==="etapasMapa" ? rowValues("mapa")
    : type==="riesgosPropios" ? rowValues("m2")
    : type === "planesEntregados" ? (integrationInputs.m3?.data?.m3?.planesDetallados ?? [])
    : type === "tareasPropias" ? rowValues("tareas")
    : type === "tareas" ? (integrationInputs.m1?.data?.tarea?.actividades ?? [])
    : (integrationInputs.m2?.data?.m2?.filas ?? []);
  return (Array.isArray(data) ? data : []).filter(row => row.id && (row.nombre || row.riesgo))
    .map(row => [row.id, [row.codigo,row.nombre || row.riesgo].filter(Boolean).join(" · ")]);
}

function fillSelect(field, available, value) {
  const selected = field.multiple ? value : [value];
  field.replaceChildren(...(field.multiple ? [] : [new Option(field.dataset.link === "cargos" ? "Nivel superior" : "Selecciona", "")]));
  for (const [id,name] of available) field.add(new Option(name,id));
  for (const id of selected.filter(Boolean)) {
    if (!available.some(([availableId])=>availableId===id)) field.add(new Option("Referencia anterior · revisa el vínculo ("+id+")",id));
  }
  if (field.multiple) {
    for (const option of field.options) option.selected = selected.includes(option.value);
  } else field.value = value;
}

function refreshLinks() {
  const structure = new Map(organizationTree(rowValues("estructura")).map(row => [row.id,row]));
  const cargoOptions = choices("cargos");
  for (const editor of editors.values()) {
    for (const control of editor.querySelectorAll("[data-link]")) {
      const type = control.dataset.link;
      const id = control.closest(".row-card")?.dataset.id;
      const available = type === "cargos"
        ? cargoOptions.filter(([candidate]) => candidate !== id && !structure.get(candidate).ancestors.includes(id))
        : choices(type);
      if(type==="actividadesPlan"){
        const planId=control.closest(".row-card").querySelector('[data-key="planRef"]').value;
        const matches=rowValues("m3").filter(a=>a.planRef===planId && a.actividad).map(a=>[a.id,a.actividad]);
        const selected=matches.some(([id])=>id===control.value)?control.value:"";
        fillSelect(control,matches,selected);
        continue;
      }
      const previous=fieldValue(control);
      const single=type==="productivos" && available.length===1 && (!previous || previous===available[0][0]);
      fillSelect(control,available,single?available[0][0]:previous);
      if(type==="productivos") control.closest("label").hidden=single;
    }
  }
}

function filteredActivities(){
  const filters=[["filter-center","centro"],["filter-plan","planRef"],["filter-owner","responsable"]];
  return rowValues("m3").filter(row=>filters.every(([id,key])=>{
    const value=document.getElementById(id)?.value;
    return !value || row[key]===value;
  }));
}

function redrawGantt() {
  if (moduleId !== "m3") return;
  const view = document.getElementById("gantt-view");
  const all=rowValues("m3");
  for(const [id,key,caption] of [["filter-center","centro","Todos los centros"],["filter-plan","planRef","Todos los planes"],["filter-owner","responsable","Todos los responsables"]]){
    const input=document.getElementById(id);
    if(!input?.add) continue;
    const before=input.value;
    const options=[...new Set(all.map(row=>row[key]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es"));
    const label=value=>key==="planRef" ? (rowValues("planes").find(plan=>plan.id===value)?.nombre||value) : value;
    input.replaceChildren(new Option(caption,""),...options.map(value=>new Option(label(value),value)));
    if(options.includes(before)) input.value=before;
  }
  const rows = scheduledActivities(filteredActivities());
  renderTimeline(document.getElementById("gantt-chart"), rows, {
    mode: document.getElementById("gantt-scale").value,
    open: id => focusRecord("m3", id),
  });
  if (!rows.length) {
    view.replaceChildren(element("p", "Agrega una actividad con fechas previstas para ver el cronograma."));
    return;
  }
  const table = element("table");
  table.setAttribute("aria-label", "Carta Gantt 2027");
  const header = table.createTHead().insertRow();
  for (const label of ["Actividad","Responsable","Estado", ...months,"Ficha"]) {
    const cell = element("th", label);
    cell.scope = "col";
    header.append(cell);
  }
  const body = table.createTBody();
  for (const row of rows) {
    const line = body.insertRow();
    const label = element("th", row.actividad);
    label.scope = "row";
    line.append(label);
    line.insertCell().textContent = row.responsable || "Por asignar";
    line.insertCell().textContent = row.estado || "Pendiente";
    const timing = operationalSchedule(row);
    for (let month = 1; month <= 12; month++) {
      const cell = line.insertCell();
      if (month >= timing.start && month <= timing.end) {
        cell.dataset.active = "";
        cell.textContent = "●";
        cell.setAttribute("aria-label", "Programada en " + months[month - 1]);
      }
    }
    const edit = line.insertCell();
    edit.className = "gantt-edit";
    edit.append(actionButton("Editar actividad", () => focusRecord("m3", row.id)));
  }
  view.replaceChildren(table);
}

function reference(text,href) {
  const link=element("a",text);
  link.href=href;
  link.target="_blank";
  link.rel="noopener noreferrer";
  return link;
}

function showRowHelp(row,key,value) {
  if (!row) return;
  const box=row.querySelector("[data-row-help]");
  if (!box) return;
  const family=key==="familia" ? value : row.querySelector('[data-key="familia"]')?.value;
  const approach=key==="enfoque" ? value : row.querySelector('[data-key="enfoque"]')?.value;
  box.replaceChildren();
  if (family && familyTemplates[family]) {
    const template=familyTemplates[family];
    const text=element("p",planGuides[family]);
    if (family==="Educación e información") text.append(" · Referencia: 16 horas trimestrales por trabajador.");
    const button=element("button","Usar plantilla");
    button.type="button";
    button.addEventListener("click",()=>{
      const field=row.querySelector('[data-key="detalleFamilia"]');
      if (busy || !field) return;
      if (!field.value.trim()) { field.value=outline(template.fields); rowChanged(); }
      else tell("La plantilla se puede insertar en un campo vacío. Conservé el texto que ya escribiste.");
      field.focus();
    });
    box.append(text,reference("Consultar NT-04-2023, "+template.clause,sources.nt+"#page="+template.page),button);
    const example = planExamples.get(family);
    if (example) {
      const guide = element("details");
      guide.className = "module-details";
      const context = element("ul");
      const showInputs = () => {
        const refs = fieldValue(row.querySelector('[data-key="riesgoRefs"]'));
        const risks = recordsOf(integrationInputs?.m2?.data?.m2?.filas);
        const linked = risks.filter(risk => refs.includes(risk.id));
        context.replaceChildren(...linked.map(risk=>element("li",
          [risk.codigo, risk.riesgo, risk.controlPropuesto, risk.criterioEficacia].filter(Boolean).join(" · "))));
        if (!linked.length) context.append(element("li","Selecciona los hallazgos vinculados cuando el plan responda a uno o varios riesgos del módulo 2."));
      };
      guide.append(element("summary","Elaborar este plan paso a paso"),
        element("h4","Insumos que debes reunir"),element("p",example[0]),context,
        element("h4","Ejemplo de actividad"),element("p",example[1]),
        element("h4","Cómo verificar el resultado"),element("p",example[2]),
        element("p","Con los datos de tu empresa, completa objetivo, meta, responsables y recursos. Luego pulsa «Programar actividad» para llevarla al cronograma."));
      showInputs();
      row.querySelector('[data-key="riesgoRefs"]').onchange = showInputs;
      guide.addEventListener("toggle",showInputs);
      box.append(guide);
    }
    if(family==="Educación e información"){
      box.prepend(element("h3","Plan anual de capacitación 2027"));
      box.append(actionButton("Ver los cuatro trimestres y los grupos pendientes",()=>{
        const control=form.elements.namedItem("m3.gruposFormacion");
        revealControl(control);control.focus();
      }));
    }
    const storage=row.querySelector('[data-key="revisionArt18"]');
    const questions=surveillanceFields(family);
    if (questions.length) {
      const section=element("fieldset");
      section.append(element("legend","Ficha de vigilancia epidemiológica articulada"));
      section.append(element("p","Selecciona los hallazgos vinculados arriba. Completa estos cinco pasos con datos de campo. Las respuestas se incorporan al plan del capítulo IV."));
      const namespace="vigilancia/"+family;
      for (const {key,label,help} of questions) {
        const wrapper=element("label",label);
        const input=element("textarea");
        input.rows=2;
        input.value=planReviewNotes(storage.value)[namespace]?.[key] || "";
        input.addEventListener("input",()=>{
          const record=planReviewNotes(storage.value);
          record[namespace]={...record[namespace],[key]:input.value};
          storage.value=JSON.stringify(record);
          rowChanged();
        });
        wrapper.append(element("small",help),input);
        section.append(wrapper);
      }
      box.append(section);
    }
    const notes=planReviewNotes(storage.value,family);
    const checklist=element("details");
    const summary=element("summary");
    const updateSummary=()=> {
      const count=template.fields.filter(criterion=>notes[criterion]?.trim()).length;
      summary.textContent="Revisión de la ficha · "+count+" de "+template.fields.length+" criterios con referencia";
    };
    updateSummary();
    checklist.append(summary,element("p","Indica dónde se desarrolla cada criterio, qué evidencia lo respalda o qué debes completar. La referencia registrada queda sujeta a revisión del SSST."));
    for (const criterion of template.fields) {
      const label=element("label",criterion);
      const input=element("textarea");
      input.rows=2;
      input.placeholder="Apartado, actividad, soporte o pendiente";
      input.value=notes[criterion] || "";
      input.addEventListener("input",()=>{
        notes[criterion]=input.value.trim();
        storage.value=JSON.stringify({...planReviewNotes(storage.value),[family]:notes});
        updateSummary();
        rowChanged();
      });
      label.append(input);
      checklist.append(label);
    }
    box.append(checklist);
  } else if (approach && approaches[approach]) {
    const [meaning,action,example]=approaches[approach];
    box.append(element("p",meaning),element("p",action),element("p","Ejemplo: "+example),
      reference("Consultar NT-04-2023, art. 17.1.1.4",sources.nt+"#page=8"));
  }
}

function updateRowLabels(key, editor) {
  const schema = rowSchemas[key];
  const rows = [...editor.querySelectorAll(".row-card")];
  rows.forEach((row, index) => {
    const label = key === "estructura"
      ? row.querySelector('[data-key="nombre"]').value.trim() || (index === 0 ? "Máxima autoridad" : "Nuevo cargo o área")
      : schema.singular + " " + (index + 1);
    row.querySelector("legend").textContent = label;
    row.querySelector("[data-remove]").setAttribute("aria-label", "Quitar " + label.toLowerCase());
  });
  const add = editor.querySelector("[data-add]");
  add.disabled = busy;
  if (key==="productivos") add.hidden=rows.length>0;
  if (key === "estructura") add.textContent = rows.length ? "Agregar otro cargo" : "Agregar máxima autoridad";
}

function rowChanged(event) {
  const key = event?.target?.dataset?.key;
  if (key === "tareaRef") {
    const task = (integrationInputs.m1?.data?.tarea?.actividades ?? []).find(item => item.id === event.target.value);
    const stage = event.target.closest(".row-card")?.querySelector('[data-key="etapa"]');
    if (task && stage) stage.value = task.etapa ?? "";
  }
  if (!event || key==="planRef" || key==="actividad" || key === "codigo" || key === "nombre" || key === "riesgo" || key === "reportaA") refreshLinks();
  if (key === "nombre" || !event) {
    const organization = editors.get("estructura");
    if (organization) updateRowLabels("estructura",organization);
  }
  renderBuilder();
  if (!event || ["actividad","centro","planRef","inicio","fin","fechaInicio","fechaFin","nuevoInicio","nuevoFin","responsable","estado"].includes(key)) redrawGantt();
  if (key === "familia" || key === "enfoque") showRowHelp(event.target.closest(".row-card"));
  if (["m1","m2","m3","m4"].includes(moduleId)) showCoherence();
  if (!event || moduleId === "m3") renderPlanCoverage();
  if (!event || moduleId === "m4") showReadiness();
  tell("Tienes cambios en el borrador.");
  refreshDelivery();
  renderProjectDetails();
  if (stage === "closing") renderChapterCoverage();
  queueAutosave();
}

function appendRow(editorKey, editor, values = {}, focus = false) {
  const row = element("fieldset");
  row.className = editorKey === "estructura" ? "row-card organization-row" : "row-card";
  row.dataset.id = values.id || crypto.randomUUID();
  const fields = element("div");
  fields.className = "fields";
  for (const [key, label, required, type] of rowSchemas[editorKey].fields) {
    if (editorKey === "m2") {
      const heading = {codigo:"1 · Actividad y trabajo real",peligro:"2 · Peligro",expuestos:"3 · Exposición",
        evento:"4 · Evento",riesgo:"5 · Consecuencia",controles:"6 · Valoración inicial",controlPropuesto:"7 · Control y riesgo residual"}[key];
      if (heading) {
        const title = element("h3",heading);
        title.className = "wide";
        fields.append(title);
      }
    }
    const wrapper = element("label", label);
    const isInput = !type || ["date","verification-date","hours","headcount"].includes(type);
    const long = ["acuerdoInicio","acuerdoEjecucion","acuerdoCierre","detalleFamilia","detalleEnfoque","observacion","consulta","devolucion","contraste","controlPropuesto","justificacionControl"].includes(key);
    const field = element(long ? "textarea" : isInput ? "input" : "select");
    const value = key==="riesgoRefs" ? recordRefs(values)
      : key==="estado" && editorKey==="m3" ? (values.estado || "Pendiente")
      : typeof values?.[key] === "string" ? values[key] : type==="headcount" && Number.isSafeInteger(values[key]) ? String(values[key]) : "";
    if (type === "month" || type==="budgetMonth") {
      field.add(new Option("Elige un mes", ""));
      months.forEach((month,index) => field.add(new Option(month, String(index + 1))));
    } else if (type === "date" || type === "verification-date") {
      field.type = "date";
      if (type==="date") { field.min = "2027-01-01"; field.max = "2027-12-31"; }
    } else if (type === "headcount") {
      field.type = "number";
      field.min = "1";
      field.max = String(Number.MAX_SAFE_INTEGER);
      field.step = "1";
      field.placeholder = "Pendiente si queda en blanco";
      field.addEventListener("input",()=>{
        field.setCustomValidity(field.value && !/^[1-9][0-9]*$/.test(field.value) ? "Escribe un número entero en cifras." : "");
      });
    } else if (type === "hours") {
      field.type = "number";
      field.min = "0";
      field.step = "0.25";
    } else if (type) {
      field.dataset.link = type;
      if (type === "riesgos-multiple") { field.multiple = true; field.size = 5; }
      fillSelect(field,choices(type),value);
    } else {
      field.maxLength = 800;
      if (editorKey === "estructura" && key === "nombre") field.placeholder = "Ej. Dirección general";
      if (editorKey === "productivos" && key === "secuencia") field.placeholder = "Recepción, preparación, despacho";
    }
    if(key==="evidencia"||key==="ubicacion"){
      const help=element("small","Usa un código o una referencia a un repositorio con acceso autorizado. Registra la fecha o condición de revisión del acceso cuando corresponda.");
      help.className="field-guide";
      wrapper.append(help);
    }
    field.dataset.key = key;
    field.required = Boolean(required) && !(key === "planRef" && values.plan && !values.planRef)
      && !(key === "codigo" && !focus && !value)
      && !(key === "productivoRef" && !focus && !value);
    if (!field.multiple) field.value = value;
    if (editorKey === "m3" && key === "plan" && !value) wrapper.hidden = true;
    if (type==="month" && !value) wrapper.hidden = true;
    wrapper.append(field);
    if (key === "familia") {
      const guide=element("small",planGuides[value] || "");
      guide.className="field-guide";
      guide.dataset.planGuide="";
      wrapper.append(guide);
    }
    fields.append(wrapper);
  }
  const remove = element("button", "Quitar fila");
  remove.type = "button";
  remove.dataset.remove = "";
  remove.addEventListener("click", () => {
    if (busy) return;
    if (editorKey === "estructura") {
      const parent = row.querySelector('[data-key="reportaA"]').value;
      for (const child of editor.querySelectorAll('[data-key="reportaA"]')) {
        if (child.value === row.dataset.id) child.value = parent;
      }
    }
    row.remove();
    updateRowLabels(editorKey, editor);
    editor.querySelector("[data-add]").focus();
    rowChanged();
  });
  row.append(element("legend"));
  if (editorKey === "m2") row.append(document.getElementById("iperc-guide").content.cloneNode(true));
  row.append(fields);
  if (editorKey === "contratistas") {
    row.append(actionButton("Descargar esta ficha en Word",()=>{
      const agreement = rowValues("contratistas").find(item=>item.id===row.dataset.id);
      if (!agreement?.nombre.trim()) {
        tell("Escribe el nombre de la obra o servicio para descargar su ficha.","error");
        row.querySelector('[data-key="nombre"]').focus();
        return;
      }
      const sheet = contractorSheet(agreement,integrationInputs?.m2?.data?.m2?.filas ?? []);
      downloadBlob(wordFromReport(sheet),"Ficha_coordinacion_"+agreement.nombre.replace(/[^\p{L}\p{N}-]+/gu,"_").slice(0,80)+".docx");
    }));
  }
  if (editorKey === "inversion") {
    const total = element("p");
    total.dataset.investmentTotal = "";
    row.append(total);
  }
  if (editorKey === "planes") {
    const review=element("input");
    review.type="hidden";
    review.dataset.key="revisionArt18";
    review.value=typeof values.revisionArt18 === "string" ? values.revisionArt18 : "";
    row.append(review);
  }
  if (editorKey === "planes" || editorKey === "m3") {
    const help=element("div");
    help.dataset.rowHelp="";
    help.className="field-help";
    row.append(help);
    const helpKey=editorKey==="planes" ? "familia" : "enfoque";
    const valueForHelp=typeof values[helpKey]==="string" ? values[helpKey] : "";
    if (valueForHelp) showRowHelp(row,helpKey,valueForHelp);
  }
  const guideFields = editorKey==="tareas" ? ["observacion",["Fecha, turno y lugar","Tarea observada","Personas y medios","Condición observada","Fuente"]]
    : editorKey==="m2" ? ["justificacionControl",["Condición de origen","Control considerado en la fuente","Justificación y medidas complementarias","Verificación prevista"]] : null;
  if (guideFields) {
    const button=element("button","Usar plantilla");
    button.type="button";
    button.addEventListener("click",()=>{
      const field=row.querySelector('[data-key="'+guideFields[0]+'"]');
      if (busy || !field) return;
      if (!field.value.trim()) { field.value=outline(guideFields[1]); rowChanged(); }
      else tell("La plantilla se puede insertar en un campo vacío. Conservé el texto que ya escribiste.");
      field.focus();
    });
    row.append(button);
  }
  if (editorKey === "estructura") {
    const actions = element("div");
    actions.className = "actions";
    actions.append(actionButton("Agregar debajo", () => {
      const name = fields.querySelector('[data-key="nombre"]');
      if (!name.value.trim()) {
        name.focus();
        tell("Escribe primero el nombre del cargo al que reportará.","error");
        return;
      }
      newLinkedRow("estructura", {reportaA:row.dataset.id});
    }), remove);
    row.append(actions);
  } else row.append(remove);
  editor.querySelector("[data-rows]").append(row);
  updateRowLabels(editorKey, editor);
  if (editorKey==="productivos" || editorKey==="procesos") {
    const product=editorKey==="productivos";
    row.append(actionButton(product?"Agregar proceso de trabajo vinculado":"Agregar tarea de este proceso",()=>{
      const name=row.querySelector('[data-key="nombre"]');
      if(!name.value.trim()){name.focus();tell("Escribe el nombre antes de continuar.","error");return;}
      const target=product?"procesos":"tareas";
      const values=product?{productivoRef:row.dataset.id}:{procesoRef:row.dataset.id};
      newLinkedRow(target,{...values,codigo:nextCode(product?"P":"T",rowValues(target))});
    }));
  }
  if(editorKey==="m3"){
    const planField=row.querySelector('[data-key="planRef"]');
    const updateTraining=()=>{
      const education=rowValues("planes").find(p=>p.id===planField.value)?.familia==="Educación e información";
      for(const key of ["contenidoForm","facilitadorForm","evaluacionForm","asistenciaForm","nivelacionForm"]){
        const control=row.querySelector('[data-key="'+key+'"]');
        control.closest("label").hidden=!education && !control.value;
      }
    };
    updateTraining();
    planField.addEventListener("change",updateTraining);
    row.querySelector('[data-key="grupo"]').setAttribute("list","training-populations");
    row.append(actionButton("Agregar partida para esta actividad",()=>{
      if(!planField.value||!row.querySelector('[data-key="actividad"]').value.trim()){
        tell("Selecciona el plan y escribe la actividad antes de presupuestarla.","error");return;
      }
      const date=row.querySelector('[data-key="fechaInicio"]').value;
      newLinkedRow("inversion",{planRef:planField.value,actividadRef:row.dataset.id,mesGasto:date?String(Number(date.slice(5,7))):""});
    }));
  }
  if (editorKey==="mapa") addStageOrder(row,editor);
  if (editorKey==="planes") addPlanActivity(row);
  if (editorKey==="m2" && document.getElementById("exposure-panel")?.tagName==="SECTION") {
    const report=element("p");
    report.dataset.exposureSummary="";
    row.append(report,actionButton("Registrar puestos expuestos",()=>{
      const item=rowValues("m2").find(entry=>entry.id===row.dataset.id);
      if(!item?.codigo||!item.riesgo){
        tell("Registra el código y el posible daño del hallazgo antes de vincular los puestos.","error");
        focusRecord("m2",row.dataset.id);
        return;
      }
      const task=integrationInputs?.m1?.data?.tarea?.actividades?.find(entry=>entry.id===item.tareaRef);
      const process=integrationInputs?.m1?.data?.flujo?.procesos?.find(entry=>entry.id===task?.procesoRef);
      newLinkedRow("expuestos",{hallazgoRef:item.id,area:process?.area||""});
      if(task?.puestos) tell("Puestos anotados en la tarea del Módulo 1: "+task.puestos+". Verifica cada puesto y su cantidad.");
    }));
  }
  if (focus) fields.querySelector("[data-key]").focus();
  return row;
}

function setupRows(info) {
  moduleId = info.moduleId;
  integrationInputs = info.inputs ?? {};
  const keys = {m1:["estructura","productivos","mapa","procesos","tareas","campo"],m2:["verificacion","m2","expuestos"],m3:["planes","m3","inversion"],m4:["m4","objetivos","contratistas","indicadores","anexos"]};
  for (const key of keys[moduleId] ?? []) {
    const editor = form.querySelector('[data-editor="' + key + '"]');
    if (!editor) continue;
    editors.set(key,editor);
    const schema = rowSchemas[key];
    const values = info.draft?.[schema.group]?.[schema.key];
    if (Array.isArray(values)) values.forEach(row => appendRow(key,editor,row));
    editor.querySelector("[data-add]").addEventListener("click", () => {
      if (busy || (key==="productivos" && rowValues(key).length)) return;
      const productive = rowValues("productivos").filter(row => row.nombre);
      const parent = productive.length === 1 ? productive[0].id : "";
      const defaults = key === "productivos" ? {codigo:nextCode("F",rowValues(key))}
        : key === "procesos" ? {codigo:nextCode("P",rowValues(key)),productivoRef:parent}
        : key === "mapa" ? {flujoRef:parent}
        : {};
      appendRow(key,editor,defaults,true);
      rowChanged();
    });
  }
  refreshLinks();
  redrawGantt();
  renderPlanCoverage();
}

function renderTutorial(guide, resumeIndex) {
  const overview = document.getElementById("tutorial-overview");
  const heading = element("h2", "Qué vas a construir");
  heading.tabIndex = -1;
  const summary = element("dl");
  summary.className = "module-summary";
  for (const [label, value] of [
    ["Parte del PSST", guide.chapters],
    ["Primero haz esto", guide.first],
    ["Al terminar tendrás", guide.result],
  ]) {
    const item = element("div");
    item.append(element("dt", label), element("dd", value));
    summary.append(item);
  }
  const start = element("button", resumeIndex > 0 ? "Continuar en el paso " + (resumeIndex + 1) : "Empezar paso 1");
  start.type = "button";
  start.className = "primary-button";
  start.addEventListener("click", () => showStep(currentStep, true));
  const map = element("details");
  map.className = "module-details";
  const route = element("ul");
  route.className = "chapter-route";
  for (const [number, title, owner, description] of chapterRoute) {
    const item = element("li");
    item.append(element("strong", number + " · " + title + " (" + owner + ")"), element("p", description));
    route.append(item);
  }
  map.append(element("summary","Dónde se construyen los ocho capítulos"),route,element("p",annexRoute));
  const terms = element("details");
  terms.className = "module-details";
  terms.append(element("summary", "Qué necesitas y términos útiles"), element("p", guide.supplies));
  const definitions = element("dl");
  for (const [term, definition] of glossary[moduleId]) {
    definitions.append(element("dt", term), element("dd", definition));
  }
  terms.append(definitions);
  overview.replaceChildren(heading, summary, start, map, terms);
  return start;
}

function renderStepTutorial(section, guide, index) {
  const [, actions, sample, ready] = guide.steps[index];
  const panel = element("div");
  panel.className = "tutorial-step";
  const destination = element("p", guide.destinations[index]);
  destination.className = "step-destination";
  const list = element("ol");
  for (const action of actions) list.append(element("li", action));
  const help = element("details");
  help.append(element("summary", "Ejemplo y referencia técnica"), element("p", sample));
  const previousHelp = section.querySelector(".step-help");
  const reference = previousHelp?.querySelector(".reference");
  if (reference) help.append(reference);
  previousHelp?.remove();
  const check = element("p");
  check.className = "tutorial-check";
  check.append(element("strong", "Listo cuando: "), ready);
  panel.append(destination, element("h3", "Qué hacer aquí"), list, check, help);
  section.querySelector("legend").after(panel);
}

function setupSteps() {
  steps = [...form.querySelectorAll("[data-module]")]
    .filter(section => section.dataset.module === moduleId);
  const guide = tutorials[moduleId];
  let resumed = 0;
  if (recoveryKey) {
    try {
      const saved = sessionStorage.getItem(recoveryKey + ":capitulos");
      const oldRoute = sessionStorage.getItem(recoveryKey + ":ruta");
      const previous = oldRoute === null
        ? Math.max(0, (Number(sessionStorage.getItem(recoveryKey + ":step")) || 0) - (moduleId === "m1" ? 1 : 0))
        : Number(oldRoute);
      resumed = saved === null ? previous + (moduleId === "m1" && previous > 0 ? 1 : 0) : Number(saved);
    } catch {}
  }
  currentStep = steps[resumed] ? resumed : 0;
  const start = renderTutorial(guide, currentStep);

  const nav = document.getElementById("step-nav");
  steps.forEach((section, index) => {
    section.id ||= moduleId + "-paso-" + (index + 1);
    const title = section.querySelector("legend");
    title.tabIndex = -1;
    const stepName = guide.steps[index][0];
    title.textContent = stepName;
    renderStepTutorial(section, guide, index);
    const item = element("li");
    const button = element("button", stepName);
    button.type = "button";
    button.className = "quiet-button";
    button.setAttribute("aria-controls", section.id);
    button.addEventListener("click", () => showStep(index, true));
    item.append(button);
    nav.append(item);
  });

  const overview = document.getElementById("tutorial-overview");
  const controls = document.getElementById("step-controls");
  const navigation = document.getElementById("step-actions");
  const actionPanel = document.getElementById("action-panel");
  const closing = document.getElementById("module-close");
  document.getElementById("final-document").hidden = moduleId !== "m4";
  document.getElementById("close-result").textContent = guide.result;
  document.getElementById("close-next").textContent = practice
    ? "Guarda tu avance de práctica. Puedes seguir con otro módulo del caso Centro Norte."
    : guide.next;

  function screen(name) {
    stage = name;
    overview.hidden = name !== "overview";
    controls.hidden = name === "overview";
    navigation.hidden = name === "overview";
    actionPanel.hidden = name === "overview";
    closing.hidden = name !== "closing";
    steps.forEach((section, position) => { section.hidden = name !== "step" || position !== currentStep; });
    document.getElementById("step-next").hidden = name !== "step" || currentStep === steps.length - 1;
    document.getElementById("step-finish").hidden = name !== "step" || currentStep !== steps.length - 1;
    document.getElementById("step-back").hidden = name === "step" && currentStep === 0;
    document.getElementById("step-menu").open = false;
    if (name === "closing") renderChapterCoverage();
    refreshDeliveryVisibility();
  }
  displayStage = screen;
  screen("overview");

  document.getElementById("step-overview").addEventListener("click", () => {
    start.textContent = "Continuar en el paso " + (currentStep + 1);
    screen("overview");
    overview.querySelector("h2").focus({preventScroll:true});
    overview.scrollIntoView({block:"start"});
  });
  document.getElementById("step-back").addEventListener("click", () =>
    showStep(stage === "closing" ? steps.length - 1 : currentStep - 1, true));
  document.getElementById("step-next").addEventListener("click", () => showStep(currentStep + 1, true));
  document.getElementById("step-finish").addEventListener("click", () => {
    screen("closing");
    document.getElementById("step-status").textContent = "Revisión final del módulo";
    const title = document.getElementById("close-heading");
    title.focus({preventScroll:true});
    title.scrollIntoView({block:"start"});
  });
}

function refreshDeliveryVisibility() {
  deliver.hidden = Boolean(practice) || stage !== "closing";
}

function showStep(index, focus) {
  if (!steps[index]) return;
  currentStep = index;
  displayStage("step");
  const nav = document.getElementById("step-nav");
  [...nav.querySelectorAll("button")].forEach((button, position) => {
    if (position === index) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });
  document.getElementById("step-status").textContent = "Paso " + (index + 1) + " de " + steps.length;
  const nextTitle = tutorials[moduleId].steps[index + 1]?.[0];
  document.getElementById("step-next").textContent = nextTitle ? "Siguiente: " + nextTitle : "Siguiente";
  if (recoveryKey) {
    try { sessionStorage.setItem(recoveryKey + ":capitulos", String(index)); } catch {}
  }
  if (focus) {
    steps[index].querySelector("legend").focus({preventScroll:true});
    steps[index].scrollIntoView({block:"start"});
  }
}

function currentInputs(record) {
  return moduleId === "m4" ? integrationInputs : {
    ...integrationInputs, [moduleId]: {data:record},
  };
}

function renderChapterCoverage() {
  const view = document.getElementById("chapter-coverage");
  const draft = collectDraft();
  const inputs = currentInputs(draft);
  const finalFields = moduleId === "m4" ? draft.m4 : {};
  const sections = sectionCoverage(chapterStructure,finalFields,sourceSections(inputs),structuredSections(inputs,finalFields));
  const owns = {m1:[1,3],m2:[3],m3:[4],m4:[1,2,3,4,5,6,7,8]};
  const list = element("ul");
  for (const chapter of owns[moduleId]) {
    const fields = sections.filter(section=>section.chapter===chapter);
    const pending = fields.filter(section=>section.status==="Por completar");
    const item = element("li");
    const details = element("details");
    const qualifier = chapter === 3 && moduleId !== "m4" ? " · diagnóstico compartido entre M1 y M2" : "";
    details.append(element("summary",chapterRoute[chapter-1][0] + " · " + fields[0].title +
      qualifier + " · " + (fields.length-pending.length) + "/" + fields.length + " apartados con avance"));
    const parts = element("ul");
    for (const field of fields) {
      const row = element("li",field.label + " · " + field.status);
      const input = form.elements.namedItem((moduleId==="m4"?"m4.":"generalidades.") +
        (moduleId==="m4"?field.id:field.id.slice(5)));
      if (input) row.append(" ",actionButton("Abrir apartado",()=>{revealControl(input);input.focus();}));
      parts.append(row);
    }
    details.append(parts);
    item.append(details);
    list.append(item);
  }
  const children = [element("h3","Avance por apartados"),list];
  if (moduleId === "m4") {
    const missing = annexStructure.filter(([key,title]) =>
      !finalFields?.["anexo_"+key]?.trim() && !finalFields?.soportes?.some(row=>row.familia===key && row.nombre && row.ubicacion));
    const annexes = element("details");
    annexes.append(element("summary","Anexos · "+(annexStructure.length-missing.length)+"/"+annexStructure.length+" grupos con referencia"));
    const checklist = element("ul");
    for (const [key,title] of missing) checklist.append(element("li",title+" · Por revisar"));
    annexes.append(checklist);
    children.push(annexes);
  }
  view.replaceChildren(...children);
}

function renderPlanCoverage() {
  const view = moduleId === "m3" && document.getElementById("plan-coverage");
  if (!view?.replaceChildren) return;
  const plans = rowValues("planes");
  const activities = scheduledActivities(rowValues("m3")).filter(row=>row.responsable);
  const list = element("ul");
  for (const family of families) {
    const matches = plans.filter(row=>row.nombre && row.familia===family);
    const scheduled = matches.some(plan=>recordRefs(plan).length && activities.some(row=>row.planRef===plan.id));
    const item = element("li", family + " · " +
      (scheduled ? "Con vínculo y actividad programada" : matches.length ? "Ficha en preparación" : "Por documentar"));
    const existing = matches[0];
    item.append(" ",actionButton(existing ? "Abrir ficha" : "Crear ficha",() => {
      if (existing) focusRecord("planes",existing.id);
      else newLinkedRow("planes",{codigo:nextCode("PL",rowValues("planes")),familia:family,nombre:family});
    }));
    list.append(item);
  }
  const linked = new Set(plans.flatMap(recordRefs));
  const pending = (integrationInputs?.m2?.data?.m2?.filas ?? []).filter(row=>row.prioridad==="Inmediata" && !linked.has(row.id));
  for (const risk of pending) list.append(element("li","Hallazgo inmediato sin plan vinculado · "+(risk.codigo || risk.riesgo)));
  view.replaceChildren(list);
}

function showCoherence() {
  const panel=document.getElementById("coherence");
  if (!panel?.replaceChildren) return;
  let one=integrationInputs?.m1?.data ?? {},two=integrationInputs?.m2?.data?.m2 ?? {};
  let three=integrationInputs?.m3?.data?.m3 ?? {},four={};
  if (moduleId==="m1") one={flujo:{procesos:rowValues("procesos")},tarea:{actividades:rowValues("tareas")}};
  if (moduleId==="m2") two={filas:rowValues("m2"),verificaciones:rowValues("verificacion"),gruposExpuestos:rowValues("expuestos")};
  if (moduleId==="m3") three={planesDetallados:rowValues("planes"),filas:rowValues("m3"),gruposFormacion:formValues().find(([key])=>key==="m3.gruposFormacion")?.[1]};
  if (moduleId==="m4") {
    four=Object.fromEntries(formValues().filter(([key])=>key.startsWith("m4.")).map(([key,value])=>[key.slice(3),value]));
    four.soportes=rowValues("anexos");
  }
  const issues=coherenceIssues({one,two,three,four});
  if (issues.length===0) {
    panel.replaceChildren(element("p","No se detectaron pendientes en estas comprobaciones."));
  } else {
    const list=element("ul");
    for (const {target,message} of issues) {
      const item=element("li",message);
      const local=editors.get(target) ?? (moduleId==="m4" && target==="capitulos" ? form.querySelector("[data-chapter]") : null);
      if (local) {
        const button=element("button","Ir al paso");
        button.type="button";
        button.addEventListener("click",()=>{
          revealControl(local);
          local.scrollIntoView({block:"center"});
        });
        item.append(" ",button);
      }
      list.append(item);
    }
    panel.replaceChildren(list);
  }
  if (moduleId==="m3") {
    const hours=trainingHours(three.filas,three.planesDetallados,three.gruposFormacion);
    if (hours.length>0) panel.append(element("p","Horas programadas por persona: "+
      hours.map(({group,quarters})=>group+" ("+quarters.map((h,i)=>"T"+(i+1)+" "+h+" h").join(", ")+")").join(" · ")+"."));
  }
}

function setupProjectFields() {
  const container = document.getElementById("project-fields");
  if (moduleId !== "m1" || !container?.append) return;
  for (const [key,title] of projectFields) {
    const label=element("label",title);
    const input=element("input");
    input.name="proyecto."+key;
    input.maxLength=500;
    label.append(input);
    container.append(label);
  }
}

function showReadiness() {
  const panel = document.getElementById("chapter-readiness");
  if (moduleId !== "m4" || !panel?.replaceChildren) return;
  const current=Object.fromEntries(formValues().filter(([key])=>key.startsWith("m4.")).map(([key,value])=>[key.slice(3),value]));
  for (const key of ["contratistas","indicadores"]) current[key]=rowValues(key);
  const fields = sectionCoverage(chapterStructure,current,sourceSections(integrationInputs),structuredSections(integrationInputs,current));
  const pending = fields.filter(field=>field.status==="Por completar");
  panel.textContent = (fields.length-pending.length) + " de " + fields.length +
    " apartados con redacción o datos de origen. Revisa su detalle en Avance por apartados.";
  const one = integrationInputs.m1?.data ?? {};
  const two = integrationInputs.m2?.data?.m2 ?? {};
  const three = integrationInputs.m3?.data?.m3 ?? {};
  const checks = element("div");
  const group = (title) => {
    const details = element("details");
    details.className = "module-details";
    const list = element("ul");
    details.append(element("summary",title),list);
    checks.append(details);
    return list;
  };
  const add = (list, message, chapter, control) => {
    const item = element("li",message);
    if (control) item.append(" ",actionButton("Abrir registro",()=>{
      revealControl(control);
      control.focus();
    }));
    if (chapter) item.append(" ",actionButton("Registrar brecha",()=>{
      if (!rowValues("m4").some(row=>row.capitulo===chapter && row.brecha===message)) {
        newLinkedRow("m4",{capitulo:chapter,brecha:message});
      } else tell("Esta brecha ya está registrada.");
    }));
    list.append(item);
  };
  const findings = recordsOf(two.filas).filter(row=>row.riesgo);
  const tasks = group("Tareas evaluadas");
  for (const task of recordsOf(one.tarea?.actividades).filter(row=>row.nombre)) {
    const count = findings.filter(row=>row.tareaRef===task.id).length;
    const reviewed = recordsOf(two.verificaciones).some(row=>row.tareaRef===task.id && row.estado==="Evaluada");
    const message = [task.codigo,task.nombre].filter(Boolean).join(" · ");
    add(tasks,message+" — "+(count ? count+" hallazgo(s)" : reviewed ? "Evaluada sin hallazgos registrados" : "Evaluación pendiente"),count||reviewed ? "" : "III");
  }
  if (!tasks.children.length) add(tasks,"El módulo 1 aún no aporta tareas a esta revisión.","III");
  const controls = group("Hallazgos prioritarios y medidas");
  const priority = findings.filter(row=>["Inmediata","Programada"].includes(row.prioridad));
  const plans = recordsOf(three.planesDetallados);
  for (const risk of priority) {
    const activities = recordsOf(three.filas).filter(row=>row.riesgoRef===risk.id && row.actividad);
    const label = [risk.codigo,risk.riesgo].filter(Boolean).join(" · ");
    if (!activities.length) add(controls,label+" — Falta una actividad vinculada.","IV");
    for (const activity of activities) {
      const missing = [
        [!plans.some(plan=>plan.id===activity.planRef),"plan"],
        [!activity.responsable?.trim(),"responsable"],
        [!schedule(activity),"fechas"],
        [!activity.eficacia?.trim(),"criterio de eficacia"],
      ].filter(([absent])=>absent).map(([,name])=>name);
      add(controls,label+" · "+activity.actividad+" — "+(missing.length ? "Falta "+missing.join(", ") : "Programada con responsable, fechas y criterio de eficacia"),missing.length ? "IV" : "");
    }
  }
  if (!priority.length) add(controls,"Sin hallazgos con prioridad inmediata o programada en el módulo 2.");
  const chapters = group("Capítulos, evidencia y justificación");
  for (const [index,[title,criteria]] of reviewGroups.entries()) {
    const chapter = String(index+1);
    for (const [key,label] of criteria) {
      const state = current["estado_"+key];
      const note = current["nota_"+key]?.trim();
      const complete = Boolean(note && ["Documentado","No aplica, con justificación"].includes(state));
      const status = complete ? (state==="Documentado" ? "Documentado con referencia" : "No aplica, justificado")
        : state==="Documentado" ? "Falta referencia de evidencia" : state?.startsWith("No aplica") ? "Falta justificar" : state || "Por revisar";
      add(chapters,title+" · "+label+" — "+status,complete ? "" : chapter,
        form.elements.namedItem("m4.nota_"+key));
    }
  }
  const course = element("a","Abrir el curso de Moodle para corregir en el módulo de origen");
  course.href = "https://movidasst.org/course/view.php?id=154";
  course.target = "_blank";
  course.rel = "noopener noreferrer";
  panel.append(checks,course);

}

function setupFieldHelp(info) {
  const helper = {m2:"risk",m3:"action"}[info.moduleId];
  if (!helper) return;
  const guide = fieldHelp[helper];
  const details = element("details");
  details.className = "field-workshop";
  const steps = element("ol");
  for (const step of guide.steps) steps.append(element("li",step));
  details.append(element("summary",guide.title),steps,element("p",guide.example),
    reference(...guide.reference));
  document.getElementById(helper+"-help").append(details);
}

const writingPrompts = {
  cap2_politica: [
    ["Compromiso preventivo","Qué riesgos de tu centro atenderás primero y qué condiciones quieres mejorar"],
    ["Cumplimiento y recursos","Qué compromisos asume la entidad y qué medios pondrá a disposición"],
    ["Consulta y mejora","Cómo participarán los trabajadores, el CSSL y los delegados de prevención"],
  ],
  cap5_accidentes: [
    ["1. Activación y comunicaciones","Indica quién recibe el aviso, coordina la atención, realiza la notificación y declaración aplicables y conserva sus constancias. ¿Cómo activa el SSST la investigación junto con los delegados de prevención?"],
    ["2. Recopilación de hechos","Indica quién recoge datos en el sitio tan pronto sea posible y entrevista individualmente a los testigos. ¿Cómo registrarán cada hecho, su fuente y lo pendiente de comprobar?"],
    ["3. Reconstrucción y causas","Describe cómo ordenarán los hechos y contrastarán la tarea prevista con el trabajo real, el equipo y la organización del turno. Si usan el Árbol de Causas, partan del hecho final y pregunten qué tuvo que ocurrir para que sucediera. Sustenten las causas inmediatas y básicas con evidencia."],
    ["4. Medidas y eficacia","Explica cómo relacionarán cada medida con el hecho o barrera, quién la ejecutará, en qué plazo y cómo verificarán su eficacia en el puesto."],
    ["5. Actualización del PSST","Indica quién revisará el proceso y la tarea del módulo 1, actualizará la evaluación de riesgos del módulo 2 y dará seguimiento a la medida en el plan y cronograma del módulo 3. Identifica el formato y dónde se archivará."],
  ],
  cap5_enfermedades: [
    ["Activación y responsable","Cómo recibe el caso el SSST y quién coordina"],
    ["Historia ocupacional y exposición","Qué registros de puestos, tareas, períodos y evaluaciones se revisan"],
    ["Declaración y resguardo","Cómo se declara cuando corresponda y dónde se resguarda el expediente"],
    ["Medidas y seguimiento","Qué decisiones se registran y cómo se verifica su efecto"],
  ],
  cap8_cronograma: [
    ["Ciclo y responsables","Qué se revisa, cuándo y quién toma las decisiones"],
    ["Participación","Cómo intervienen las personas trabajadoras y el CSSL"],
    ["Informe mensual del CSSL","Quién prepara el informe, cuándo se presenta y dónde queda la constancia"],
  ],
};

function writingAid(key, target) {
  const details = element("details");
  details.className = "module-details chapter-aid";
  details.append(element("summary","Redactar con los datos de tu entidad"));
  const fields = writingPrompts[key].map(([heading,placeholder])=>{
    const label = element("label",heading);
    const input = element("textarea");
    input.maxLength = 480;
    input.placeholder = placeholder;
    label.append(input);
    details.append(label);
    return [heading,input];
  });
  const message = element("p");
  message.setAttribute("role","status");
  details.append(actionButton("Incorporar texto al apartado",()=>{
    if (busy) return;
    const pieces = fields.filter(([,input])=>input.value.trim()).map(([heading,input])=>heading + ": " + input.value.trim());
    const addition = pieces.join("\n");
    if (!addition) { message.textContent = "Escribe al menos un dato para incorporarlo."; return; }
    const next = [target.value.trim(),addition].filter(Boolean).join("\n\n");
    if (next.length > target.maxLength) { message.textContent = "El texto supera el espacio del apartado. Resume el contenido antes de agregarlo."; return; }
    target.value = next;
    fields.forEach(([,input])=>{input.value="";});
    details.open = false;
    rowChanged();
    target.focus();
  }),message);
  return details;
}

function setupChapterFields() {
  if (moduleId !== "m1" && moduleId !== "m4") return;
  const prefix = moduleId === "m1" ? "generalidades." : "m4.";
  const origin = sourceSections(integrationInputs);
  for (const container of form.querySelectorAll('fieldset[data-module="' + moduleId + '"] [data-chapter]')) {
    const number = Number(container.dataset.chapter);
    const definition = chapterStructure[number - 1];
    if (!definition) continue;
    const fields = element("div");
    fields.className = "fields";
    for (const [key,title,guide] of definition[1]) {
      const label = element("label",title);
      label.className = "wide";
      label.hidden = moduleId === "m1" && ["objetivo_general","objetivos_especificos"].includes(key);
      const control = element("textarea");
      const fullKey = chapterKey(number,key);
      control.name = prefix + (moduleId === "m1" ? key : fullKey);
      const source = origin[fullKey];
      if (moduleId === "m4" && source) {
        control.placeholder = "Se incorpora desde el módulo de origen. Escribe aquí solo si debes ajustar el texto.";
        const previous = element("details");
        previous.className = "module-details";
        previous.append(element("summary","Ver texto del módulo de origen"),element("p",source));
        fields.append(previous);
      }
      if (moduleId === "m1" && key === "basamento") control.placeholder =
        "Ej. LOPCYMAT, Reglamento Parcial, NT-04-2023 y normas aplicables a los trabajos del centro.";
      control.maxLength = 2400;
      const help = element("small",guide);
      help.className = "field-guide";
      help.id = control.name.replace(".","-") + "-ayuda";
      control.setAttribute("aria-describedby",help.id);
      label.append(help,control);
      fields.append(label);
      if (moduleId === "m4" && writingPrompts[fullKey]) fields.append(writingAid(fullKey,control));
    }
    container.append(fields);
    const definitionTemplate=chapterTemplates[number];
    const toolbar=element("div");
    toolbar.className="field-help";
    const url=number===1 ? sources.guia : sources.nt;
    toolbar.append(reference(definitionTemplate.clause,url+"#page="+definitionTemplate.page));
    container.append(toolbar);
  }
  if (moduleId !== "m4") return;
  const annexes = document.getElementById("chapter-annexes");
  if (!annexes?.append) return;
  const formats = document.getElementById("annex-formats");
  const select = element("select");
  select.setAttribute("aria-label","Formato editable");
  for (const [id,title] of workingFormats) select.add(new Option(title,id));
  function downloadFormat(formatId) {
    const [id,title,fields] = workingFormats.find(([key])=>key===formatId);
    const report = document.implementation.createHTMLDocument(title);
    report.body.append(element("h1",title));
    for (const label of fields) report.body.append(element("h3",label),element("p","____________________________________________"));
    downloadBlob(wordFromReport(report.documentElement.outerHTML),"PSST_Formato_"+id+".docx");
  }
  formats.append(select,actionButton("Descargar formato en Word",()=>downloadFormat(select.value)));
  document.getElementById("download-accident-format").addEventListener("click",()=>downloadFormat("accidente"));
  for (const [key,title] of annexStructure) {
    const label = element("label",title);
    const control = element("textarea");
    control.name = "m4.anexo_" + key;
    control.maxLength = 1200;
    label.append(control);
    annexes.append(label);
  }
}

function setupReview() {
  const container = moduleId === "m4" && document.getElementById("review-items");
  if (!container?.append) return;
  for (const [index,[title,criteria]] of reviewGroups.entries()) {
    const chapter=index+1;
    const definitions=chapterStructure[index][1];
    const template=chapterTemplates[chapter];
    const section = element("details");
    section.className = "module-details";
    section.append(element("summary",title));
    const source=element("p","Instrumento de revisión · Capítulo "+chapter+" · ");
    source.append(reference(template.clause,(chapter===1?sources.guia:sources.nt)+"#page="+template.page));
    section.append(source);
    for (const [key, label] of criteria) {
      const group = element("fieldset");
      group.className = "review-item";
      group.append(element("legend",label));
      const controls = element("div");
      controls.className = "fields";
      const select = element("select");
      select.name = "m4.estado_" + key;
      for (const state of ["","Documentado","Pendiente","No aplica, con justificación"]) {
        select.add(new Option(state || "Por revisar",state));
      }
      const observation = element("textarea");
      observation.name = "m4.nota_" + key;
      observation.maxLength = 600;
      const stateLabel = element("label","Estado");
      stateLabel.append(select);
      const noteLabel = element("label","Evidencia, pendiente o justificación");
      noteLabel.append(observation);
      controls.append(stateLabel,noteLabel);
      const targets={
        objetivos:"objetivo_general",legal:"basamento",roles:"responsabilidades",direccion:"suscripcion",
        prevencion:"principios",consulta:"difusion",inventario:"proceso_productivo",etapas:"diagramas",metodo:"validacion",
        exposicion:"riesgos",asamblea:"validacion",medidas:"prioridades",rendimiento:"compromisos",participacion:"compromisos",
        medios:"recursos",compras:"contratacion",contratistas:"coordinacion",subcontratos:"coordinacion",
        evaluacion:"criterios",ajustes:"mejora",anexos:"criterios",expediente:"criterios",
      };
      const fieldKey=definitions.some(([name])=>name===key)?key:targets[key]??(chapter===4?"estructura":definitions[0][0]);
      const edit=element("button","Ir al campo del borrador");
      edit.type="button";
      edit.addEventListener("click",()=>{
        const input=form.elements.namedItem("m4."+chapterKey(chapter,fieldKey));
        if(!input) return;
        revealControl(input);
        input.focus();
      });
      group.append(controls,edit);
      section.append(group);
    }
    container.append(section);
  }
}

function revealControl(control) {
  if (!control) return;
  const step = steps.findIndex(section => section.contains(control));
  if (step >= 0) showStep(step,false);
  for (let parent = control.parentElement; parent && parent !== form; parent = parent.parentElement) {
    if (parent.tagName === "DETAILS") parent.open = true;
  }
}

function validateForm() {
  const controls = [...(form.elements ?? [])];
  for (const control of controls) {
    if (!control.dataset.link || !control.setCustomValidity) continue;
    const available = choices(control.dataset.link);
    control.setCustomValidity([fieldValue(control)].flat().some(value=>value && !available.some(([id])=>id===value))
      ? "Selecciona una referencia que siga disponible en el registro." : "");
  }
  const invalid = controls.find(control => control.willValidate && !control.validity.valid);
  revealControl(invalid);
  if (!form.reportValidity()) {
    tell("Revisa el campo marcado antes de entregar.", "error");
    return false;
  }
  const linkedTasks = choices("tareas");
  const linkedRisks = choices("riesgos");
  const riskWithoutTask = moduleId === "m2" && linkedTasks.length &&
    rowValues("m2").findIndex(row => row.codigo && !row.tareaRef);
  const planWithoutRisk = moduleId === "m3" && linkedRisks.length &&
    rowValues("planes").findIndex(row => !recordRefs(row).length);
  for (const [index,key,field,message] of [
    [riskWithoutTask,"m2","tareaRef","Selecciona la tarea de M1 para cada hallazgo nuevo."],
    [planWithoutRisk,"planes","riesgoRefs","Selecciona los hallazgos de M2 que aborda este plan."],
  ]) {
    if (typeof index !== "number" || index < 0 || !editors.has(key)) continue;
    const row = editors.get(key).querySelectorAll(".row-card")[index];
    const control = row?.querySelector('[data-key="' + field + '"]');
    revealControl(control);
    control?.focus();
    tell(message,"error");
    return false;
  }
  return true;
}

function tell(message, state = "") {
  status.textContent = message;
  status.dataset.state = state;
}

async function api(path, body) {
  if (practice) {
    if(path==="draft") return practice.save(body.draft);
    if(path==="workspace") return practice.info;
    throw new Error("Las entregas se registran desde la actividad del curso.");
  }
  const headers = {};
  if (session) headers.Authorization = "Bearer " + session;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(apiRoot + path, {
    method: body === undefined ? "GET" : "POST", headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    referrerPolicy: "no-referrer", cache: "no-store",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    const error=new Error(data?.error ?? "No se pudo contactar al Constructor. Vuelve a abrirlo desde Moodle.");
    error.http=response.status;
    throw error;
  }
  return data;
}

function formValues() {
  return [...new FormData(form)].map(([path, value]) => [path, value.trim()]);
}

function draftFingerprint(values = formValues()) {
  return JSON.stringify([values, [...editors.keys()].map(rowValues), rememberedRisks??draft?.m3?.referenciasRevisadas]);
}

function deliveryStatus(delivery) {
  const state = delivery.gradeSync?.state;
  if (state === "retry") return "Error de sincronización. El docente puede reintentar el envío a Moodle.";
  if (state && state !== "sent") return "Revisión completada. Pendiente de confirmación de Moodle.";
  return delivery.review
    ? "Nota publicada en Moodle: " + delivery.review.score + " de 100 puntos. Revisión técnica: " +
      delivery.review.technicalPoints + " de 40 puntos. Retroalimentación: " + delivery.review.feedback
    : "Pendiente de revisión técnica.";
}

function refreshDelivery() {
  const dirty = draftFingerprint() !== savedValues;
  const current = lastDelivery?.revision === revision && !dirty;
  deliver.disabled = busy || current;
  deliver.textContent = current ? "Entrega registrada" : "Entregar para revisión";
  refreshDeliveryVisibility();
  if (!lastDelivery) return;
  for(const id of ["export-archive","export-archive-package"]){
    const download=document.getElementById(id);
    if(download) download.hidden=moduleId!=="m4" || !lastDelivery.hasArchive;
  }

  const date = new Date(lastDelivery.submittedAt);
  const when = Number.isNaN(date.valueOf()) ? "" :
    new Intl.DateTimeFormat("es-VE", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Caracas" }).format(date);
  receipt.hidden = false;
  document.getElementById("receipt-title").textContent = current ? "✓ Entrega registrada" : "✓ Última entrega registrada";
  document.getElementById("receipt-detail").textContent =
    (when ? when + " · Hora de Venezuela. " : "") +
    "Comprobación automática: " + lastDelivery.automaticPoints + " de 60 puntos. " + deliveryStatus(lastDelivery) +
    (current ? "" : " Tienes un borrador más reciente que aún no has entregado.");
}

function collectDraft(values = formValues()) {
  const next = structuredClone(draft);
  for (const [path, value] of values) {
    const [group, key] = path.split(".");
    if (!next[group] || typeof next[group] !== "object" || Array.isArray(next[group])) next[group] = {};
    next[group][key] = path === "bitacora.horas" ? (value ? Number(value) : null) : value;
  }
  for (const key of editors.keys()) {
    const schema = rowSchemas[key];
    next[schema.group] ??= {};
    next[schema.group][schema.key] = rowValues(key);
  }
  if(moduleId==="m3" && rememberedRisks) {
    next.m3 ??={};
    next.m3.referenciasRevisadas=rememberedRisks;
  }
  return next;
}

async function saveIfChanged() {
  const values=formValues(),fingerprint=draftFingerprint(values);
  if(fingerprint===savedValues) return;
  if(conflict) throw new Error("Conserva una copia y vuelve a abrir el módulo para comparar las dos versiones.");
  const next=collectDraft(values);
  if (new TextEncoder().encode(JSON.stringify(next)).length > 230000) {
    throw new Error("El borrador supera el tamaño disponible. Usa referencias para el material extenso.");
  }
  const saved = await api("draft", { revision, draft: next });
  draft = next;
  revision = saved.revision;
  savedValues = fingerprint;
  recordSaved(new Date().toISOString());
  if(projectInfo?.progress?.[moduleId]){
    projectInfo.progress[moduleId].revision=revision;
    renderProgress();
  }
  if(draftFingerprint()===savedValues) clearRecovery();
  else stashRecovery();
  pending = undefined;
}

async function update(message, action) {
  if (busy) return;
  busy = true;
  const save = form.querySelector('button[type="submit"]');
  const inputs = [...form.querySelectorAll("input, textarea")];
  save.disabled = true;
  const disabledDuringSave = [...editors.values()].flatMap(editor => [...editor.querySelectorAll("select, [data-remove]")]);
  disabledDuringSave.forEach(control => { control.disabled = true; });
  for (const [key, editor] of editors) updateRowLabels(key,editor);
  refreshDelivery();
  tell(message);
  inputs.forEach(input => { input.readOnly = true; });
  try {
    await action();
  } catch (error) {
    handleSaveError(error);
  } finally {
    inputs.forEach(input => { input.readOnly = false; });
    busy = false;
    save.disabled = false;
    disabledDuringSave.forEach(control => { control.disabled = false; });
    for (const [key, editor] of editors) updateRowLabels(key,editor);
    refreshDelivery();
    if(draftFingerprint()!==savedValues) queueAutosave();
  }
}

form.addEventListener("input",event=>{
  if(event.target.name || event.target.dataset.key) rowChanged(event);
});

form.addEventListener("submit", event => {
  event.preventDefault();
  void update("Guardando el borrador…", async () => {
    await saveIfChanged();
    tell("✓ Borrador guardado.", "success");
  });
});

deliver.addEventListener("click", () => {
  if (practice || busy || deliver.disabled) return;
  if (moduleId === "m3" && rowValues("m3").some(row=>row.actividad && !schedule(row))) {
    revealControl(editors.get("m3")?.querySelector("select"));
    tell("Completa el inicio y el cierre previsto de cada actividad, dentro de 2027 y en orden.", "error");
    return;
  }
  if (!validateForm()) return;
  if(moduleId==="m1"){
    const invalid=organizationTree(rowValues("estructura")).find(row=>row.cycle || row.orphan);
    if(invalid){
      focusRecord("estructura",invalid.id);
      tell("Revisa a quién reporta "+invalid.nombre+" en el organigrama.","error");
      return;
    }
    const mappedStages=rowValues("mapa");
    const mismatched=rowValues("procesos").find(row=>row.etapaMapaRef && !mappedStages.some(stage=>stage.id===row.etapaMapaRef && stage.flujoRef===row.productivoRef));
    if(mismatched){
      focusRecord("procesos",mismatched.id);
      tell("La etapa elegida debe pertenecer al proceso productivo seleccionado.","error");
      return;
    }
  }
  if (moduleId === "m4") {
    const recorded=Object.fromEntries(formValues().filter(([key])=>key.startsWith("m4.")).map(([key,value])=>[key.slice(3),value]));
    for (const key of ["contratistas","indicadores"]) recorded[key]=rowValues(key);
    const missing = draftReadiness({...sourceSections(integrationInputs),...Object.fromEntries(Object.entries(recorded).filter(([,value])=>value))},integrationInputs ?? {}).filter(([,ready])=>!ready);
    if (missing.length) {
      tell("Antes de entregar, desarrolla o referencia estos capítulos: "+missing.map(([title])=>title).join(", ")+".", "error");
      return;
    }
    const summary=form.elements.namedItem("m4.resultado");
    const previous=form.elements.namedItem("m4.brechas");
    if(summary && !summary.value.trim() && !previous?.value.trim() && !rowValues("m4").some(row=>row.brecha)){
      revealControl(summary);
      summary.focus();
      tell("Registra el resultado de la revisión o agrega una brecha antes de entregar.","error");
      return;
    }
  }
  void update("Enviando la entrega…", async () => {
    await saveIfChanged();
    pending ??= crypto.randomUUID();
    lastDelivery = await api("submit", { revision, requestId: pending });
    if(moduleId==="m4") deliveredArchive=undefined;
    if(projectInfo?.progress?.[moduleId]){
      projectInfo.progress[moduleId].submittedRevision=revision;
      projectInfo.progress[moduleId].published=Boolean(lastDelivery.review);
      renderProgress();
    }
    if(moduleId==="m4"||!lastDelivery.checks) {
      try { lastDelivery=(await api("workspace")).delivery??lastDelivery; } catch {}
    }
    renderChecklist();
    pending = undefined;
    tell("✓ Entrega registrada. " + lastDelivery.automaticPoints + " de 60 puntos automáticos. " + deliveryStatus(lastDelivery), "success");
  });
});

function downloadBlob(blob,filename) {
  const url = URL.createObjectURL(blob);
  const link = element("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function downloadHtml(documentText,filename){
  downloadBlob(new Blob([documentText],{type:"text/html;charset=utf-8"}),filename);
}

function setupGanttDownload(info) {
  if (info.moduleId !== "m3") return;
  document.getElementById("gantt-scale").addEventListener("change", redrawGantt);
  document.getElementById("print-gantt").addEventListener("click", () => {
    const html = buildGanttDocument({label:info.label, activities:filteredActivities(), plans:rowValues("planes")});
    if (!html) { tell("Registra actividades con fechas para imprimir.","error"); return; }
    const preview = window.open("", "_blank");
    if (!preview) { tell("Permite abrir la vista de impresión o descarga la carta Gantt en HTML.","error"); return; }
    preview.opener = null;
    const printable = html.replace(/<style>[\s\S]*?<\/style>/, '<link rel="stylesheet" href="'+new URL("./psst-gantt-print.css?v=1",import.meta.url).href+'">');
    preview.document.open(); preview.document.write(printable); preview.document.close();
    preview.addEventListener("load", () => { preview.focus(); preview.print(); }, {once:true});
  });
  function downloadSchedule(includePlans) {
    if (busy) return;
    const documentText = buildGanttDocument({
      label: info.label, activities: filteredActivities(), plans: rowValues("planes"), includePlans,
      riskRows: info.inputs?.m2?.data?.m2?.filas, declaredGroups:formValues().find(([key])=>key==="m3.gruposFormacion")?.[1],
      legacyReference: form.elements.namedItem("m3.gantt").value.trim(),
    });
    if (!documentText) {
      tell("Registra una actividad con fechas previstas o una ficha de plan antes de descargar.", "error");
      return;
    }
    downloadHtml(documentText, includePlans ? "Planes_y_Carta_Gantt_2027.html" : "Carta_Gantt_2027.html");
    tell("Documento preparado. Ábrelo para imprimirlo o guardarlo como PDF.", "success");
  }
  document.getElementById("export-gantt").addEventListener("click",()=>downloadSchedule(false));
  document.getElementById("export-excel")?.addEventListener("click",()=>{
    if (!scheduledActivities(filteredActivities()).length) { tell("Registra una actividad con fechas o cambia los filtros.","error"); return; }
    downloadBlob(excelGantt(filteredActivities(),rowValues("planes")),"Carta_Gantt_2027.xlsx");
  });
  for(const id of ["filter-center","filter-plan","filter-owner"]) document.getElementById(id)?.addEventListener("change",redrawGantt);
  document.getElementById("export-plans-gantt").addEventListener("click",()=>downloadSchedule(true));
}

function setupDocument(info) {
  if (info.moduleId !== "m4") return;
  projectLabel = info.label;
  integrationInputs = info.inputs ?? {};
  const sources = document.getElementById("integration-sources");
  const list = element("ul");
  for (const number of [1, 2, 3]) {
    const source = integrationInputs["m" + number];
    const status = source?.submittedAt ? "Última entrega registrada"
      : Object.keys(source?.data ?? {}).length ? "Borrador guardado" : "Sin datos guardados";
    list.append(element("li", "Módulo " + number + " · " + status));
  }
  sources.replaceChildren(list);
  const profile = integrationInputs.m1?.data?.proyecto ?? {};
  document.getElementById("compose-letter").addEventListener("click",()=>{
    if (busy) return;
    const formField = name => form.elements.namedItem("m4."+name);
    const field = formField("compromiso");
    if (field.value.trim()) { field.focus(); return; }
    const associative = document.getElementById("letter-kind").value === "asociacion";
    const established = formField("cap6_compromisos").value.trim();
    const resources = formField("cap6_recursos").value.trim();
    field.value = [
      "Borrador para revisión y suscripción · " + (associative ? "Asociación o cooperativa" : "Entidad de trabajo o contratista"),
      "Entidad: " + (profile.entidad || "por indicar") + " · Centro: " + (profile.centro || "por indicar"),
      "Responsable: " + (formField("cap6_responsable").value.trim() || "por identificar"),
      associative ? "Acta de la Asamblea y decisión de las personas asociadas: por verificar."
        : "Destinatarios: Comité de Seguridad y Salud Laboral y presentación al INPSASEL.",
      "Nos comprometemos a cumplir las disposiciones de SST, mejorar los procesos y puestos, proporcionar formación preventiva, facilitar la participación, vigilar la salud y las condiciones de trabajo, asegurar la coordinación con contratistas cuando corresponda y promover el descanso y la recreación.",
      established,resources,
      "Fecha, revisión, firma y sello: pendientes hasta su suscripción.",
    ].filter(Boolean).join("\n\n").slice(0,field.maxLength);
    rowChanged();
    field.focus();
  });
  const button = document.getElementById("export-psst");
  button.addEventListener("click", () => void update("Preparando el borrador…", async () => {
    await saveIfChanged();
    const documentText = buildPsstDocument({ label: projectLabel, inputs: integrationInputs, draft });
    downloadHtml(documentText, "Borrador_PSST.html");
    tell("Borrador preparado. Ábrelo en tu navegador para revisarlo o guardarlo como PDF.", "success");
  }));
}

function renderProgress(){
  const view=document.getElementById("project-progress");
  if(!projectInfo?.progress||!view?.replaceChildren) return;
  view.replaceChildren(...modules.map(([id,name,n])=>{
    const tile=element("div");
    tile.className="project-tile";
    if(id===moduleId) tile.setAttribute("aria-current","step");
    tile.append(element("strong",n+" · "+name),element("span",projectState(projectInfo.progress,id)));
    return tile;
  }));
}

function renderChecklist(){
  const view=document.getElementById("learner-checks");
  if(!view?.replaceChildren) return;
  const checks=lastDelivery?.checks;
  view.replaceChildren(element("p",checks ? "Comprobaciones de la última entrega" : "Cada comprobación registrada aporta 12 puntos, hasta 60. La revisión técnica aporta hasta 40."));
  const review = lastDelivery?.review;
  if (Array.isArray(review?.scores)) {
    const criteria = element("ol");
    for (const [index,[name,guide]] of rubrics[moduleId].entries()) {
      const points = review.scores[index];
      if (!Number.isFinite(points)) continue;
      const item = element("li",name+" · "+points+"/10");
      if (points < 10) item.append(element("p","Qué revisar en este módulo: "+guide));
      criteria.append(item);
    }
    view.append(element("h4","Revisión técnica por criterio"),criteria);
  }
  if(!checks) return;
  const list=element("ul");
  for(const [id,has] of Object.entries(checks)) list.append(element("li",(checksLabels[id]||id)+" · "+(has?"12/12":"0/12")));
  view.append(list);
}

function recordSaved(value){
  const node=document.getElementById("saved-time");
  if(!node) return;
  node.textContent=value ? "Guardado "+new Intl.DateTimeFormat("es-VE",{dateStyle:"short",timeStyle:"short",timeZone:"America/Caracas"}).format(new Date(value))+" (VE)" : "Pendiente de guardar";
}

function recoveryRecord(){
  if(!recoveryKey) return null;
  try {
    const item=JSON.parse(sessionStorage.getItem(recoveryKey));
    return item?.draft && Number.isInteger(item.revision) && Date.now()-item.at<2*60*60*1000 ? item : null;
  } catch { return null; }
}

function stashRecovery(){
  if(!recoveryKey||!moduleId||!savedValues||draftFingerprint()===savedValues) return;
  try { sessionStorage.setItem(recoveryKey,JSON.stringify({draft:collectDraft(),revision,at:Date.now()})); } catch {}
}
function clearRecovery(){
  if(!recoveryKey) return;
  try { sessionStorage.removeItem(recoveryKey); } catch {}
}
function queueAutosave(){
  if(!recoveryKey||!savedValues||draftFingerprint()===savedValues) return;
  stashRecovery();
  clearTimeout(autosaveTimer);
  if(conflict) return;
  autosaveTimer=setTimeout(async()=>{
    if(busy || conflict || navigator.onLine===false) return;
    busy=true;
    try { await saveIfChanged(); tell("Borrador guardado automáticamente.","success"); }
    catch(error){ handleSaveError(error); }
    finally { busy=false; refreshDelivery(); }
  },1200);
}
function handleSaveError(error){
  tell(error.message,"error");
  stashRecovery();
  if([401,403,409].includes(error.http)){
    conflict=true;
    const marker=document.getElementById("draft-conflict");
    marker.closest("details").open = true;
    marker.hidden=false;
    marker.textContent=error.http===409 ? "Existe una versión más reciente. Puedes descargar tus cambios y volver a abrir el módulo para compararlos." :
      "La sesión terminó. Vuelve a abrir el módulo en esta pestaña desde Moodle o descarga una copia de tus cambios.";
    document.getElementById("copy-recovery").hidden=false;
  }
}

function restoreRecovery(item){
  for(const input of form.querySelectorAll("[name]")){
    const [group,key]=input.name.split(".");
    input.value=item.draft[group]?.[key]??"";
  }
  for(const [key,editor] of editors){
    const schema=rowSchemas[key];
    editor.querySelector("[data-rows]").replaceChildren();
    for(const row of item.draft[schema.group]?.[schema.key]??[]) appendRow(key,editor,row);
  }
  refreshLinks();
  document.getElementById("restore-recovery").hidden=true;
  document.getElementById("draft-conflict").hidden=true;
  rowChanged();
}

function caseDraft(){
  const now=moduleId ? collectDraft() : {};
  return {
    one:moduleId==="m1" ? now : integrationInputs?.m1?.data??{},
    two:moduleId==="m2" ? now.m2 : integrationInputs?.m2?.data?.m2??{},
    three:moduleId==="m3" ? now.m3 : integrationInputs?.m3?.data?.m3??{},
  };
}

function riskBaseline(risks){
  return (risks??[]).map(risk=>[risk.id,risk.codigo,risk.tareaRef,risk.riesgo,risk.prioridad,risk.valoracion,risk.controlPropuesto,...(risk.criterioEficacia ? [risk.criterioEficacia] : [])]);
}

function renderProjectDetails(){
  const view=document.getElementById("trace-table");
  if(!projectInfo?.projectKey || !view?.replaceChildren || !moduleId) return;
  const inputs=caseDraft();
  const paths=workTrace(inputs.one,inputs.two,inputs.three);
  view.replaceChildren();
  if(!paths.length) view.append(element("p",moduleId==="m3"?"Las tareas completas y sus vínculos se consultan en el módulo 4.":"Registra las tareas en el módulo 1 para construir la trazabilidad."));
  else {
    const table=element("table");
    table.setAttribute("aria-label","Trazabilidad de tareas");
    const row=table.createTHead().insertRow();
    for(const title of ["Proceso productivo","Proceso de trabajo","Tarea","Hallazgos","Planes","Actividades y evidencia"]){
      const cell=element("th",title);cell.scope="col";row.append(cell);
    }
    const body=table.createTBody();
    const summarize=(rows,key)=>rows.map(item=>[item.codigo,item[key]].filter(Boolean).join(" · ")).join("\n")||"—";
    for(const path of paths){
      const line=body.insertRow();
      for(const value of [path.flow?.nombre,path.process?.nombre,summarize([path.task],"nombre"),
        summarize(path.findings,"riesgo"),summarize(path.plans,"nombre"),
        path.activities.map(item=>[item.actividad,item.evidenciaReal||item.evidenciaEsperada].filter(Boolean).join(" · ")).join("\n")]){
        line.insertCell().textContent=value||"—";
      }
    }
    view.append(table);
  }
  const questionView=document.getElementById("technical-prompts");
  const prompts=technicalPrompts(inputs);
  questionView.replaceChildren();
  if(prompts.length){
    const list=element("ul");
    for(const prompt of prompts) list.append(element("li",prompt));
    questionView.append(list);
  } else questionView.append(element("p","Verifica si las fuentes permiten explicar el trabajo real y si cada medida tiene un criterio de eficacia."));
  const marker=document.getElementById("source-impact");
  const ack=document.getElementById("ack-source");
  let message="";
  if(moduleId==="m3"){
    const before=rememberedRisks??draft?.m3?.referenciasRevisadas;
    const after=riskBaseline(inputs.two.filas);
    const old=new Map((before??[]).map(row=>[row[0],JSON.stringify(row)]));
    const now=new Map(after.map(row=>[row[0],JSON.stringify(row)]));
    const changed=[...new Set([...old.keys(),...now.keys()])].filter(id=>old.get(id)!==now.get(id));
    const affected=(inputs.three?.planesDetallados??[]).filter(plan=>recordRefs(plan).some(id=>changed.includes(id)));
    if(before && changed.length) message="Hay cambios en los hallazgos del módulo 2. "+(affected.length ?
      "Revisa primero estos planes: "+affected.map(plan=>plan.codigo||plan.nombre).join(", ")+".":"Revisa si los hallazgos nuevos requieren vincularse a un plan.");
    ack.hidden=!message;
  }
  if(moduleId==="m4"){
    const newer=["m1","m2","m3"].filter(id=>{
      const progress=projectInfo?.progress?.[id];
      return progress?.submittedRevision!=null && progress.revision>progress.submittedRevision;
    });
    if(newer.length) message="Hay avances guardados en "+newer.map(id=>"Módulo "+id.slice(1)).join(", ")+
      " que todavía no forman parte de su última entrega. Revisa las fuentes antes de cerrar el borrador.";
  }
  if(moduleId==="m4" && deliveredArchive){
    const changes=changedSources(deliveredArchive.inputs,integrationInputs);
    if(changes.length) message=(message?message+" ":"")+"Hay cambios posteriores a la entrega en: "+changes.map(id=>"Módulo "+id.slice(1)).join(", ")+". Revisa los capítulos III y IV y los anexos antes de entregar otra versión.";
  }
  marker.hidden=!message;
  marker.textContent=message;
  const fieldHours=document.getElementById("field-hours");
  if(moduleId==="m1"&&fieldHours) {
    const complete=rowValues("campo").filter(row=>row.fecha&&row.actividad&&row.evidencia&&Number(row.horas)>0);
    fieldHours.textContent=complete.reduce((total,row)=>total+Number(row.horas),0)+" de 32 horas respaldadas con registros de campo.";
  }
}

async function exportArchive(){
  try {
    deliveredArchive=deliveredArchive??await api("archive");
    renderProjectDetails();
    downloadBlob(wordFromReport(buildPsstDocument(deliveredArchive)),"PSST_Entrega_R"+deliveredArchive.version+".docx");
  } catch(error){ tell(error.message,"error"); }
}

function setupProjectPanel(info){
  if(!info.projectKey) return;
  const panel=document.getElementById("project-panel");
  if(!panel) return;
  panel.hidden=false;
  renderProgress();
  recordSaved(info.savedAt);
  const item=recoveryRecord();
  const restore=document.getElementById("restore-recovery");
  const copy=document.getElementById("copy-recovery");
  const marker=document.getElementById("draft-conflict");
  if(item) {
    if(JSON.stringify(item.draft)===JSON.stringify(info.draft)) clearRecovery();
    else {
      panel.open=true;
      marker.hidden=false;
      copy.hidden=false;
      restore.hidden=item.revision!==revision;
      marker.textContent=restore.hidden?"La copia de esta pestaña y el borrador guardado tienen revisiones distintas. Descarga la copia para comparar.":"Hay cambios de esta pestaña disponibles para recuperar.";
      restore.addEventListener("click",()=>restoreRecovery(item));
    }
  }
  copy.addEventListener("click",()=>{
    const data=recoveryRecord();
    if(!data){ tell("No hay una copia de recuperación en esta pestaña.","error");return; }
    downloadBlob(new Blob([JSON.stringify(data.draft,null,2)],{type:"application/json"}),"PSST_"+moduleId+"_recuperacion.json");
  });
  window.addEventListener("pagehide",stashRecovery);
  window.addEventListener("online",queueAutosave);
  document.getElementById("refresh-grade-status")?.addEventListener("click",()=>{
    void update("Consultando la calificación…",async()=>{
      const latest = await api("workspace");
      if (latest.delivery) lastDelivery = latest.delivery;
      refreshDelivery();
      renderChecklist();
      tell(lastDelivery ? deliveryStatus(lastDelivery) : "Todavía no hay una entrega registrada.");
    });
  });
  const rubric=document.getElementById("learner-rubric");
  const list=element("ol");
  for(const [name,guide] of rubrics[moduleId]){
    const item=element("li");
    item.append(element("strong",name),element("p",guide));
    list.append(item);
  }
  rubric.replaceChildren(element("p","Rúbrica técnica · 4 criterios de 10 puntos"),list);
  renderChecklist();
  if(moduleId==="m3"){
    if(!draft.m3?.referenciasRevisadas) {
      rememberedRisks=riskBaseline(integrationInputs?.m2?.data?.m2?.filas);
      savedValues=draftFingerprint();
    }
    document.getElementById("ack-source").addEventListener("click",()=>{
      rememberedRisks=riskBaseline(caseDraft().two.filas);
      rowChanged();
    });
  }
  if(moduleId!=="m4") return;
  document.getElementById("export-archive").addEventListener("click",()=>void exportArchive());
  if(info.delivery?.hasArchive) void api("archive").then(data=>{deliveredArchive=data;renderProjectDetails();}).catch(()=>{});
  document.getElementById("export-word").addEventListener("click",()=>void update("Preparando la versión editable…",async()=>{
    await saveIfChanged();
    downloadBlob(wordFromReport(buildPsstDocument({label:info.label,inputs:integrationInputs,draft,version:revision})),"Borrador_PSST_R"+revision+".docx");
    tell("Borrador Word preparado.","success");
  }));
  document.getElementById("export-pdf").addEventListener("click",()=>{
    const report=buildPsstDocument({label:info.label,inputs:integrationInputs,draft:collectDraft(),version:revision});
    downloadBlob(pdfFromReport(report),"Borrador_PSST_R"+revision+".pdf");
    tell("Borrador PDF preparado.","success");
  });
}


function actionButton(text,action){
  const button=element("button",text);
  button.type="button";
  button.addEventListener("click",action);
  return button;
}

function recordControl(target,id){
  const editor=editors.get(target);
  const row=id&&[...(editor?.querySelectorAll(".row-card")??[])].find(node=>node.dataset.id===id);
  return row?.querySelector("[data-key]")??editor?.querySelector("[data-add]");
}

function focusRecord(target,id){
  const input=recordControl(target,id);
  if(!input) return false;
  revealControl(input);
  input.focus();
  input.scrollIntoView({block:"center"});
  return true;
}

function newLinkedRow(target, values){
  if(busy||!editors.has(target)) return;
  const row=appendRow(target,editors.get(target),values);
  rowChanged();
  focusRecord(target,row.dataset.id);
  return row;
}

function addStageOrder(row,editor){
  for(const [caption,offset] of [["Subir etapa",-1],["Bajar etapa",1]]){
    row.append(actionButton(caption,()=>{
      if(busy) return;
      const group=row.querySelector('[data-key="flujoRef"]').value;
      const siblings=[...editor.querySelectorAll(".row-card")].filter(other=>other.querySelector('[data-key="flujoRef"]').value===group);
      const sibling=siblings[siblings.indexOf(row)+offset];
      if(!sibling) return;
      if(offset<0) sibling.before(row);
      else sibling.after(row);
      updateRowLabels("mapa",editor);
      rowChanged();
    }));
  }
}

function addPlanActivity(row){
  row.append(actionButton("Programar actividad",()=>{
    const plan=rowValues("planes").find(item=>item.id===row.dataset.id);
    if(!plan?.nombre||!plan.codigo){
      tell("Primero identifica el plan con código y nombre.","error");
      focusRecord("planes",row.dataset.id);
      return;
    }
    const refs=recordRefs(plan);
    newLinkedRow("m3",{planRef:plan.id,riesgoRef:refs.length===1?refs[0]:""});
  }));
}

function renderIncoming(info){
  const mount=document.getElementById(moduleId==="m2"?"incoming-tasks":"incoming-risks");
  if(!mount?.replaceChildren || !["m2","m3"].includes(moduleId)) return;
  const isTask=moduleId==="m2";
  const source=isTask?info.inputs?.m1?.data?.tarea?.actividades:info.inputs?.m2?.data?.m2?.filas;
  const rows=recordsOf(source).filter(row=>row.id&&(row.nombre||row.riesgo));
  const title=element("h2",isTask?"Tareas disponibles del Módulo 1":"Hallazgos disponibles del Módulo 2");
  mount.replaceChildren(title);
  if(!rows.length){
    mount.append(element("p",isTask?"Cuando guardes o entregues tareas en el Módulo 1 podrás retomarlas aquí.":"Cuando guardes o entregues hallazgos en el Módulo 2 podrás convertirlos en acciones desde aquí."));
    return;
  }
  const list=element("ul");
  list.className="builder-list";
  for(const item of rows){
    const line=element("li");
    line.append(element("strong",[item.codigo,item.nombre||item.riesgo].filter(Boolean).join(" · ")));
    if(item.evidencia) line.append(element("p","Fuente: "+item.evidencia));
    if(isTask){
      const process=info.inputs?.m1?.data?.flujo?.procesos?.find(entry=>entry.id===item.procesoRef);
      const context=[process?.nombre,process?.area,...[["Objeto o sujeto",process?.objetoSujeto],["Medios",process?.mediosProceso],["Actividad",process?.actividadProceso],["Organización",process?.organizacionProceso],["División del trabajo",process?.divisionProceso]].filter(([,v])=>v).map(([k,v])=>k+": "+v),item.puestos,item.organizacion,item.descripcion].filter(Boolean);
      if(context.length) line.append(element("p",context.join(" · ")));
      line.append(actionButton("Evaluar esta tarea",()=>newLinkedRow("m2",{
        codigo:nextCode("R",rowValues("m2")),tareaRef:item.id,etapa:item.etapa||item.nombre,
        evidencia:item.evidencia||"",
      })));
    } else {
      line.append(actionButton("Crear plan para este hallazgo",()=>newLinkedRow("planes",{codigo:nextCode("PL",rowValues("planes")),riesgoRefs:[item.id]})));
      const select=element("select");
      select.setAttribute("aria-label","Plan existente para "+(item.codigo||item.riesgo));
      const fill=()=>select.replaceChildren(new Option("Selecciona un plan existente",""),
        ...rowValues("planes").filter(plan=>plan.nombre).map(plan=>new Option([plan.codigo,plan.nombre].filter(Boolean).join(" · "),plan.id)));
      fill();
      select.addEventListener("focus",fillOnce);
      function fillOnce(){ if(!select.value) fill(); }
      line.append(select,actionButton("Vincular al plan elegido",()=>{
        const planId=select.value;
        if(!planId){tell("Selecciona un plan existente para crear el vínculo.","error");return;}
        const plan=editors.get("planes");
        const row=[...(plan?.querySelectorAll(".row-card")??[])].find(node=>node.dataset.id===planId);
        const field=row?.querySelector('[data-key="riesgoRefs"]');
        if(!field) return;
        fillSelect(field,choices("riesgos-multiple"),[...new Set([...fieldValue(field),item.id])]);
        rowChanged();
        focusRecord("planes",planId);
      }));
      line.append(actionButton("Programar medida en el plan elegido",()=>{
        if (!select.value) { tell("Selecciona el plan donde programarás esta medida.","error"); return; }
        const planRow=[...editors.get("planes").querySelectorAll(".row-card")].find(row=>row.dataset.id===select.value);
        const links=planRow?.querySelector('[data-key="riesgoRefs"]');
        if (!links || busy) return;
        fillSelect(links,choices("riesgos-multiple"),[...new Set([...fieldValue(links),item.id])]);
        newLinkedRow("m3",{planRef:select.value,riesgoRef:item.id,actividad:item.controlPropuesto||"",eficacia:item.criterioEficacia||""});
      }));
    }
    list.append(line);
  }
  mount.append(list);
}

function renderBuilder(){
  if (moduleId === "m1") renderDiagrams();
  if(!projectInfo?.projectKey||!draft) return;
  if (moduleId === "m3") {
    const exposures=integrationInputs?.m2?.data?.m2?.gruposExpuestos||[];
    const plans=rowValues("planes"), activities=rowValues("m3");
    const declared=form.elements.namedItem("m3.gruposFormacion")?.value||"";
    const hours=annualTraining(activities,plans,declared,exposures);
    const options=document.getElementById("training-populations");
    options.replaceChildren(...hours.map(row=>new Option(row.group,row.group)));
    document.getElementById("annual-hours").replaceChildren(...hours.map(row=>element("p",
      row.group+" · "+row.quarters.map((h,i)=>"T"+(i+1)+": "+h+" h").join(" · ")+" · Año: "+row.total+" h · "+(row.gaps.join(", ")||"Cuatro trimestres cubiertos"))));
    const budget=annualInvestment(rowValues("inversion"),plans,activities);
    document.getElementById("annual-budget").replaceChildren(...budget.summary.map(s=>element("p",
      s.scope+" · "+s.currency+" "+s.total+" · "+s.quarters.map((v,i)=>"T"+(i+1)+": "+v).join(" · ")+" · Sin mes: "+s.undated+" · Por estimar: "+s.pending)));
    renderExecution();
    const totals = new Map(investmentRows(rowValues("inversion")).map(row=>[row.id,row]));
    for (const part of editors.get("inversion")?.querySelectorAll(".row-card") ?? []) {
      const row = totals.get(part.dataset.id);
      part.querySelector("[data-investment-total]").textContent = row
        ? "Importe: " + row.total + (row.total === "Por estimar" ? "" : " " + row.moneda)
        : "";
    }
  }
  if (moduleId === "m2") {
    const view = document.getElementById("diagnosis-summary");
    const findings = rowValues("m2").filter(row=>row.riesgo);
    const immediate = findings.filter(row=>row.prioridad==="Inmediata");
    view.replaceChildren(element("p",findings.length+" hallazgos registrados. "+immediate.length+
      " con prioridad inmediata."+(immediate.length ? " Revisa "+immediate.map(row=>row.codigo||row.riesgo).join(", ")+ "." : "")));
  }
  if(moduleId==="m2"){
    const groups=exposureRows({filas:rowValues("m2"),gruposExpuestos:rowValues("expuestos")});
    for(const row of editors.get("m2")?.querySelectorAll(".row-card")??[]){
      const summary=row.querySelector("[data-exposure-summary]");
      if(!summary) continue;
      const linked=groups.filter(group=>group.hallazgoRef===row.dataset.id&&group.puesto);
      summary.textContent=linked.length?linked.map(group=>group.puesto+": "+group.cantidadVisible).join(" · "):
        "Completa el desglose de puestos y personas expuestas.";
    }
  }
  const target=document.getElementById("builder-checks");
  if(!target?.replaceChildren) return;
  const data=caseDraft();
  const current=collectDraft();
  const notices=technicalChecks({...data,four:current.m4}).filter(item=>
    moduleId==="m4"||({
      m1:["estructura"],m2:["m2","expuestos"],m3:["planes","m3","inversion"],
    }[moduleId]??[]).includes(item.target));
  target.replaceChildren();
  if(!notices.length) return;
  target.append(element("h3","Qué revisar en tus registros"));
  const list=element("ul");
  for(const notice of notices){
    const item=element("li");
    item.append(element("strong",notice.message),element("p",notice.action));
    if(recordControl(notice.target,notice.id)) item.append(actionButton("Abrir registro",()=>focusRecord(notice.target,notice.id)));
    else if(notice.target==="expediente") item.append(actionButton("Ir al estado del expediente",()=>{
      const field=document.getElementById("dossier-fields").querySelector("select");
      revealControl(field);field.focus();
    }));
    else if(moduleId==="m4"){
      const route=document.querySelector(".project-actions a")?.cloneNode(true);
      if(route){
        if(practice) route.href="?practica="+(notice.target==="m2"?"m2":notice.target==="estructura"?"m1":"m3");
        route.textContent="Volver al módulo de origen";
        item.append(route);
      }
    }
    list.append(item);
  }
  target.append(list);
}

function setupOrganizationImport() {
  const outline = document.getElementById("organization-outline");
  const file = document.getElementById("organization-file");
  const notice = document.getElementById("organization-import-status");
  file.addEventListener("change", async () => {
    const selected = file.files[0];
    if (!selected) return;
    try {
      if (!/\.txt$/i.test(selected.name) || selected.size > 64000) {
        throw new Error("Elige un archivo TXT de hasta 64 KB.");
      }
      const text = await selected.text();
      if (text.length > outline.maxLength) throw new Error("Divide el archivo en listas más cortas.");
      outline.value = text;
      notice.textContent = "Revisa la lista y pulsa Agregar cargos de la lista.";
    } catch (error) {
      notice.textContent = error.message;
    } finally {
      file.value = "";
    }
  });
  document.getElementById("organization-import").addEventListener("click", () => {
    if (busy) return;
    try {
      const rows = organizationImport(outline.value);
      const editor = editors.get("estructura");
      const ids = rows.map(() => crypto.randomUUID());
      rows.forEach(({nombre, parent}, index) => appendRow("estructura",editor,
        {id:ids[index],nombre,reportaA:ids[parent] ?? ""}));
      outline.value = "";
      rowChanged();
      notice.textContent = rows.length + (rows.length === 1 ? " cargo agregado al organigrama." : " cargos agregados al organigrama.");
    } catch (error) {
      notice.textContent = error.message;
    }
  });
}

function renderDiagrams() {
  const org = document.getElementById("organization-view");
  if (!editors.has("estructura") || !org) return;
  const chart = organizationDiagram(rowValues("estructura"));
  org.style.overflowX = "auto";
  org.innerHTML = chart || "<p>El organigrama aparecerá aquí al escribir el primer cargo.</p>";
  document.getElementById("download-org").hidden = !chart;
  const flow = document.getElementById("flow-view");
  const processes = orderedFlows({flujo:{productivos:rowValues("productivos"),etapasMapa:rowValues("mapa")}});
  flow.replaceChildren();
  let hasDiagram = false;
  for (const process of processes) {
    if (!process.stages.length) continue;
    hasDiagram = true;
    const section = element("section");
    section.append(element("h3","Diagrama · " + process.nombre));
    const sequence = element("ol");
    sequence.className = "flow-sequence";
    for (const stage of process.stages) {
      const entry = element("li");
      entry.append(element("strong",stage.nombre));
      if (stage.area) entry.append(element("p",stage.area));
      if (stage.excepcion) entry.append(element("p","Desvío: " + stage.excepcion));
      sequence.append(entry);
    }
    section.append(sequence);
    flow.append(section);
  }
  document.getElementById("download-flow").hidden = !hasDiagram;
}

function renderExecution(){
  const board=document.getElementById("execution-board");
  if(!board?.replaceChildren) return;
  const rows=rowValues("m3").filter(row=>row.actividad);
  const stats=executionStats(rows);
  board.replaceChildren(element("p",stats.total+" actividades · "+stats.pendientes+" pendientes · "+stats.enCurso+" en curso · "+
    stats.reprogramadas+" reprogramadas · "+stats.ejecutadas+" ejecutadas · "+stats.eficaces+" con eficacia verificada"));
  if(!rows.length) return;
  const list=element("ul");list.className="builder-list";
  for(const row of rows){
    const item=element("li");
    item.append(element("strong",row.actividad),element("p",[row.estado||"Pendiente",row.responsable,row.resultadoEficacia].filter(Boolean).join(" · ")),
      actionButton("Actualizar seguimiento",()=>{
        if(!focusRecord("m3",row.id)) return;
        const target=[...editors.get("m3").querySelectorAll(".row-card")].find(card=>card.dataset.id===row.id)?.querySelector('[data-key="estado"]');
        target?.focus();
      }));
    list.append(item);
  }
  board.append(list);
}

function projectSnapshot(){
  return {label:projectInfo.label,inputs:integrationInputs??{},draft:collectDraft(),version:revision};
}

function openDraftPreview(){
  const model=projectSnapshot(), dialog=document.getElementById("psst-preview");
  if(moduleId==="m1"||moduleId==="m2"){
    model.inputs={...model.inputs,[moduleId]:{data:model.draft}};
    model.draft={};
  }
  document.getElementById("preview-heading").textContent=draftFingerprint()===savedValues
    ?"Vista previa · Revisión "+revision:"Vista previa · Cambios todavía sin guardar";
  const doc=new DOMParser().parseFromString(buildPsstDocument(model),"text/html");
  const sections=[...doc.querySelectorAll(moduleId==="m4"?"section[data-chapter-preview]":'section[data-chapter-preview="3"]')];
  const select=document.getElementById("preview-chapter"), content=document.getElementById("preview-content");
  select.replaceChildren(...sections.map((section,index)=>new Option(section.querySelector("h2").textContent,String(index))));
  function paint(){
    const section=sections[Number(select.value)];
    content.replaceChildren();
    if(section){
      content.append(document.importNode(section,true));
      content.scrollTop=0;
    }
  }
  select.onchange=paint;
  paint();
  dialog.showModal();
}

async function exportProjectPackage(archived=false){
  await update("Preparando el expediente…",async()=>{
    if(!archived) await saveIfChanged();
    const model=archived ? (deliveredArchive??=await api("archive")) : projectSnapshot();
    const html=buildPsstDocument(model);
    const stage=statusLabels[model.draft.m4?.estadoExpediente]??statusLabels.borrador;
    const zip=await zipDocuments({
      "01_PSST_editable.docx":wordFromReport(html),
      "02_PSST.pdf":pdfFromReport(html),
      "03_Matriz_cronograma_y_anexos.xlsx":workbookForPSST(model),
      "06_Informe_revision.docx":wordFromReport(buildPsstDocument({...model,includeReview:true})),
      "04_Diagramas_editables.docx":wordFromReport(buildDiagramDocument(model)),
      "05_Estado_del_expediente.txt":model.label+"\nRevisión "+model.version+" · "+stage+
        "\n"+(model.draft.m4?.referenciaExpediente||"Revisión de la entidad por documentar.")+
        "\nEl libro Excel reúne el cronograma, la matriz, los anexos y los pendientes registrados. Los soportes externos se identifican por su referencia.",
    });
    downloadBlob(zip,(archived?"Expediente_PSST_Entregado_R":"Expediente_PSST_R")+model.version+".zip");
    document.getElementById("package-version").textContent="Expediente preparado desde la revisión "+model.version+".";
  });
}

function setupBuilder(info){
  if(!info.projectKey) return;
  const entry=document.getElementById("practice-entry");
  if(entry) entry.hidden=Boolean(practice);
  if(practice){
    document.getElementById("practice-panel").hidden=false;
    document.getElementById("rubric-panel").hidden=true;
    for(const link of document.querySelectorAll("#practice-panel nav a")) link.addEventListener("click",async event=>{
      if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey) return;
      event.preventDefault();
      if(busy){tell("Espera a que termine el guardado antes de cambiar de módulo.");return;}
      try {await saveIfChanged();location.href=link.href;} catch(error){tell(error.message,"error");}
    });
  }
  if(moduleId==="m1"){
    setupOrganizationImport();
    document.getElementById("download-org").addEventListener("click",()=>{
      const svg = organizationDiagram(rowValues("estructura"));
      if (svg) downloadBlob(new Blob([svg],{type:"image/svg+xml"}),"Organigrama.svg");
    });
    for(const [id,name,kind] of [["download-flow","Mapa_productivo","flow"]]){
      document.getElementById(id)?.addEventListener("click",()=>{
        downloadBlob(wordFromReport(buildDiagramDocument({label:info.label,inputs:{m1:{data:collectDraft()}}},kind)),name+".docx");
      });
    }
  }
  if(moduleId==="m2"||moduleId==="m3") renderIncoming(info);
  if(moduleId==="m3"){
    document.getElementById("download-tracking")?.addEventListener("click",()=>{
      const model={label:info.label,inputs:{...integrationInputs,m3:{data:collectDraft()}},draft:{}};
      downloadBlob(workbookForPSST(model),"Seguimiento_PSST.xlsx");
    });
  }
  if(moduleId==="m1"||moduleId==="m2"){
    document.getElementById("edit-preview-chapter").hidden=true;
    const button=document.getElementById("preview-work-chapter");
    button.hidden=false;
    button.addEventListener("click",openDraftPreview);
  }
    document.getElementById("close-preview")?.addEventListener("click",()=>document.getElementById("psst-preview").close());
  if(moduleId==="m4"){
    document.getElementById("preview-psst")?.addEventListener("click",openDraftPreview);

    document.getElementById("edit-preview-chapter")?.addEventListener("click",()=>{
      const number=Number(document.getElementById("preview-chapter").value)+1;
      document.getElementById("psst-preview").close();
      const control=form.querySelector('[data-chapter="'+number+'"] textarea');
      if(control){revealControl(control);control.focus();}
    });
    document.getElementById("export-package")?.addEventListener("click",()=>void exportProjectPackage());
    document.getElementById("export-archive-package")?.addEventListener("click",()=>void exportProjectPackage(true));
  }
  renderBuilder();
}

async function start() {
  const demoId=new URLSearchParams(location.search).get("practica");
  let info;
  if(!ticket && /^m[1-4]$/.test(demoId??"")) {
    practice=practiceStore(sessionStorage,demoId);
    info=practice.info;
  } else {
    if (!ticket) {
      const entry=document.getElementById("practice-entry");
      if(entry) entry.hidden=false;
      throw new Error("Abre la actividad desde Moodle para trabajar con tu empresa o entra al caso de práctica.");
    }
    const binding=grant.get("binding");
    const proof=binding ? readProof(binding) : undefined;
    if(binding && !proof) throw new Error("Abre la actividad desde Moodle en esta pestaña. Este enlace pertenece a otra sesión del navegador.");
    const auth = await api("exchange", { ticket, proof });
    clearProof(binding);
    session = auth.session;
    info = await api("workspace");
  }
  projectInfo=info;
  recoveryKey=info.projectKey ? "psst154:"+info.projectKey+":"+info.moduleId : undefined;
  const guide = tutorials[info.moduleId];
  if (!guide) {
    startup.textContent = "Esta actividad no está disponible.";
    return;
  }
  const number = info.moduleId.slice(1);
  document.title = "Módulo " + number + " · Constructor de PSST";
  document.querySelector(".hero .eyebrow").textContent = "Constructor de PSST · Módulo " + number + " de 4";
  document.querySelector(".hero h1").textContent = guide.title;
  for (const section of form.querySelectorAll("[data-module]")) {
    section.hidden = section.dataset.module !== info.moduleId;
    section.disabled = section.hidden;
  }
  const workspace = document.getElementById("workspace");
  workspace.textContent = "Proyecto · " + info.label;
  workspace.hidden = false;
  draft = info.draft ?? {};
  moduleId = info.moduleId;
  setupProjectFields();
  integrationInputs = info.inputs ?? {};
  setupChapterFields();
  setupFieldHelp(info);
  setupReview();
  revision = info.revision;
  lastDelivery = info.delivery;
  for (const input of form.querySelectorAll("[name]")) {
    const [group, key] = input.name.split(".");
    const value = draft[group]?.[key];
    input.value = typeof value === "string" || typeof value === "number" ? value : "";
  }
  setupRows(info);
  showReadiness();
  setupDocument(info);
  setupGanttDownload(info);
  setupSteps();
  showCoherence();
  savedValues = draftFingerprint();
  setupProjectPanel(info);
  setupBuilder(info);
  renderProjectDetails();
  if (lastDelivery?.revision === revision) {
    tell("✓ Entrega registrada. " + lastDelivery.automaticPoints + " de 60 puntos automáticos. " + deliveryStatus(lastDelivery), "success");
  } else {
    tell(practice?"Guarda tu avance de práctica antes de cambiar de módulo.":"Guarda tu avance o entrega una versión para revisión.");
  }
  startup.hidden = true;
  form.hidden = false;
  refreshDelivery();
}

start().catch(error => {
  startup.textContent = error.message;
  startup.dataset.state = "error";
});
