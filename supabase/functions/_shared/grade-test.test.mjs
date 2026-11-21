import assert from "node:assert/strict";
import { test } from "node:test";
import { checkOrDispatchGradeTest } from "./grade-test.mjs";
const activity = { resourceId: "1", lineItem: "https://moodle.example/mod/lti/services.php/154/lineitems/444/lineitem?type_id=1" };

test("no queued test means authorization check only", async () => {
  const sender = () => assert.fail("Unexpected grade request");
  sender.verifyConnection = async () => ({ autorizado: true });
  const result = await checkOrDispatchGradeTest({ activity, sender, rpc: async () => null });
  assert.deepEqual(result, { autorizado: true });
});

test("sends the exact preapproved test score and redacts the subject from the response", async () => {
  const queued = { attempt: "attempt", subject: "test-user", score: 95, timestamp: "2026-11-20T20:42:00.000Z" };
  const sender = async score => {
    assert.deepEqual(score, { lineItemUrl: activity.lineItem, subject: queued.subject, score: queued.score,
      timestamp: queued.timestamp });
    return { sent: true, phase: "score", status: 204 };
  };
  const rpc = async (name, data) => {
    if (name === "psst_lti_claim_grade_test") return queued;
    assert.equal(name, "psst_lti_finish_grade_test");
    assert.deepEqual(data, { p_attempt: queued.attempt, p_sent: true, p_http: 204 });
    return true;
  };
  assert.deepEqual(await checkOrDispatchGradeTest({ activity, sender, rpc }),
    { notaDePrueba: "enviada", fase: "score", http: 204 });
});
