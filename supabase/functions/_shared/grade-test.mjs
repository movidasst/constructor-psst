// Call only after a signed staff launch matches the registered M1 activity and line item.
export async function checkOrDispatchGradeTest({ rpc, sender, activity }) {
  const test = await rpc("psst_lti_claim_grade_test", {
    p_resource: activity.resourceId, p_line_item: activity.lineItem,
  });
  if (!test) return sender.verifyConnection();

  let result;
  try {
    result = await sender({ lineItemUrl: activity.lineItem, subject: test.subject,
      score: test.score, timestamp: test.timestamp });
  } catch {
    result = { sent: false, phase: "conexion", status: null };
  }

  try {
    const saved = await rpc("psst_lti_finish_grade_test",
      { p_attempt: test.attempt, p_sent: result.sent, p_http: result.status });
    if (!saved) return { notaDePrueba: "revisar_estado", fase: result.phase, http: result.status };
  } catch {
    return { notaDePrueba: "revisar_estado", fase: result.phase, http: result.status };
  }
  return { notaDePrueba: result.sent ? "enviada" : "requiere_revision", fase: result.phase, http: result.status };
}
