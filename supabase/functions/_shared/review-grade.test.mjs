import assert from "node:assert/strict";
import { test } from "node:test";
import { dispatchReviewedPilot } from "./review-grade.mjs";

const activity = { resourceId: "1", lineItem: "https://moodle.example/mod/lti/services.php/154/lineitems/444/lineitem?type_id=1" };
test("diagnostic does not send unless a reviewed delivery is queued", async () => {
  const result = await dispatchReviewedPilot({ activity, rpc: async () => null,
    sender: () => assert.fail("unexpected score write") });
  assert.equal(result, null);
});

test("posts the score from the delivery queue and records Moodle's response", async () => {
  const grade = { subject: "tester", dispatch: "claim", score: 44, timestamp: "2026-11-20T21:45:00Z" };
  const rpc = async (name, parameters) => {
    if (name === "psst_lti_claim_review_pilot") {
      assert.deepEqual(parameters, { p_resource: "1", p_line_item: activity.lineItem });
      return grade;
    }
    assert.equal(name, "psst_lti_finish_review_pilot");
    assert.deepEqual(parameters, { p_dispatch: "claim", p_sent: true, p_http: 200 });
    return true;
  };
  const sender = async request => {
    assert.deepEqual(request, { lineItemUrl: activity.lineItem, subject: "tester", score: 44, timestamp: grade.timestamp });
    return { sent: true, phase: "score", status: 200 };
  };
  assert.deepEqual(await dispatchReviewedPilot({ activity, rpc, sender }),
    { notaDesdeEntrega: "enviada", puntos: 44, fase: "score", http: 200 });
});
