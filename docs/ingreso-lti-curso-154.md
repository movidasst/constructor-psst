# Verificación del ingreso LTI

El servicio `psst-lti` en el proyecto Constructor-PSST tiene dos rutas:

- Inicio OIDC: `https://edeydaueyxilutczhazm.supabase.co/functions/v1/psst-lti/login`
- Retorno y URL de herramienta: `https://edeydaueyxilutczhazm.supabase.co/functions/v1/psst-lti/launch`

Se propone abrir la herramienta en una ventana nueva para comprobar el flujo y el manejo de cookies del navegador. El servicio comprueba firma RS256 con las llaves públicas configuradas de Moodle, vigencia, datos de registro, vínculo de actividad y estado de cinco minutos ligado al navegador. Un estado válido se consume de manera atómica. Ninguna de estas rutas crea una sesión de trabajo ni autoriza lectura o escritura de un PSST. Un lanzamiento correcto identifica el módulo con un mensaje de diagnóstico.

La función se despliega deshabilitada hasta establecer `PSST_LTI_REGISTRATION` en los secretos de Supabase. Campos esperados: `issuer`, `authorizationUrl`, `jwksUrl`, `clientId`, `deploymentId`, `contextId`, `resourceLinks` (m1, m2, m3, m4). La URL del curso no equivale al identificador de contexto firmado. Antes de habilitar un registro real se debe acordar con el administrador cómo identificar el contexto de 154 y vincular las cuatro actividades. No se admiten comodines para curso o actividad en el despliegue activo.

Para desplegar la misma versión por el conector se empaquetan, en ese orden, `course-154.mjs`, `launch.mjs` e `index.ts`, quitando las dos importaciones locales. Si se usa CLI, se conserva la estructura del repositorio. Las rutas públicas reciben mensajes OIDC de Moodle y validan los mensajes dentro de la función en vez del verificador de JWT de Supabase.

Pruebas locales:
```sh
node --test supabase/functions/_shared/*.test.mjs
```

Próximo tramo: intercambio de sesión para retomar el proyecto privado del equipo, publicación del conjunto de llaves públicas de la herramienta para el registro administrativo y envío AGS de resultados. El curso real todavía conserva su entrega existente.
