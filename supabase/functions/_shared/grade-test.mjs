// Call only after a signed staff launch matches the registered activity and line item.
export async function checkOrDispatchGradeTest({ rpc, sender, activity, connectionTest = false }) {
  const testType = connectionTest ? "connection_test" : "grade_test";
  const test = await rpc("psst_lti_claim_" + testType, {
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
    const saved = await rpc("psst_lti_finish_" + testType,
      { p_attempt: test.attempt, p_sent: result.sent, p_http: result.status });
    if (!saved) return { notaDePrueba: "revisar_estado", fase: result.phase, http: result.status };
  } catch {
    return { notaDePrueba: "revisar_estado", fase: result.phase, http: result.status };
  }
  return { notaDePrueba: result.sent ? "enviada" : "requiere_revision", fase: result.phase, http: result.status };
}
