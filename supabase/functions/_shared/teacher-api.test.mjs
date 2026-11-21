import assert from "node:assert/strict";
import { test } from "node:test";
import { createTeacherApi } from "./teacher-api.mjs";
import { digest } from "./launch.mjs";

const origin = "https://movidasst.github.io";
const id = "01234567-89ab-4def-a123-012345678901";
const session = "a".repeat(64);
const lineItem = "https://movidasst.org/mod/lti/services.php/154/lineitems/447/lineitem?type_id=1";

function request(body, headers = {}) {
  return new Request("https://api.example/teacher", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json", Authorization: "Bearer " + session, ...headers },
    body: JSON.stringify(body),
  });
}

test("teacher requests deny foreign origins, missing sessions and invalid rubric points before reaching the database", async () => {
  const api = createTeacherApi({ origin, rpc: async () => assert.fail("unexpected database call") });
  assert.equal((await api("teacher", request({ action: "list" }, { Origin: "https://example.com" }))).status, 403);
  assert.equal((await api("teacher", request({ action: "list" }, { Authorization: "" }))).status, 401);
  assert.equal((await api("teacher", request({ action: "save", id, scores: [1, 10, 11, 4], feedback: "Observación" }))).status, 422);
});

test("publishing uses the database grade and activity and records failed and successful AGS responses", async () => {
  const timestamp = "2026-12-15T10:00:00Z";
  const grades = [
    { subject: "synthetic1", dispatch: "qa1", score: 89, timestamp },
    { subject: "synthetic2", dispatch: "qa2", score: 89, timestamp },
  ];
  const events = [];
  const api = createTeacherApi({
    origin,
    rpc: async (name, params) => {
      if (name === "psst_lti_finish_review_pilot") { events.push(params); return true; }
      assert.equal(name, "psst_lti_teacher");
      assert.equal(params.p_hash, await digest(session));
      assert.equal(params.p_delivery, id);
      if (params.p_action === "claim") return { grades, lineItem };
      assert.equal(params.p_action, "detail");
      return { id, sync: events };
    },
    getSender: async () => async data => {
      assert.equal(data.lineItemUrl, lineItem);
      assert.equal(data.score, 89);
      assert.equal(data.timestamp, timestamp);
      return data.subject === "synthetic1" ? { sent: true, status: 200 } : { sent: false, status: 503 };
    },
  });
  const response = await api("teacher", request({ action: "publish", id, score: 100, lineItem: "https://other.example" }));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).sync, [
    { p_dispatch: "qa1", p_sent: true, p_http: 200 },
    { p_dispatch: "qa2", p_sent: false, p_http: 503 },
  ]);
});
