export const tutorials = {
  m1: {
    title:"Describe el trabajo real",
    chapters:"Capítulo III · Descripción del trabajo. El alcance y el equipo también aportan al capítulo I.",
    first:"Registra el centro, el área y con quién vas a observar el trabajo.",
    destinations:["Capítulos I y III · Alcance, equipo y organigrama", "Capítulo III · Proceso productivo y procesos de trabajo", "Capítulo III · Tareas, puestos y medios", "Capítulo III · Participación y validación", "Capítulo III y anexos · Evidencias de campo"],
    result:"Una descripción del trabajo real con tareas observadas, aportes de las personas trabajadoras y evidencias que puedas localizar.",
    supplies:"Ten a mano el centro, el área, los turnos y quién puede acompañarte a observar el trabajo.",
    next:"En el Módulo 2 usarás las tareas observadas para identificar y evaluar riesgos.",
    steps:[
      ["Delimita el trabajo",[
        "En Centro de trabajo escribe el lugar físico. En Área, turno y alcance indica qué incluirás en esta visita.",
        "En Integrantes, roles y acuerdos escribe quién coordina, quién conoce la tarea y cuándo harán el recorrido. En Organigrama escribe la máxima autoridad y usa Agregar debajo para los cargos que le reportan. El dibujo se actualiza al escribir.",
      ],"Centro Norte · despacho · turno de la mañana. El SSST organiza el recorrido y el personal de despacho explica la secuencia real.","Quedaron registrados el lugar, el turno, el alcance y las personas o roles que participan."],
      ["Describe el proceso productivo",[
        "Pulsa Agregar proceso productivo. Escribe qué bien o servicio entrega el centro y separa las etapas con comas. Verás el diagrama al escribir.",
        "Pulsa Agregar proceso de trabajo para registrar cada proceso que revisarás. Vincúlalo con el proceso productivo.",
      ],"F-01 · Distribución de materiales (recepción → almacenamiento → despacho). P-01 · Preparación de pedidos, vinculado al proceso productivo F-01.","Puedes ubicar cada proceso de trabajo dentro del proceso productivo al que pertenece."],
      ["Describe una tarea observada",[
        "Pulsa Agregar tarea, asígnale un código y elige el proceso de trabajo que registraste.",
        "Describe lo que viste en orden: quién hace la tarea, qué usa, dónde se mueve y en qué condiciones. Agrega más filas si observaste otras tareas.",
        "Si alguien describe una variante que no viste, anótala como aporte y deja pendiente su contraste.",
      ],"T-01 · Traslado de cajas a la zona de entrega, dentro de P-01. Se observó que el recorrido cruza un paso peatonal. Quedó pendiente revisar el turno de la tarde.","La ficha permite reconstruir la tarea y distinguir qué observaste de lo que recibiste como aporte."],
      ["Recoge y contrasta los aportes",[
        "Pregunta a quienes realizan el trabajo cómo hacen la tarea y qué cambia por turno, volumen o condiciones.",
        "Anota los aportes y compáralos con tu observación. Identifica la minuta o el registro. Si la asamblea o la validación formal están pendientes, registra su estado.",
      ],"El personal indicó que durante el relevo aumenta el tránsito peatonal; en esta visita se observó solo el turno diurno. Aporte registrado en E-02.","Se puede identificar qué aportó el personal y qué sigue pendiente de confirmar."],
      ["Completa la bitácora y entrega",[
        "Pulsa Agregar registro de campo. Para cada actividad real, indica fecha, horas, tarea y referencia de la evidencia. Usa códigos que permitan localizar el soporte.",
        "En Pendientes para el Módulo 2 escribe qué aspecto deberá comprobarse.",
      ],"E-01 · croquis de la ruta de T-01; E-02 · registro de consulta. Pendiente: observar el cruce durante el relevo.","Tienes alcance, proceso productivo, procesos de trabajo, tareas, aportes y evidencias de lo realizado. Las horas corresponden al trabajo efectivamente documentado."],
    ],
  },
  m2: {
    title:"Identifica y evalúa los riesgos",
    chapters:"Capítulo III · Procesos peligrosos y evaluación de riesgos. Completa el diagnóstico iniciado en el Módulo 1.",
    first:"Elige una tarea registrada en el Módulo 1 e indica cómo vas a evaluarla.",
    destinations:["Capítulo III · Alcance y método", "Capítulo III · Matriz, personas expuestas y controles"],
    result:"Una matriz con hallazgos vinculados a tareas del Módulo 1, controles observados, valoración sustentada y verificaciones pendientes.",
    supplies:"Ten a mano las tareas, evidencias y pendientes de M1. Identifica el método de evaluación que utilizarás y los datos que exige.",
    next:"En el Módulo 3 usarás los códigos de los hallazgos para vincularlos con los planes de trabajo.",
    steps:[
      ["Selecciona qué vas a evaluar",[
        "Busca en M1 el código de la tarea que revisarás. En Proceso y alcance escribe qué tarea, área y turno abarca esta evaluación.",
        "Indica el instrumento o método que aplicarás. Si te faltan observaciones, mediciones u otros datos, explica qué falta y quién debe verificarlo.",
      ],"T-01 · Traslado de cajas en despacho. Se revisa el cruce peatonal del turno de la mañana y queda por observar el relevo.","Alguien puede identificar la tarea, el alcance y cómo se sustentará la valoración."],
      ["Registra y revisa los hallazgos",[
        "Pulsa Agregar riesgo. Selecciona la tarea de M1 y asigna un código al hallazgo.",
        "Separa la condición observada, quién se expone, qué daño podría ocurrir y el control que viste. Sustenta la valoración con el método elegido o registra lo que queda pendiente.",
        "Pulsa Registrar puestos expuestos en el hallazgo. Registra cada puesto por área y turno, cuántas personas se exponen, cuánto dura la exposición y la fuente del dato.",
        "Si falta verificar una tarea, abre Estado de las tareas evaluadas y registra su situación, fuente, responsable y fecha cuando corresponda.",
      ],"R-01 vinculado a T-01. Condición: cruce de rutas. Personas expuestas: quienes cruzan en despacho. Posible daño: golpe por carga en movimiento. Evidencia: E-01. Falta observar el relevo.","Cada hallazgo tiene tarea y evidencia. Las evaluaciones pendientes tienen una acción de verificación."],
    ],
  },
  m3: {
    title:"Prepara los planes y el cronograma",
    chapters:"Capítulo IV · Planes de trabajo para abordar los riesgos y procesos peligrosos, con carta Gantt.",
    first:"Elige un hallazgo del Módulo 2 y crea el plan que lo atenderá.",
    destinations:["Capítulo IV · Ficha del plan (art. 17)", "Capítulo IV · Cobertura (art. 18)", "Capítulo IV · Actividades y seguimiento", "Capítulo IV · Carta Gantt"],
    result:"Planes vinculados a hallazgos del Módulo 2 y una carta Gantt de 2027 con actividades, responsables, fechas y seguimiento.",
    supplies:"Abre tu matriz de M2 y ubica los hallazgos que necesitan medidas. Ten a mano el calendario y los responsables que deberán validar tu propuesta.",
    next:"En el Módulo 4 incorporarás los planes y el cronograma al borrador del PSST.",
    steps:[
      ["Crea el primer plan de trabajo",[
        "Pulsa Agregar plan. Elige la familia que corresponda al trabajo por realizar. Vincula uno o varios hallazgos que el plan atenderá.",
        "Describe qué resultado buscas, cómo medirás la meta, dónde aplica, quién responde y qué recursos, instrumentos y controles de seguimiento necesitarás.",
      ],"PL-01 · Inspección de rutas internas. Hallazgo R-01. Meta propuesta: verificar el cruce de despacho en ambos turnos y documentar la medida acordada.","La ficha explica qué hallazgo atiende, qué pretende lograr y cómo se comprobará."],
      ["Revisa qué otros planes debes desarrollar",[
        "Consulta la cobertura y las indicaciones de cada familia. Compara los planes registrados con las necesidades del centro.",
        "Si falta un plan, vuelve a la ficha para crearlo. Si te falta información, anota qué debes validar. Revisa especialmente los hallazgos prioritarios.",
      ],"Inspecciones ya atiende R-01. Si la revisión indica que también se requiere inducción, registra esa necesidad y define qué debe verificarse antes de elaborar la ficha.","Puedes explicar qué planes cubren los hallazgos y cuáles quedan por preparar."],
      ["Programa acciones concretas",[
        "Pulsa Agregar actividad y selecciona su plan. Escribe una acción que se pueda ejecutar y verificar. Asigna responsable, fechas previstas y recursos.",
        "Indica qué evidencia quedará y cómo comprobarás que la medida tuvo efecto. Si aún no se ejecutó, registra fechas previstas y deja la evidencia real pendiente.",
      ],"Actividad de PL-01: inspeccionar el cruce de despacho en ambos turnos. Responsable previsto: SSST. Evidencia esperada: lista de inspección y croquis actualizado.","Cada actividad tiene un plan, un responsable, fechas y una forma de verificarla."],
      ["Revisa la carta Gantt y entrega",[
        "Comprueba que cada actividad aparezca en los meses previstos. Si algo falta, vuelve a Actividades de los planes y corrige las fechas.",
        "Revisa responsables, coincidencias de fechas y horas de formación cuando apliquen. Puedes descargar la carta Gantt en Excel.",
      ],"Si la inspección va del 10 al 15 de febrero, debe aparecer en febrero. Filtra por responsable para verificar su carga de trabajo.","El cronograma coincide con las actividades y tiene fechas y responsables visibles."],
    ],
  },
  m4: {
    title:"Integra el borrador del PSST",
    chapters:"Introducción, capítulos I a VIII y anexos. Reutiliza el diagnóstico de M1 y M2 en el III, y los planes y la Gantt de M3 en el IV.",
    first:"Revisa qué versiones de M1, M2 y M3 están disponibles y escribe la introducción.",
    destinations:["Introducción · Fuentes del borrador", "Capítulos I a III · Generalidades, política y diagnóstico", "Capítulos IV a VI · Planes, investigación y compromiso", "Capítulos VII y VIII · Contratación y evaluación", "Capítulos I a VIII · Pendientes de revisión", "Capítulos I a VIII y anexos · Cotejo con los instrumentos"],
    result:"Un primer borrador del PSST que integra el diagnóstico, los planes, el cronograma y el registro de lo que falta validar.",
    supplies:"Verifica qué entregas de M1, M2 y M3 están disponibles. Ten a mano las referencias a tus evidencias y documentos internos.",
    next:"La entrega queda disponible para revisión técnica. Conserva la copia descargada y vuelve al módulo para consultar la devolución.",
    steps:[
      ["Verifica las fuentes del borrador",[
        "Revisa Fuentes y documento de trabajo. Identifica qué versión se está usando de M1, M2 y M3.",
        "Si falta una fuente importante, vuelve al módulo de origen para completarla. Escribe una introducción breve que indique dónde y cómo se preparó el borrador.",
      ],"El borrador de Centro Norte usa el levantamiento de despacho, la matriz con el hallazgo R-01 y el plan PL-01. Falta comprobar el turno de relevo.","Sabes qué fuentes respaldan el borrador y qué información aún debes validar."],
      ["Redacta los capítulos I a III",[
        "Abre Capítulo 1 · Generalidades y registra los datos de la entidad, los objetivos, el alcance y los responsables. Abre Capítulo 2 para preparar la política o identificar su versión vigente.",
        "Abre Capítulo 3 para explicar el proceso productivo, la evaluación y la validación. Usa como respaldo el levantamiento de M1 y la matriz de M2, que se incorporan al borrador.",
      ],"En el capítulo III, describe el proceso productivo F-01, ubica P-01 y T-01 y vincula R-01 con el croquis E-01.","Los capítulos dejan claro a quién aplica el PSST, qué política lo orienta y cómo se preparó el diagnóstico."],
      ["Redacta los capítulos IV a VI",[
        "Abre Capítulo 4 · Planes de trabajo. Usa los planes y la Gantt de M3 y explica sus prioridades, recursos y seguimiento.",
        "En el capítulo V indica cómo se investigarán accidentes y enfermedades y dónde estarán los formatos. En el capítulo VI prepara o referencia la carta compromiso y registra su estado.",
      ],"R-01 queda vinculado a PL-01 y a su actividad de febrero. La carta compromiso permanece en borrador hasta la revisión y suscripción correspondientes.","Los planes y sus fechas pueden localizarse y queda documentado el estado de los procedimientos y la carta."],
      ["Redacta los capítulos VII y VIII",[
        "Describe cómo se coordina el trabajo con contratistas cuando intervienen. Si una situación no aplica, explica el motivo.",
        "Registra cómo se evaluarán los planes. Para cada indicador, indica qué se mide, quién revisa el resultado y con qué frecuencia.",
      ],"Indicador propuesto: porcentaje de cruces inspeccionados según el cronograma. Fuente: listas de inspección; revisión mensual a cargo del SSST.","Queda claro cómo se coordina el trabajo de terceros cuando corresponda y cómo se medirá el avance."],
      ["Registra las brechas de revisión",[
        "Revisa el borrador y pulsa Agregar brecha si falta información, evidencia, revisión o validación. Especifica capítulo, acción, responsable y plazo.",
        "En Resultado de la revisión de brechas resume qué revisaste y qué queda abierto. Si no detectaste brechas, registra esa conclusión luego de contrastar el borrador.",
      ],"Capítulo III · falta observar el cruce durante el relevo. Acción: programar un recorrido, registrar lo observado y actualizar E-01.","Cada pendiente importante tiene una acción concreta y una referencia para darle seguimiento."],
      ["Contrasta, descarga y entrega",[
        "Abre los criterios de cada capítulo. Registra su estado y evidencia o justificación. Usa Ir al campo del borrador para corregir lo que falte.",
        "Pulsa Revisar entregable para ver el avance de los capítulos, descargar el Word y entregar la versión revisada.",
      ],"Criterio de evidencia del diagnóstico: E-01 respalda el turno observado; el relevo sigue pendiente. Deja esa diferencia visible en el borrador.","El PSST incluye los ocho capítulos, sus referencias, la carta Gantt y los pendientes de validación identificados."],
    ],
  },
};

