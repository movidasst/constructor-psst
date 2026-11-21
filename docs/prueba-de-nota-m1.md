# Prueba de escritura de calificaciones

Activar únicamente cuando se conozca el identificador de una cuenta dedicada a pruebas matriculada como estudiante del curso 154. La prueba usa la actividad M1 oculta, solo el destinatario designado y su columna 444. Se prepara una fila desde SQL administrativo con esa cuenta, el ítem configurado y la nota acordada. El siguiente lanzamiento diagnóstico firmado de un docente por M1 ejecuta la prueba. Si no hay una fila en espera, el lanzamiento comprueba únicamente el token. La operación es de un solo intento y el diagnóstico no muestra el destinatario.

La prueba no simula una entrega del Constructor. Su objetivo es comprobar que Moodle acepta y muestra el resultado en el libro. Si el estado es fallido o incierto, revisar el libro antes de reintentar. No insertar una prueba contra un estudiante real. El SQL de validación ejecuta las comprobaciones con rollback y no realiza ninguna llamada a Moodle.
