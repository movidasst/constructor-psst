# Sesión y entrega del Módulo 1 en Moodle

El ingreso LTI validado busca una membresía única para la persona y para la combinación de emisor, cliente, despliegue y contexto. Si está asignada, emite un ticket de 90 segundos y lo lleva al Constructor en un fragmento de URL. La página retira el fragmento y canjea el ticket una vez. La sesión de dos horas se guarda en memoria del navegador; el servidor guarda hashes y el ámbito de proyecto y módulo. Para retomar el borrador después de recargar, se vuelve a abrir la actividad en Moodle.

La actividad M1 implementa lectura, guardado con revisión esperada y entrega con versión inmutable. M2, M3 y M4 se resuelven al mismo equipo y todavía no habilitan edición ni entrega. La interfaz usa referencias a evidencias. La subida privada de archivos y la pantalla de revisión docente se completarán antes del uso real.

El servicio se despliega en Constructor-PSST. El registro de Moodle sigue deshabilitado hasta configurar PSST_LTI_REGISTRATION. El endpoint /jwks sirve solo los campos públicos de la llave cuando se configura PSST_LTI_AGS_PUBLIC_JWK. La clave privada de firma se guardará del lado del servidor para AGS y debe corresponder con la publicada. Los secretos no se copian al repositorio.

Para desplegar un archivo desde el conector, se empaquetan en orden course-154.mjs, launch.mjs, workspace.mjs e index.ts, omitiendo únicamente sus importaciones locales. La versión publicada requiere que GitHub Pages sirva lti.html, assets/lti.css y assets/lti.mjs. El origen autorizado debe ser constructor.movidasst.com o la URL de Pages prevista en index.ts.

Validación: pruebas Node del lanzamiento y API; prueba SQL de sesiones, proyectos, guardado y entrega con rollback. Después de configurar el registro, verificar en Moodle 154 el lanzamiento real, el guardado desde otro dispositivo y el envío de una nota. 
