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
