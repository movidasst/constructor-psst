# Matriz inicial de requisitos — Constructor PSST

Estado: **matriz de arranque**, no transcripción exhaustiva. Referencias contrastadas con los archivos proporcionados: Gaceta Oficial n.º 42.712 (NT-04-2023), Guía para la elaboración de PSST de INPSASEL, Instrumento de revisión de PSST y Lineamientos para el registro y aprobación (octubre de 2023).

## Jerarquía y separación

1. La **NT-04-2023** establece los requisitos normativos que deben mapearse a reglas.
2. La **Guía de elaboración** orienta la presentación y propone una estructura de ocho capítulos; no toda sugerencia editorial de la guía constituye una exigencia autónoma de la norma.
3. El **Instrumento de revisión** proporciona preguntas operativas para comprobar contenidos.
4. Los **Lineamientos** describen la consignación y el procedimiento de aprobación: separar requisitos de contenido, anexos/evidencias y trámites.

Ningún archivo aportado concede a esta aplicación autoridad de aprobación, registro ni certificación.

## Reglas de captura iniciales

| ID | Origen | Requisito comprobable | Dato mínimo | Evidencia / validación | Automatización |
|---|---|---|---|---|---|
| R-001 | Art. 14.1.1 NT-04 | Caracterizar etapas del proceso productivo y organización | Actividad, objeto, medios, tareas, áreas, puestos | Flujograma, organigrama; observación de campo | Captura estructurada; revisión humana |
| R-002 | Art. 14.1.3 NT-04 | Validación de información recopilada por Asamblea General y aprobación con 50% + 1 de la nómina | Nómina de referencia, asistencia, resultado | Convocatoria, acta, registros; autenticar manualmente | Cálculo de umbral en futura fase; revisión humana |
| R-003 | Art. 14.1.5 NT-04 | Indicar número de trabajadores expuestos por áreas o zonas | Área/etapa + cantidad expuestos | Registros y comprobación con actividad real | Validación de campos |
| R-004 | Art. 14.2.1 NT-04 | Identificar el proceso de trabajo con participación y dejar constancia | Procesos y participantes | Acta correspondiente | Control de adjunto, revisión humana |
| R-005 | Art. 14.2.2–2.3 NT-04 | Identificar condiciones peligrosas y medidas preventivas priorizadas | Descripción, expuestos, medidas y justificación | Evaluaciones de riesgos y diagnósticos | Enlace peligro–control; criterio profesional |
| R-006 | Arts. 15–16 NT-04 | Política específica, consultada, fechada, firmada/endosada, difundida y revisada | Declaración, fecha, responsables, difusión | Política y constancias | Asistencia en redacción; verificación humana |
| R-007 | Art. 17.1.1.1 NT-04 | Cada plan con objetivos, metas y alcance | Objetivo y meta; alcance en fase siguiente | Ficha del plan | Validación de estructura |
| R-008 | Art. 17.1.1.2 NT-04 | Frecuencia de ejecución | Periodicidad y fechas | Cronograma | Validación de estructura |
| R-009 | Art. 17.1.1.3 NT-04 | Responsables y personal involucrado | Cargo/roles | Ficha y asignación | Validación de estructura |
| R-010 | Art. 17.1.1.4 NT-04 | Procedimiento con acciones preventivas, predictivas, correctivas y divulgativas | Cuatro enfoques de ejecución | Documento/procedimiento | Validación de estructura |
| R-011 | Art. 17.1.1.5 NT-04 | Formularios, instrumentos y recursos | Procedimientos, formularios, recursos | Instrumentos anexos | Validación de estructura |
| R-012 | Art. 17.1.2 NT-04 | Diseño por el SSST y revisión/aprobación por actores previstos | Rol del elaborador y del CSSL | Acta/soporte de revisión | Pendiente de verificación humana |
| R-013 | Art. 18.1.1 NT-04 | Programa de educación e información de al menos 16 horas trimestrales por trabajador | Plan individual/grupo, horas y trimestre | Cronograma y registros de formación | Control automático futuro, sin confundir plan con ejecución |
| R-014 | Art. 18.2.5.2 NT-04 | Cronograma de inspecciones con elementos, área, frecuencia, fecha, responsable, acciones y comprobación | Campos de inspección | Cronograma y registros | Módulo específico posterior |
| R-015 | Art. 18.2.5.4 NT-04 | Discusión de observaciones en CSSL dentro de dos días continuos | Fecha hallazgo / discusión | Acta/reporte | Alertas en módulo de seguimiento futuro |
| R-016 | Art. 18.2.6.3 NT-04 | Difusión mensual de estadísticas, respetando confidencialidad | Indicadores agregados | Publicaciones, reportes | Automatización agregada; no incorporar historias clínicas en repositorio |
| R-017 | Art. 18.2.12.1 NT-04 | Recursos e inversión cuantificados | Unidades, precio unitario, costo total | Presupuesto y consideración por CSSL/SSST | Cálculo de importes futuro |
| R-018 | Arts. 18.2.11 y 18.2.13 NT-04 | Emergencias e ingeniería/ergonomía adecuados al proceso | Amenazas, análisis de puesto, acciones | Estudios, planos, planes | Propuestas asistidas; revisión de especialistas |
| R-019 | Guía INPSASEL | Presentación en ocho capítulos y anexos/requisitos | Contenido organizado | Carpeta de expediente | Generación documental futura |
| R-020 | Instrumento INPSASEL | Comprobar estructura y contenido por pregunta, observaciones | Evidencia citada y estado de verificación | Instrumento con hallazgos | Revisor asistido; no confundir con aprobación |
| R-021 | Lineamientos INPSASEL | Tramitar consignación y correcciones ante GERESAT | Datos de trámite | Constancias externas | Seguimiento, no presentación automática |

## Reglas de honestidad técnica

- La **captura de datos** no equivale a su **verificación** ni a **conformidad normativa**.
- La existencia de un PDF, acta o imagen en un expediente no comprueba autenticidad, participación efectiva ni firma.
- La selección de métodos de evaluación de riesgos, cálculos de exposición, resultados clínicos y visitas de campo corresponden a personas competentes.
- Los registros de salud individuales requieren una arquitectura y permisos específicos; **no se almacenan en este prototipo**.
- Una actividad y su peligro deben conservar identificadores estables para trazar cambios y correcciones.
- El Art. 18 describe componentes; las fichas funcionales de la interfaz no se presentarán como un número normativo de «planes independientes».

## Alcance actual y pendiente

**Prototipo implementado**: captura de entidad, procesos, peligros, planes, enlace mediante IDs, archivo local de soportes de prueba y control de campos mínimos.

**No implementado aún**: marco completo de capítulos; formalización de acta asamblea y conteo 50%+1; autenticación; permisos; almacenamiento seguro multiusuario; historial auditado; validación externa de documentos; cálculo normativo detallado de planes; generación DOCX/PDF formal; integración con Auditor PSST; expediente real de consignación.
