// Resolve a resource only after the LTI service has verified the signed message.
export const course = Object.freeze({
  url: "https://movidasst.org/course/view.php?id=154",
  modules: Object.freeze({
    m1: "Mesas de trabajo y descripción de procesos",
    m2: "Procesos peligrosos y evaluación de riesgos",
    m3: "Planes de trabajo y carta Gantt 2027",
    m4: "Integración y revisión final del PSST",
  }),
});

const claimBase = "https://purl.imsglobal.org/spec/lti/claim/";

function nonBlank(value) {
  return typeof value === "string" && value.trim().length > 0;
}

// Moodle's signed context and resource identifiers are taken from its launch,
// independent of the browser URL or user-supplied query parameters.
export function createCourseRouter({ issuer, clientId, deploymentId, contextId, resourceLinks }) {
  if (![issuer, clientId, deploymentId, contextId].every(nonBlank)) {
    throw new TypeError("Faltan datos del registro LTI de Moodle");
  }

  const entries = Object.keys(course.modules).map(moduleId => [resourceLinks?.[moduleId], moduleId]);
  if (entries.some(([resourceId]) => !nonBlank(resourceId)) ||
      new Set(entries.map(([resourceId]) => resourceId)).size !== entries.length) {
    throw new TypeError("Se requieren cuatro actividades LTI con identificadores distintos");
  }
  const lookup = new Map(entries);

  return function resolveVerifiedLaunch(claims) {
    const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (claims.iss !== issuer || !audience.includes(clientId) ||
        (audience.length > 1 && claims.azp !== clientId) ||
        (claims.azp !== undefined && claims.azp !== clientId) ||
        claims[claimBase + "version"] !== "1.3.0" ||
        claims[claimBase + "message_type"] !== "LtiResourceLinkRequest" ||
        claims[claimBase + "deployment_id"] !== deploymentId ||
        claims[claimBase + "context"]?.id !== contextId ||
        !nonBlank(claims.sub)) {
      return null;
    }

    const moduleId = lookup.get(claims[claimBase + "resource_link"]?.id);
    if (!moduleId) return null;
    return { moduleId, contextId, subject: claims.sub };
  };
}
