import assert from "node:assert/strict";
import { test } from "node:test";
import { course, createCourseRouter } from "./course-154.mjs";

const prefix = "https://purl.imsglobal.org/spec/lti/claim/";
const config = {
  issuer: "https://moodle.example",
  clientId: "client",
  deploymentId: "deployment",
  contextId: "opaque-course-context",
  resourceLinks: { m1: "link-1", m2: "link-2", m3: "link-3", m4: "link-4" },
};
const claims = {
  iss: config.issuer,
  aud: config.clientId,
  sub: "participant-a",
  [prefix + "deployment_id"]: config.deploymentId,
  [prefix + "context"]: { id: config.contextId },
  [prefix + "message_type"]: "LtiResourceLinkRequest",
  [prefix + "version"]: "1.3.0",
};
const launch = (id, overrides = {}) => ({
  ...claims, [prefix + "resource_link"]: { id }, ...overrides,
});

test("routes each configured activity to its own module in the same course", () => {
  const route = createCourseRouter(config);
  for (const [moduleId, id] of Object.entries(config.resourceLinks)) {
    assert.deepEqual(route(launch(id)), { moduleId, contextId: config.contextId, subject: claims.sub });
    assert.ok(course.modules[moduleId]);
  }
});

test("rejects other courses, deployments and unmapped resources", () => {
  const route = createCourseRouter(config);
  assert.equal(route(launch("link-1", { [prefix + "context"]: { id: "other-course" } })), null);
  assert.equal(route(launch("link-1", { [prefix + "deployment_id"]: "other-deployment" })), null);
  assert.equal(route(launch("unknown")), null);
  assert.equal(route(launch("link-1", { aud: ["client", "other"], azp: "other" })), null);
});

test("requires a dedicated activity for each of the four modules", () => {
  assert.throws(() => createCourseRouter({ ...config, resourceLinks: { ...config.resourceLinks, m4: "link-1" } }));
  assert.throws(() => createCourseRouter({ ...config, resourceLinks: { m1: "link-1" } }));
});

test("diagnostic accepts course staff while withholding identities and rejecting learners", async () => {
  const { createInstructorDiagnostic } = await import("./course-154.mjs");
  const route = createInstructorDiagnostic(config);
  const roles = prefix + "roles";
  const grader = { [roles]: ["http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor"],
    "https://purl.imsglobal.org/spec/lti-ags/claim/endpoint": {
      lineitem: "https://moodle.example/mod/lti/services.php/154/lineitems/28" } };
  assert.deepEqual(route(launch("new-activity", grader)), {
    diagnostic: true, contextId: config.contextId, resourceId: "new-activity",
    lineItem: "https://moodle.example/mod/lti/services.php/154/lineitems/28", title: null,
  });
  assert.equal(route(launch("new-activity", { ...grader, [prefix + "context"]: { id: "other" } })), null);
  assert.equal(route(launch("new-activity", { [roles]: ["http://purl.imsglobal.org/vocab/lis/v2/membership#Learner"] })), null);
});

test("student pilot grants only the named learner access to M1", async () => {
  const { createPilotRouter } = await import("./course-154.mjs");
  const route = createPilotRouter({ ...config, diagnostic: true, studentPilot: { enabled: true, subject: "100" } });
  const student = { sub: "100", [prefix + "roles"]: ["http://purl.imsglobal.org/vocab/lis/v2/membership#Learner"] };
  assert.deepEqual(route(launch("link-1", student)), { moduleId: "m1", contextId: config.contextId, subject: "100" });
  assert.equal(route(launch("link-2", student)), null);
  const m2Pilot = createPilotRouter({ ...config, diagnostic: true,
    studentPilot: { enabled: true, subject: "100", modules: ["m1", "m2"] } });
  assert.equal(m2Pilot(launch("link-2", student))?.moduleId, "m2");
  assert.equal(m2Pilot(launch("link-2", { ...student, sub: "200" })), null);
  assert.equal(m2Pilot(launch("link-3", student)), null);
  assert.equal(route(launch("link-1", { ...student, sub: "200" })), null);
  assert.equal(route(launch("link-1", { ...student, [prefix + "roles"]: [] })), null);
});
