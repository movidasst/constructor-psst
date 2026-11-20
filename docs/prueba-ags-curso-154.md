# Verificación del servicio de notas

En el curso 154 se registraron cuatro actividades con ítems AGS independientes (M1: 444, M2: 445, M3: 446, M4: 447). El diagnóstico del M1 compara su recurso y su ítem firmados con los registrados. Después pide a Moodle un token con permiso para enviar notas y muestra únicamente el estado abreviado en `pruebaAGS`. No invoca el endpoint de escritura de notas.

La llave privada se obtiene internamente de Vault mediante un RPC reservado a service_role. La llave y el token quedan en el servidor. Reabrir M1 como docente con la actividad oculta para comprobar la autorización. Que Moodle entregue el token confirma la autorización, pero la aceptación de una calificación y la entrega estudiantil requieren su propia prueba.
