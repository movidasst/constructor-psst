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
    if (!matchesRegistration(claims, { issuer, clientId, deploymentId, contextId })) return null;
    const moduleId = lookup.get(claims[claimBase + "resource_link"]?.id);
    if (!moduleId) return null;
    return { moduleId, contextId, subject: claims.sub };
  };
}

function matchesRegistration(claims, { issuer, clientId, deploymentId, contextId }) {
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  return claims.iss === issuer && audience.includes(clientId) &&
    (audience.length === 1 || claims.azp === clientId) &&
    (claims.azp === undefined || claims.azp === clientId) &&
    claims[claimBase + "version"] === "1.3.0" &&
    claims[claimBase + "message_type"] === "LtiResourceLinkRequest" &&
    claims[claimBase + "deployment_id"] === deploymentId &&
    claims[claimBase + "context"]?.id === contextId && nonBlank(claims.sub);
}

export function createInstructorDiagnostic(config) {
  if (![config.issuer, config.clientId, config.deploymentId, config.contextId].every(nonBlank)) {
    throw new TypeError("Faltan datos del registro LTI de Moodle");
  }
  const staff = new Set([
    "http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor",
    "http://purl.imsglobal.org/vocab/lis/v2/system/person#Administrator",
    "http://purl.imsglobal.org/vocab/lis/v2/institution/person#Administrator",
  ]);
  return function resolveForConfiguration(claims) {
    if (!matchesRegistration(claims, config)) return null;
    const roles = claims[claimBase + "roles"];
    const resource = claims[claimBase + "resource_link"];
    if (!Array.isArray(roles) || !roles.some(role => staff.has(role)) ||
        !nonBlank(resource?.id) || resource.id.length > 200) return null;
    const ags = claims["https://purl.imsglobal.org/spec/lti-ags/claim/endpoint"];
    let lineItem = null;
    try {
      const url = new URL(ags?.lineitem);
      if (url.protocol === "https:" && url.origin === new URL(config.issuer).origin &&
          !url.username && !url.password && !url.hash) lineItem = url.href;
    } catch { /* No grading item provided in this launch. */ }
    return { diagnostic: true, contextId: config.contextId, resourceId: resource.id, lineItem,
      title: typeof resource.title === "string" ? resource.title.slice(0, 200) : null };
  };
}

export function createPilotRouter(config) {
  if (config.diagnostic !== true) return createCourseRouter(config);
  const diagnostic = createInstructorDiagnostic(config);
  if (config.studentPilot?.enabled !== true) return diagnostic;
  const normal = createCourseRouter(config);
  const subject = config.studentPilot.subject;
  if (!/^[1-9][0-9]{0,17}$/.test(subject ?? "")) throw new TypeError("Cuenta de prueba inválida");
  return claims => {
    if (claims.sub === subject && Array.isArray(claims[claimBase + "roles"]) &&
        claims[claimBase + "roles"].includes("http://purl.imsglobal.org/vocab/lis/v2/membership#Learner")) {
      const match = normal(claims);
      if (match?.moduleId === "m1") return match;
    }
    return diagnostic(claims);
  };
}
