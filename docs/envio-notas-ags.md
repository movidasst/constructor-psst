# Envío de notas al curso 154

El transporte AGS solicita un token de Moodle con una aserción RS256 y el permiso de escritura de notas. Envía la calificación de 0 a 100 al ítem del módulo, para el usuario LTI guardado en la entrega. Solo acepta URLs HTTPS del Moodle registrado. Los errores se reportan por fase para el futuro trabajador de la cola.

Las pruebas usan una llave efímera y respuestas simuladas. La función de envío permanece en la rama; todavía no consume la cola de Supabase. Para activarla quedan la llave privada de la herramienta en los secretos del servidor, su JWK pública en el servicio, el registro administrativo LTI de Moodle y la asociación firmada entre los cuatro recursos y sus ítems AGS. El envío se conecta a la revisión docente, preservando la fecha de publicación para que una entrega previa no sobrescriba una revisión posterior.
