create or replace function public.psst_lti_claim_review_pilot(p_resource text, p_line_item text)
returns jsonb language sql security invoker set search_path = '' as $$
  update psst_pilot.grade_outbox q
  set dispatch_id = gen_random_uuid(), attempts = q.attempts + 1
  from psst_pilot.submissions s
  join psst_pilot.workspaces w on w.id = s.workspace_id
  join psst_pilot.lti_registration r on r.singleton
  cross join lateral jsonb_each_text(r.config->'resourceLinks') as resource(module_id, resource_id)
  where q.submission_id = s.id and s.resource_link_id = p_resource
    and q.state = 'pending' and q.dispatch_id is null
    and r.config->>'diagnostic' = 'true' and r.config->>'contextId' = '154'
    and w.context_id = r.config->>'contextId' and w.issuer = r.config->>'issuer'
    and w.client_id = r.config->>'clientId' and w.deployment_id = r.config->>'deploymentId'
    and resource.module_id in ('m1','m2','m3','m4')
    and resource.resource_id = p_resource
    and r.config->'lineItems'->>resource.module_id = p_line_item
    and r.config#>>'{studentPilot,enabled}' = 'true'
    and q.lti_subject = r.config#>>'{studentPilot,subject}'
    and q.lti_subject = s.submitted_by
    and s.id::text = coalesce(
      r.config->'pilotReviewSubmissions'->>resource.module_id,
      case when resource.module_id = 'm1' then r.config->>'pilotReviewSubmission' end
    )
  returning jsonb_build_object('dispatch',q.dispatch_id,'subject',q.lti_subject,
                              'score',q.score,'timestamp',q.queued_at);
$$;
