# Registro administrativo en Moodle 154

## URLs de la herramienta

- URL de la herramienta y URI de redirección: https://edeydaueyxilutczhazm.supabase.co/functions/v1/psst-lti/launch
- Inicio de sesión OIDC: https://edeydaueyxilutczhazm.supabase.co/functions/v1/psst-lti/login
- Conjunto público de llaves: https://edeydaueyxilutczhazm.supabase.co/functions/v1/psst-lti/jwks

Usar registro manual LTI 1.3, llave de tipo URL de conjunto de llaves, ventana nueva y servicio de calificaciones. Registrar como herramienta preconfigurada; esto por sí solo no añade una actividad al curso. La conexión se deja sin registro de plataforma en Supabase hasta asociar los identificadores del curso 154 y sus cuatro actividades.

La primera lectura del conjunto de llaves hace que Supabase genere un par en el servidor si todavía no existe. Vault conserva la parte privada y el endpoint devuelve únicamente los campos públicos de firma. El endpoint no devuelve ni registra la clave privada en sus respuestas.

Después de guardar la herramienta, obtener de los detalles de configuración de Moodle: identificador de plataforma, identificador de cliente, identificador de despliegue, URL de autenticación, URL de token y URL de llaves de Moodle. Son datos de registro, no contraseñas. Antes de probar una nota, configurar la asociación del contexto y los recursos con el curso 154.
