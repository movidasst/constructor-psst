# Arquitectura y hoja de ruta — Movida Constructor PSST

## Objetivo funcional

Generar y administrar un PSST **específico para cada entidad y centro de trabajo**, construido a partir de datos reales y soportes verificables, con reglas normativas trazables y separación de funciones. La inteligencia artificial no puede inventar mediciones, actas, firmas, participación de trabajadores ni evaluaciones.

## Fase 1 (presente): interfaz prototipo local

- Página web estática en HTML, CSS y JavaScript sin dependencias externas.
- Flujo: Entidad → Procesos → Peligros y riesgos → Planes → Evidencias → Revisión preliminar.
- Datos de captura en localStorage del dispositivo; archivos de prueba en IndexedDB (hasta 12 MB por archivo).
- Exportación de **metadatos JSON** para respaldo exploratorio; NO incluye bytes de archivos adjuntos.
- Indicadores de captura mínima, no porcentaje de cumplimiento legal.
- No hay usuarios, cifrado, base de datos central, control de acceso, copias de seguridad de servidor, firmas digitales ni conexión al INPSASEL.
- **No usar en producción con documentación personal, médica ni empresarial confidencial.**

## Fase 2: backend seguro de documentos

Se diseñará un proyecto de Supabase con migraciones y control de acceso antes de usar información real:

- Entidades separadas por organización/centro; usuario profesional, empresa, CSSL, revisión, administración.
- Tablas preliminares: organizations, sites, members, processes, hazards, assessments, controls, plans, actions, requirements, documents, document_revisions, reviews, approvals, audit_log.
- Políticas RLS que nieguen acceso por defecto y limiten cada usuario a su entidad y rol. Las políticas se prueban con cuentas de distintas organizaciones.
- Buckets **privados**; paths con identificadores opacos; lectura/escritura con URLs firmadas y autorización.
- Validación de MIME/extensión/tamaño, tratamiento de archivos maliciosos, versionado, respaldo, retención y borrado.
- No enviar documentos confidenciales a servicios de IA sin autorización explícita y acuerdos de privacidad suficientes.
- La interfaz del prototipo deberá sustituir localStorage/IndexedDB por un adaptador de persistencia seguro antes de su uso operativo.

## Fase 3: motor normativo y validaciones

- Matriz maestra de requisitos versionada (norma, guía, instrumento, lineamientos) con fuente exacta y jerarquía.
- Estados por requisito: pendiente / con dato / adjunto recibido / revisado / requiere corrección / no aplica motivadamente.
- Validaciones deterministas: campos, números, referencias, fechas, vínculos, presupuestos y tiempos.
- Revisión asistida sólo para cuestiones cualitativas; el profesional confirma.
- Políticas de desbloqueo para documentos: se puede guardar borrador incompleto, pero no emitir un documento consolidado sin las comprobaciones definidas.

## Fase 4: integración con Auditor PSST

- Mantener el Auditor PSST existente independiente hasta diseñar una API de revisión.
- Consumir una misma matriz de reglas; transferir hallazgos con IDs de requisito y sección.
- Diferenciar siempre preparación interna de aprobación por INPSASEL.
- Generar DOCX/PDF y trazabilidad entre proceso, peligro, control, plan, acción y evidencia.

## Fase 5: gestión continua

Indicadores de planificación y ejecución diferenciados; revisiones periódicas; alertas; históricos; informes; gestión de cambios y de contratistas; expediente de consignación. Protección reforzada de datos y revisión de obligaciones aplicables.

## Preparación de publicación

El subdominio **constructor.movidasst.com** está propuesto, pero no queda activo por crear archivos en GitHub. Se requerirá configurar GitHub Pages (o alojamiento elegido), dominio personalizado, DNS y HTTPS. No crear el CNAME hasta revisar el despliegue y DNS vigente.

## Pruebas mínimas antes del uso real

1. Separación entre dos organizaciones distintas y entre roles.
2. Subir/bajar/eliminar archivos con permisos y auditoría.
3. Probar que una URL de archivo no permita acceso cruzado.
4. Manejo de formatos inválidos, archivos grandes y errores de red.
5. Verificación de requerimientos del Art. 17 y evidencias reales.
6. Confirmar que borradores/informes no declaren aprobación estatal.
7. Validaciones de accesibilidad móvil y recuperación ante fallos.
