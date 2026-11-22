const nt = "https://medicinalaboraldevenezuela.com.ve/archivo/norma-tecnica-04-2023.pdf";

export const fieldHelp = {
  production: {
    title:"Cómo describir el proceso productivo",
    steps:[
      "Empieza por lo que entrega el centro: un bien elaborado o un servicio prestado. Anota qué recibe para poder hacerlo.",
      "Recorre el trabajo en orden y escribe qué sucede desde la entrada hasta la salida. Indica quién recibe el resultado de cada etapa y qué ocurre cuando hay una excepción o devolución.",
      "Contrasta el recorrido con quienes realizan el trabajo. Registra las fuentes y asocia los procesos de trabajo al proceso productivo. Luego detalla las tareas en su propio paso.",
    ],
    example:"F-01 · Distribución de materiales. Entradas: pedido y cajas recibidas. Etapas: recepción y verificación → almacenamiento → preparación del pedido → despacho. Si el pedido está incompleto, vuelve a preparación. Salida: pedido entregado y registro de entrega. Soporte: croquis E-01.",
    check:"Al leerlo se entiende qué entra, cómo se transforma o se presta el servicio, quién interviene, qué sale y dónde comprobarlo.",
    template:"Bien elaborado o servicio prestado: [Completar]\nEntradas: [Completar]\nEtapas en orden y áreas que intervienen: [Completar]\nExcepciones o devoluciones: [Completar]\nSalidas y destinatarios: [Completar]\nDiagrama, fuente o pendiente de validar: [Completar]",
    reference:["Descripción del trabajo · NT-04-2023, art. 14",nt+"#page=7"],
  },
  risk: {
    title:"Cómo pasar de una observación a un hallazgo",
    steps:[
      "Selecciona la tarea de Módulo 1. Escribe primero qué viste, dónde ocurrió y qué fuente lo respalda.",
      "Identifica quién se expone, cómo podría ocurrir el daño y qué controles pudiste observar.",
      "Aplica el método que declaró tu equipo. Si falta un dato, deja la valoración pendiente e indica qué observarás o medirás, quién lo hará y cuándo.",
    ],
    example:"T-01 · Traslado de cajas. En el recorrido E-01, las cajas cruzaron la ruta peatonal. Posible daño: golpe por una carga en movimiento. Pendiente: observar el relevo y verificar cómo se separan las rutas.",
    check:"Se distingue la condición observada, el posible daño y lo que aún falta comprobar.",
    reference:["Identificación del trabajo · NT-04-2023, art. 14",nt+"#page=7"],
  },
  action: {
    title:"Cómo convertir un hallazgo en una actividad",
    steps:[
      "Elige un hallazgo y define qué condición quieres cambiar. Vincula la actividad con el plan correspondiente.",
      "Escribe la actividad con un verbo concreto. Registra quién la hará, cuándo se realizará y qué recurso necesita.",
      "Define cómo comprobarás la ejecución y cómo sabrás si la medida funcionó. Registra la evidencia real cuando se haya ejecutado.",
    ],
    example:"R-01 → PL-01 · Revisar la ruta de despacho con ambos turnos. Evidencia esperada: croquis y registro de inspección. Verificación: observar si peatones y carga pueden circular por recorridos separados.",
    check:"Otra persona puede ejecutar la acción y comprobar su resultado con el registro que indicaste.",
    reference:["Estructura de los planes · NT-04-2023, arts. 17 y 18",nt+"#page=7"],
  },
  policy: {
    title:"Cómo redactar la política de SST",
    steps:[
      "Si hay una política vigente, ubica su versión y fecha. Revisa si refleja la actividad del centro y sus prioridades de prevención.",
      "Si necesitas redactarla, indica a quién aplica y plantea objetivos preventivos ligados al diagnóstico. Incluye cumplimiento, mejora continua, recursos y participación de las personas trabajadoras.",
      "Registra la consulta al CSSL, la fecha, la firma o endoso del empleador y los delegados de prevención, la difusión y la revisión anual o ante cambios. Deja visible el estado real de cada paso.",
    ],
    example:"Centro Norte se propone reducir los cruces entre peatones y cargas en despacho. Para ello prevé revisar las rutas con quienes realizan el trabajo, asignar recursos para las mejoras y verificar su efecto. La consulta, la suscripción y la difusión se registran según su estado.",
    check:"Una persona del centro puede entender qué se busca prevenir, qué compromisos asume la entidad y cómo podrá conocer y revisar la política.",
    template:"Borrador para consulta y suscripción\nEntidad y centro: [Completar]\nActividad y prioridades del diagnóstico: [Completar]\nObjetivos específicos de prevención: [Completar]\nCompromisos de cumplimiento, mejora continua, participación y recursos: [Completar]\nConsulta al CSSL y fecha de elaboración: [Completar]\nFirma o endoso y estado: [Completar]\nDifusión y revisión anual o ante cambios: [Completar]",
    reference:["Política de SST · NT-04-2023, arts. 15 y 16",nt+"#page=7"],
  },
};

export function productionFromM1(input) {
  const flows = input?.flujo?.productivos;
  if (!Array.isArray(flows)) return "";
  return flows.filter(flow=>typeof flow?.nombre==="string" && flow.nombre.trim()).map(flow=>[
    [flow.codigo,flow.nombre].filter(Boolean).join(" · "),
    ...[["Entradas",flow.entradas],["Etapas",flow.secuencia],["Salidas",flow.salidas],["Soporte",flow.evidencia]]
      .map(([label,value])=>label+": "+((typeof value==="string" && value.trim())||"[Completar]")),
  ].join("\n")).join("\n\n");
}
