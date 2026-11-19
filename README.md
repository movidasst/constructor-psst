# Constructor PSST · La Movida de SST+

**Primera implementación técnica (prototipo, fase 1).** Aplicación web de apoyo a la construcción trazable de Programas de Seguridad y Salud en el Trabajo (PSST) de Venezuela, fundamentada en la **NT-04-2023 (Gaceta Oficial n.º 42.712)**, la guía de elaboración, el instrumento de revisión y los lineamientos de INPSASEL.

## Qué permite hacer hoy

- Caracterizar una entidad y registrar procesos productivos y de trabajo.
- Identificar peligros vinculados a procesos, número de expuestos, controles y metodología técnica.
- Construir fichas de actividades preventivas vinculadas a cada peligro, con estructura del art. 17.
- Asociar soportes de prueba (PDF, imagen o DOCX) a requisitos documentales.
- Revisar datos mínimos pendientes antes de habilitar una impresión preliminar.
- Descargar un respaldo JSON de datos y metadatos (NO contiene los archivos adjuntos).

## Límites importantes de seguridad y alcance

**No es una plataforma de producción. Usa exclusivamente datos ficticios o de prueba.**

- No tiene autenticación, cuentas de usuario, cifrado ni almacenamiento en servidores.
- Los campos se conservan en **localStorage** y los archivos se guardan en **IndexedDB** del mismo navegador y dispositivo; pueden perderse si se borran los datos del navegador.
- Los archivos que se seleccionan **no se suben a una nube**. No hay colaboración entre usuarios ni garantías de confidencialidad de archivos locales.
- El archivo JSON exportado **no incluye los documentos adjuntos**.
- No se deben introducir nóminas personales, historias clínicas, expedientes médicos ni documentación empresarial confidencial.
- El porcentaje muestra **completitud de datos mínimos**, no cumplimiento normativo.
- No se verifican automáticamente autenticidad, firmas, participación efectiva ni documentación de campo.
- No equivale a la revisión del profesional competente, aprobación o registro de INPSASEL.

## Cómo ejecutarlo

Abrir `index.html` en un navegador moderno para pruebas locales. Para publicarlo con GitHub Pages, habilitar el despliegue del repositorio en Settings → Pages y revisar el sitio antes de asociar un dominio personalizado.

**Dominio previsto:** `constructor.movidasst.com` (aún requiere configuración de publicación, CNAME, DNS y HTTPS).

## Organización

- `index.html`: estructura accesible de la interfaz.
- `assets/styles.css`: identidad visual, colores pasteles y diseño móvil.
- `assets/app.js`: flujo, validación de captura, persistencia local y archivos de prueba.
- `docs/matriz-normativa-inicial.md`: requisitos jurídicos y criterios de revisión iniciales.
- `docs/arquitectura-y-siguiente-fase.md`: arquitectura futura, controles de seguridad y hoja de ruta.

## Criterio de diseño

**Dato → soporte documental → revisión humana.**

1. No inventar condiciones de trabajo, resultados de mediciones, actas ni firmas.
2. Mantener trazabilidad entre proceso, peligro, medida preventiva y plan.
3. Permitir borradores incompletos, pero señalar los pendientes antes de un documento consolidado.
4. Diferenciar lo obligatorio según NT-04, las orientaciones de la guía, el instrumento de revisión y los requisitos de trámite.
5. Mantener el [Auditor PSST](https://psst.movidasst.com/) separado hasta contar con una integración validada.

Identidad de La Movida: **De la Reacción a la Prevención**.