export const glossary = {
  m1:[["Proceso productivo","Etapas que conectan las entradas con el bien o servicio entregado."],["Proceso de trabajo","Conjunto de actividades que realiza el personal para obtener un resultado dentro del proceso productivo."],["Tarea","Acción concreta que puedes observar y describir."],["Evidencia","Fuente que permite ubicar y verificar una observación, por ejemplo un croquis fechado o una ficha de visita."]],
  m2:[["Peligro","Fuente o condición con potencial de causar daño."],["Exposición","Quién entra en contacto con el peligro, en qué condiciones y con qué frecuencia o duración."],["Valoración","Resultado del método aplicado con los datos disponibles."],["Control","Medida que se utiliza para eliminar el peligro o reducir la exposición o el riesgo."]],
  m3:[["Plan","Ficha que reúne el objetivo, las medidas, los responsables y los recursos para atender una necesidad."],["Actividad","Acción concreta programada dentro de un plan."],["Carta Gantt","Calendario visual de las actividades según sus fechas."],["Evidencia de ejecución","Registro que permite comprobar que la actividad se realizó."]],
  m4:[["Fuente","Registro concreto que respalda una parte del borrador."],["Anexo","Documento o evidencia complementaria referenciada en el PSST."],["Brecha","Información, acción o validación que falta frente al criterio revisado."],["Borrador","Versión de trabajo que reúne lo elaborado y deja visibles los pendientes de revisión."]],
};
