# Piloto del Módulo 1 de Constructor PSST

La base del piloto conserva el borrador de cada equipo, su entrega para revisión y las notas pendientes de envío. El Constructor público sigue funcionando como prototipo local.

## Módulo 1

- Criterios automáticos (5 × 12 puntos): alcance, referencia al flujo, descripción de la tarea con etapa, aportes de la mesa con referencia y bitácora con referencia y al menos ocho horas declaradas.
- Revisión técnica (0–40 puntos): el facilitador verifica fuentes, pertinencia y participación. Los campos y las referencias declaradas por el equipo se comprueban estructuralmente.
- Al enviar, se guarda una copia del borrador y la lista de integrantes de ese momento. La revisión cerrada encola un resultado por integrante.
- La cola representa una nota pendiente; la confirmación de envío debe venir de Moodle. Los reintentos deben mantener el orden de versiones para no reemplazar una nota reciente por una antigua.

## Seguridad e integración pendiente

El esquema `psst_pilot` es privado y su acceso está reservado al servidor. Antes de habilitar un cliente, el servicio debe verificar el lanzamiento LTI 1.3: firma, emisor, audiencia, validez temporal, estado y nonce de un solo uso, tipo de mensaje, despliegue y recurso. El contexto, el identificador de usuario y el rol provienen del lanzamiento validado. La pertenencia a cada equipo se administra en el servidor. Deben validarse también el alcance de la lectura del borrador y el alcance del docente antes de cerrar una revisión. La API nunca acepta el usuario o rol enviados por el navegador como prueba de identidad.

Para el registro mutuo, el Constructor proporciona sus URLs HTTPS de inicio y lanzamiento y su conjunto de llaves públicas. Del registro de Moodle se necesitan el emisor o Platform ID, Client ID, Deployment ID, URL de autenticación, URL de token y URL del conjunto de llaves de Moodle. Se configura AGS con envío de calificaciones. Las llaves privadas quedan en el servidor.

La interfaz aún debe guardar y leer por este servicio. Posteriormente, un trabajador de la cola enviará el resultado al ítem AGS de la actividad, con los alcances que Moodle conceda al lanzamiento. Quedan pendientes el almacenamiento privado de archivos, las pruebas de acceso entre equipos vía HTTP y la prueba de calificación de extremo a extremo. El SQL de prueba usa casos ficticios y deshace las inserciones.

Referencias: [LTI 1.3](https://www.imsglobal.org/spec/lti/v1p3/) · [AGS 2.0](https://www.imsglobal.org/spec/lti-ags/v2p0/) · [Herramienta externa en Moodle](https://docs.moodle.org/500/en/LTI_External_tools).
