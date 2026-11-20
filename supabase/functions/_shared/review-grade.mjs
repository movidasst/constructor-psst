export async function dispatchReviewedPilot({ rpc, sender, activity }) {
  const grade = await rpc("psst_lti_claim_review_pilot", {
    p_resource: activity.resourceId, p_line_item: activity.lineItem,
  });
  if (!grade) return null;

  let result;
  try {
    result = await sender({ lineItemUrl: activity.lineItem, subject: grade.subject,
      score: grade.score, timestamp: grade.timestamp });
  } catch {
    result = { sent: false, phase: "conexion", status: null };
  }

  let recorded = false;
  try {
    recorded = await rpc("psst_lti_finish_review_pilot", {
      p_dispatch: grade.dispatch, p_sent: result.sent, p_http: result.status,
    });
  } catch { /* Sending may have succeeded; never retry automatically. */ }
  return {
    notaDesdeEntrega: recorded ? (result.sent ? "enviada" : "requiere_revision") : "revisar_estado",
    puntos: grade.score,
    fase: result.phase,
    http: result.status,
  };
}
