export const chapterStructure = [
  ["Generalidades", [
    ["entidad","Entidad y centro de trabajo","Indica razón social, RIF, NIL, centro, dirección y actividad. La ficha de M1 aporta datos si dejas este campo vacío."],
    ["objetivo_general","Objetivo general","Con la matriz IPERC y los planes revisados, define qué resultado busca el PSST, para quién y en qué centro."],
    ["objetivos_especificos","Objetivos específicos","Formula resultados del programa y vincúlalos con los planes e indicadores que permiten comprobarlos."],
    ["alcance","Alcance y aplicación","Indica centros, áreas, turnos, población propia y de terceros, límites y quién aplica el programa."],
    ["basamento","Basamento legal","Identifica la ley, el reglamento, la norma técnica y las disposiciones propias de sus actividades."],
    ["responsabilidades","Responsabilidades y corresponsabilidades","Registra los roles del empleador, el SSST, el CSSL, los delegados y los trabajadores."],
    ["definiciones","Definiciones","Incluye un glosario breve con los términos que usa el programa."],
  ]],
  ["Política de Seguridad y Salud en el Trabajo", [
    ["politica","Política o referencia a la versión vigente","Transcribe el borrador o identifica el documento y su versión. Contrasta la política con los riesgos prioritarios y los planes. Incluye los compromisos preventivos y de participación."],
    ["principios","Principios y compromisos","Indica cómo se aplicarán la prevención, la participación y la corresponsabilidad en este centro."],
    ["suscripcion","Suscripción y vigencia","Registra fecha, responsables y estado de firma o endoso. Si está en preparación, déjalo indicado."],
    ["difusion","Difusión y revisión","Explica cómo conocerán la política los trabajadores, quién coordina su revisión y con qué frecuencia."],
  ]],
  ["Proceso productivo, procesos de trabajo y procesos peligrosos", [
    ["organigrama","Organigrama y estructura del SSST","Identifica el organigrama, cómo funciona el SSST y qué soporte respalda su estructura. Puedes referir el registro de M1."],
    ["proceso_productivo","Descripción del proceso productivo","Describe cómo se relacionan los procesos de bienes o servicios. El inventario y las tareas de M1 se incorporan en el documento."],
    ["diagramas","Diagramas y descripción de etapas","Identifica los diagramas y los registros de puestos, medios, organización, turnos y contratistas que correspondan."],
    ["riesgos","Procesos peligrosos y evaluación de riesgos","Explica método, cobertura, exposición y evaluaciones por completar. La matriz de M2 se incorpora en el documento."],
    ["validacion","Participación y validación del levantamiento","Registra las referencias al trabajo de campo y al acta de asamblea general. Indica qué queda por validar."],
  ]],
  ["Planes de trabajo", [
    ["prioridades","Prioridades y relación con los hallazgos","Indica qué hallazgos atiende cada plan y cuáles necesitan acciones inmediatas."],
    ["estructura","Estructura y cobertura de los planes","Resume las familias planificadas, las que quedan por desarrollar y su sustento. Las fichas de M3 se incorporan al documento."],
    ["presupuesto","Presupuesto e instrumentos","Ubica el plan de inversión, formularios, instrumentos, responsables y recursos que respaldan la ejecución."],
    ["cronograma","Cronograma y seguimiento","Registra cómo se revisarán las fechas, las responsabilidades y las evidencias de ejecución. La carta Gantt se incorpora desde M3."],
  ]],
  ["Investigación de accidentes de trabajo y enfermedades ocupacionales", [
    ["accidentes","Investigación de accidentes de trabajo","Describe aviso a los responsables, notificación y declaración por los canales aplicables, levantamiento de hechos, investigación y verificación de las medidas."],
    ["enfermedades","Investigación de enfermedades ocupacionales","Indica cómo el SSST investiga la sospecha o diagnóstico, reconstruye la historia ocupacional y la exposición, gestiona la declaración y resguarda datos clínicos."],
    ["activacion","Activación, funciones y comunicación","Identifica quién recibe el aviso, activa cada procedimiento y coordina la revisión. Indica los canales y formatos aplicables."],
    ["registros","Formatos y registros","Identifica las versiones de los formatos y dónde se resguardan los registros."],
    ["seguimiento","Seguimiento de medidas","Define cómo se verificará el cierre de las acciones y quién revisará su eficacia."],
  ]],
  ["Compromiso de cumplimiento", [
    ["responsable","Entidad y responsable del compromiso","Identifica la entidad, su representante o figura aplicable y quién pone en ejecución los planes."],
    ["compromisos","Compromisos de ejecución","Describe los compromisos de recursos, ejecución, información, participación y revisión."],
    ["recursos","Recursos y compromisos de participación","Identifica cómo se asignan recursos, tiempo y medios para la ejecución y revisión del programa."],
    ["carta","Modelo y estado de la carta compromiso","Indica qué modelo de la Guía corresponde, dónde está el borrador y el estado de su validación o firma."],
  ]],
  ["Otras consideraciones para la elaboración del PSST", [
    ["contratacion","Contratistas, subcontratistas e intermediarias","Identifica qué situaciones aplican y explica su relación con los procesos de la entidad."],
    ["coordinacion","Coordinación y controles de las interfaces","Registra coordinación entre los servicios de SST, información previa al inicio, riesgos de interacción, controles, vigilancia y responsables."],
    ["situaciones","Situaciones particulares y soporte","Documenta las condiciones de obras o servicios, cooperativas u otras figuras aplicables, o sustenta los apartados que no correspondan."],
  ]],
  ["Evaluación del programa", [
    ["criterios","Criterios e indicadores","Define qué se evaluará, cómo se medirá y qué evidencias servirán de respaldo."],
    ["cronograma","Cronograma y responsables de evaluación","Indica quién revisa, con qué frecuencia y recursos, cómo participan los trabajadores y qué actividades comunica el CSSL en su informe mensual al INPSASEL."],
    ["mejora","Revisión de resultados y mejora","Explica cómo se comunicarán los resultados, cómo se registrarán acuerdos con el CSSL y cómo se verificará su cierre."],
  ]],
];

export const annexStructure = [
  ["participacion","Organigrama, participación y asamblea"],
  ["diagnostico","Diagramas, fichas de proceso, matriz y evidencias"],
  ["planes","Planes, cronograma, presupuesto e instrumentos"],
  ["formacion","Formación e inducción"],
  ["epp","Equipos de protección personal y colectiva"],
  ["condiciones","Registros y comunicaciones sobre condiciones inseguras o insalubres"],
  ["investigacion","Reportes y formatos de investigación de accidentes y enfermedades"],
  ["compromiso","Carta compromiso y soportes de revisión"],
];

export function chapterKey(chapter, field) {
  return "cap" + chapter + "_" + field;
}
