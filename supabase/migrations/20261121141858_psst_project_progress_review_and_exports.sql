alter table psst_pilot.module_drafts add column updated_at timestamptz;
create function psst_pilot.mark_module_draft_updated()
returns trigger language plpgsql set search_path='' as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;
revoke execute on function psst_pilot.mark_module_draft_updated() from public, anon, authenticated;
create trigger mark_module_draft_updated before insert or update on psst_pilot.module_drafts
for each row execute function psst_pilot.mark_module_draft_updated();

create table psst_pilot.teacher_review_drafts (
  submission_id uuid primary key references psst_pilot.submissions(id) on delete cascade,
  scores jsonb not null check (jsonb_typeof(scores)='array' and jsonb_array_length(scores)=4),
  feedback text not null check (char_length(feedback) between 1 and 4000),
  reviewer text not null,
  updated_at timestamptz not null default now()
);
alter table psst_pilot.teacher_review_drafts enable row level security;
revoke all on psst_pilot.teacher_review_drafts from public, anon, authenticated;
grant select, insert, update on psst_pilot.teacher_review_drafts to service_role;

create function public.psst_lti_archive(p_hash text)
returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('label',w.label,'draft',s.snapshot,'inputs',s.integrated_inputs,
    'version',s.draft_revision,'submittedAt',s.submitted_at)
  from psst_pilot.lti_grants g join psst_pilot.workspaces w on w.id=g.workspace_id
  join psst_pilot.submissions s on s.workspace_id=w.id and s.resource_link_id=g.resource_link_id
  join psst_pilot.submission_recipients recipient on recipient.submission_id=s.id and recipient.lti_subject=g.lti_subject
  where g.token_hash=p_hash and g.kind='session' and g.expires_at>now() and g.module_id='m4'
    and s.integrated_inputs is not null
  order by s.draft_revision desc limit 1
$$;
revoke execute on function public.psst_lti_archive(text) from public, anon, authenticated;
grant execute on function public.psst_lti_archive(text) to service_role;

CREATE OR REPLACE FUNCTION public.psst_lti_workspace(p_hash text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'label',w.label,'moduleId',g.module_id,'savedAt',case when g.module_id='m1' and w.draft_revision>0 then w.updated_at else d.updated_at end,
    'projectKey',md5(w.id::text||':'||g.lti_subject),
    'progress',(select jsonb_object_agg(mod.id,jsonb_build_object(
      'revision',case when mod.id='m1' then w.draft_revision else coalesce(saved.revision,0) end,
      'submittedRevision',delivery.draft_revision,'published',coalesce(q.state='sent',false)))
      from (values('m1'),('m2'),('m3'),('m4')) mod(id)
      left join psst_pilot.module_drafts saved on saved.workspace_id=w.id and saved.module_id=mod.id
      left join lateral (select s.id,s.draft_revision from psst_pilot.submissions s
        where s.workspace_id=w.id and s.resource_link_id=r.config->'resourceLinks'->>mod.id
        order by s.draft_revision desc limit 1) delivery on true
      left join psst_pilot.grade_outbox q on q.submission_id=delivery.id and q.lti_subject=g.lti_subject),
    'draft',case when g.module_id = 'm1' then w.draft else coalesce(d.draft,'{}'::jsonb) end,
    'revision',case when g.module_id = 'm1' then w.draft_revision else coalesce(d.revision,0) end,
    'delivery',(
      select jsonb_build_object('id',s.id,'automaticPoints',s.automatic_points,
        'revision',s.draft_revision,'submittedAt',s.submitted_at,'checks',s.checks,'hasArchive',s.integrated_inputs is not null,
        'review',case when q.state='sent' then jsonb_build_object('score',q.score,
          'technicalPoints',review.technical_points,'feedback',review.feedback) end)
      from psst_pilot.submissions s
      left join psst_pilot.grade_outbox q on q.submission_id=s.id and q.lti_subject=g.lti_subject
      left join psst_pilot.reviews review on review.submission_id=s.id
      where s.workspace_id = w.id and s.resource_link_id = g.resource_link_id
      order by s.submitted_at desc,s.draft_revision desc limit 1
    )
  ) || case when g.module_id in ('m2','m3','m4') then jsonb_build_object('inputs',coalesce((
    select jsonb_object_agg(m.module_id,jsonb_build_object(
      'data',coalesce(delivered.snapshot, case when m.module_id='m1' then w.draft else saved.draft end, '{}'::jsonb),
      'submittedAt',delivered.submitted_at
    ))
    from (values ('m1'),('m2'),('m3')) m(module_id)
    left join psst_pilot.module_drafts saved on saved.workspace_id=w.id and saved.module_id=m.module_id
    left join lateral (
      select s.snapshot,s.submitted_at
      from psst_pilot.submissions s
      where s.workspace_id=w.id and s.resource_link_id=r.config->'resourceLinks'->>m.module_id
      order by s.submitted_at desc,s.draft_revision desc limit 1
    ) delivered on true
    where (g.module_id='m4' or (g.module_id='m2' and m.module_id='m1') or (g.module_id='m3' and m.module_id in ('m1','m2')))
      and r.config->>'contextId'=w.context_id and r.config->>'issuer'=w.issuer
      and r.config->>'clientId'=w.client_id and r.config->>'deploymentId'=w.deployment_id
  ),'{}'::jsonb)) else '{}'::jsonb end
  from psst_pilot.lti_grants g join psst_pilot.workspaces w on w.id = g.workspace_id
  left join psst_pilot.module_drafts d on d.workspace_id = w.id and d.module_id = g.module_id
  left join psst_pilot.lti_registration r on r.singleton and r.config->>'contextId'=w.context_id and r.config->>'issuer'=w.issuer and r.config->>'clientId'=w.client_id and r.config->>'deploymentId'=w.deployment_id
  where g.token_hash = p_hash and g.kind = 'session' and g.expires_at > now();
