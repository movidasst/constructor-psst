# Integración LTI del curso 154

Destino confirmado: [Taller Práctico de PSST](https://movidasst.org/course/view.php?id=154). Es el curso real. Se usa un registro LTI 1.3 de la herramienta y cuatro actividades externas con calificación propia.

| Actividad | Entregable a evaluar |
|---|---|
| M1 · Mesas de trabajo y descripción de procesos | Mapa y flujo del proceso piloto, descripción de la tarea, participación y bitácora. |
| M2 · Procesos peligrosos y evaluación de riesgos | Registro por etapa, matriz inicial y evaluaciones pendientes. |
| M3 · Planes de trabajo y carta Gantt 2027 | Planes prioritarios, recursos y cronograma. |
| M4 · Integración y revisión final del PSST | Primer borrador del PSST con evidencias y registro de brechas. |

Las cuatro actividades abren el mismo proyecto de la empresa o equipo. Cada módulo tiene sus propias versiones de entrega, rúbrica e ítem de calificación. Una actividad no sobrescribe las notas de las otras. La entrega final del borrador y la carta Gantt se mantiene para el 15 de diciembre de 2026 según el cronograma comunicado.

El número `154` identifica el curso en la URL de Moodle. Se debe registrar por separado el identificador firmado de contexto y los cuatro identificadores firmados de recurso que envíe ese Moodle. El enrutador de esta rama valida la coincidencia de esos identificadores, el emisor, el cliente y el despliegue después de que el servicio valide la firma y la sesión de lanzamiento.

## Habilitación en el curso real

Se prepara una única conexión y se incorpora primero el M1. Antes de que lo usen los participantes, se verifica con un usuario autorizado en el curso real el acceso y la devolución de una nota a su propio ítem. La actividad de entrega existente se mantiene disponible durante la verificación. M2, M3 y M4 se habilitan a medida que sus rúbricas y devoluciones se comprueben.

El enrutador y la base del M1 están en la rama de trabajo. Todavía se necesitan las URLs del servicio LTI, el registro administrativo de Moodle, el guardado de la interfaz y el cliente de envío AGS. Los valores de contexto y recurso se completan al registrar las actividades; no se inventan ni se deducen de parámetros enviados por el navegador.
