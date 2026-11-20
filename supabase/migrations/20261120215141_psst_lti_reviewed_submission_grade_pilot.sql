alter table psst_pilot.grade_outbox
  add column dispatch_id uuid,
  add column dispatch_http integer check (dispatch_http between 100 and 599),
  add column dispatched_at timestamptz;

create function public.psst_lti_claim_review_pilot(p_resource text, p_line_item text)
returns jsonb language sql security invoker set search_path = '' as $$
  update psst_pilot.grade_outbox q
  set dispatch_id = gen_random_uuid(), attempts = q.attempts + 1
  from psst_pilot.submissions s
  join psst_pilot.workspaces w on w.id = s.workspace_id
  join psst_pilot.lti_registration r on r.singleton
  where q.submission_id = s.id and s.resource_link_id = p_resource
    and q.state = 'pending' and q.dispatch_id is null
    and r.config->>'diagnostic' = 'true' and r.config->>'contextId' = '154'
    and w.context_id = r.config->>'contextId' and w.issuer = r.config->>'issuer'
    and w.client_id = r.config->>'clientId' and w.deployment_id = r.config->>'deploymentId'
    and r.config#>>'{resourceLinks,m1}' = p_resource and r.config#>>'{lineItems,m1}' = p_line_item
    and r.config#>>'{studentPilot,enabled}' = 'true'
    and q.lti_subject = r.config#>>'{studentPilot,subject}'
    and q.lti_subject = s.submitted_by and s.id::text = r.config->>'pilotReviewSubmission'
  returning jsonb_build_object('dispatch',q.dispatch_id,'subject',q.lti_subject,
                              'score',q.score,'timestamp',q.queued_at);
$$;

create function public.psst_lti_finish_review_pilot(p_dispatch uuid, p_sent boolean, p_http integer)
returns boolean language sql security invoker set search_path = '' as $$
  with result as (
    update psst_pilot.grade_outbox
    set state = case when p_sent then 'sent' else 'retry' end,
        dispatch_http = p_http, dispatched_at = now()
    where dispatch_id = p_dispatch and state = 'pending'
    returning 1
  )
  select exists(select 1 from result);
$$;

revoke execute on function public.psst_lti_claim_review_pilot(text,text),
  public.psst_lti_finish_review_pilot(uuid,boolean,integer) from public, anon, authenticated;
grant execute on function public.psst_lti_claim_review_pilot(text,text),
  public.psst_lti_finish_review_pilot(uuid,boolean,integer) to service_role;