$function$
;

create or replace function public.psst_lti_teacher(p_hash text,p_action text,p_delivery uuid default null,
  p_scores jsonb default null,p_feedback text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare g psst_pilot.teacher_grants%rowtype; s psst_pilot.submissions%rowtype;
  review psst_pilot.reviews%rowtype; points integer; label text; result jsonb; feedback_draft psst_pilot.teacher_review_drafts%rowtype;
begin
  select t.* into g from psst_pilot.teacher_grants t join psst_pilot.lti_registration r on r.singleton
  where t.token_hash=p_hash and t.kind='session' and t.expires_at>now() and r.config->>'teacherEnabled'='true'
    and r.config->>'issuer'=t.issuer and r.config->>'clientId'=t.client_id
    and r.config->>'deploymentId'=t.deployment_id and r.config->>'contextId'=t.context_id
    and r.config->'resourceLinks'->>t.module_id=t.resource_id and r.config->'lineItems'->>t.module_id=t.line_item;
  if not found then return null; end if;
  if p_action='list' then
    return jsonb_build_object('moduleId',g.module_id,'deliveries',coalesce((
      select jsonb_agg(row_data order by submitted_at desc) from (
        select newest.submitted_at,jsonb_build_object('id',newest.id,'label',newest.label,'revision',newest.draft_revision,
          'submittedAt',newest.submitted_at,'automaticPoints',newest.automatic_points,
          'technicalPoints',r.technical_points,'submittedBy',newest.submitted_by,
          'reviewState',case when r.submission_id is not null then
            case when exists(select 1 from psst_pilot.grade_outbox q where q.submission_id=newest.id and q.state<>'sent') then 'pending' else 'sent' end
            when edit.submission_id is not null then 'draft' else 'unreviewed' end) row_data
        from (
          select distinct on (d.workspace_id) d.*,w.label
          from psst_pilot.submissions d join psst_pilot.workspaces w on w.id=d.workspace_id
          where d.resource_link_id=g.resource_id and w.context_id=g.context_id and w.issuer=g.issuer
            and w.client_id=g.client_id and w.deployment_id=g.deployment_id
          order by d.workspace_id,d.submitted_at desc,d.draft_revision desc
        ) newest left join psst_pilot.reviews r on r.submission_id=newest.id
        left join psst_pilot.teacher_review_drafts edit on edit.submission_id=newest.id
      ) a
    ),'[]'::jsonb));
  end if;

  select d.* into s from psst_pilot.submissions d join psst_pilot.workspaces w on w.id=d.workspace_id
  where d.id=p_delivery and d.resource_link_id=g.resource_id and w.context_id=g.context_id
    and w.issuer=g.issuer and w.client_id=g.client_id and w.deployment_id=g.deployment_id
  for update of w;
  if not found then return null; end if;

  if p_action in ('save','claim') and exists (
    select 1 from psst_pilot.submissions newer where newer.workspace_id=s.workspace_id
      and newer.resource_link_id=s.resource_link_id and newer.draft_revision>s.draft_revision
  ) then raise sqlstate '22023' using message='Hay una entrega más reciente en este módulo'; end if;

  select * into review from psst_pilot.reviews where submission_id=s.id;
  if p_action='save' then
    if jsonb_typeof(p_scores) is distinct from 'array' or jsonb_array_length(p_scores)<>4
      or nullif(btrim(p_feedback),'') is null or char_length(btrim(p_feedback))>4000 then
      raise sqlstate '22023' using message='Completa cuatro criterios y la retroalimentación';
    end if;
    if exists (select 1 from jsonb_array_elements(p_scores) value
      where jsonb_typeof(value)<>'number' or value::text !~ '^(10|[0-9])$') then
      raise sqlstate '22023' using message='Cada criterio debe tener entre 0 y 10 puntos';
    end if;
    if review.submission_id is not null then raise sqlstate '22023' using message='La nota ya se cerró para publicación'; end if;
    insert into psst_pilot.teacher_review_drafts(submission_id,scores,feedback,reviewer)
    values(s.id,p_scores,btrim(p_feedback),g.lti_subject)
    on conflict(submission_id) do update set scores=excluded.scores,feedback=excluded.feedback,reviewer=excluded.reviewer,updated_at=now();
  elsif p_action='claim' then
    if review.submission_id is null then
      select * into feedback_draft from psst_pilot.teacher_review_drafts where submission_id=s.id;
      if not found then raise sqlstate '22023' using message='Guarda primero la rúbrica'; end if;
      select sum(value::text::int) into points from jsonb_array_elements(feedback_draft.scores) value;
      perform psst_pilot.close_module_one_review(s.id,g.lti_subject,points::smallint,feedback_draft.feedback);
      update psst_pilot.reviews set rubric_scores=feedback_draft.scores where submission_id=s.id;
    end if;
    with candidates as (
      select q.lti_subject from psst_pilot.grade_outbox q where q.submission_id=s.id and
        (q.state='retry' or (q.state='pending' and (q.dispatch_id is null or q.dispatched_at<now()-interval '2 minutes')))
      order by q.lti_subject limit 8 for update
    ), claimed as (
      update psst_pilot.grade_outbox q set state='pending',dispatch_id=gen_random_uuid(),attempts=attempts+1,
        dispatch_http=null,dispatched_at=now()
      from candidates c where q.submission_id=s.id and q.lti_subject=c.lti_subject
      returning q.lti_subject,q.dispatch_id,q.score,q.queued_at
    )
    select coalesce(jsonb_agg(jsonb_build_object('subject',lti_subject,'dispatch',dispatch_id,'score',score,'timestamp',queued_at)),'[]'::jsonb)
      into result from claimed;
    return jsonb_build_object('lineItem',g.line_item,'grades',result);
  elsif p_action='read_results' then
    return jsonb_build_object('lineItem',g.line_item,'grades',coalesce((
      select jsonb_agg(jsonb_build_object('subject',graded.lti_subject,'score',graded.score)) from (
        select q.lti_subject,q.score from psst_pilot.grade_outbox q
        where q.submission_id=p_delivery and q.state='sent' order by q.lti_subject limit 8
      ) graded
    ),'[]'::jsonb));
  elsif p_action<>'detail' then return null;
  end if;

  select * into feedback_draft from psst_pilot.teacher_review_drafts where submission_id=s.id;
  select w.label into label from psst_pilot.workspaces w where w.id=s.workspace_id;
  return jsonb_build_object('id',s.id,'moduleId',g.module_id,'label',label,'revision',s.draft_revision,
    'submittedAt',s.submitted_at,'automaticPoints',s.automatic_points,'checks',s.checks,
    'snapshot',s.snapshot,'inputs',s.integrated_inputs,'submittedBy',s.submitted_by,
    'reviewDraft',case when review.submission_id is null and feedback_draft.submission_id is not null then
      jsonb_build_object('scores',feedback_draft.scores,'feedback',feedback_draft.feedback,'updatedAt',feedback_draft.updated_at) end,
    'review',case when review.submission_id is not null then jsonb_build_object('scores',review.rubric_scores,
      'technicalPoints',review.technical_points,'feedback',review.feedback,'reviewedAt',review.reviewed_at) end,
    'sync',coalesce((select jsonb_agg(jsonb_build_object('subject',q.lti_subject,'score',q.score,
      'state',q.state,'http',q.dispatch_http)) from psst_pilot.grade_outbox q where q.submission_id=s.id),'[]'::jsonb));
end;
$$;


create table psst_pilot.coaching_quota (
  workspace_id uuid primary key references psst_pilot.workspaces(id) on delete cascade,
  used_on date not null,
  requests smallint not null check(requests between 1 and 6)
);
alter table psst_pilot.coaching_quota enable row level security;
revoke all on psst_pilot.coaching_quota from public, anon, authenticated;
grant select, insert, update on psst_pilot.coaching_quota to service_role;

create function public.psst_lti_coach_quota(p_hash text)
returns boolean language sql security invoker set search_path='' as $$
  with counted as (
    insert into psst_pilot.coaching_quota as quota(workspace_id,used_on,requests)
    select g.workspace_id,current_date,1 from psst_pilot.lti_grants g
    join psst_pilot.workspaces w on w.id=g.workspace_id where w.context_id='154'
      and g.token_hash=p_hash and g.kind='session' and g.expires_at>now()
    on conflict(workspace_id) do update set used_on=current_date,
      requests=case when quota.used_on=current_date then quota.requests+1 else 1 end
      where quota.used_on<>current_date or quota.requests<6
    returning 1
  )
  select exists(select 1 from counted)
$$;
revoke execute on function public.psst_lti_coach_quota(text) from public, anon, authenticated;
grant execute on function public.psst_lti_coach_quota(text) to service_role;
