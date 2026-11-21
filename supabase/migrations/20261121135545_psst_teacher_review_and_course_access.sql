alter table psst_pilot.reviews add column rubric_scores jsonb
  check (rubric_scores is null or jsonb_typeof(rubric_scores)='array');
alter table psst_pilot.submissions add column integrated_inputs jsonb
  check (integrated_inputs is null or jsonb_typeof(integrated_inputs)='object');

grant update(rubric_scores) on psst_pilot.reviews to service_role;

create table psst_pilot.teacher_grants (
  token_hash text primary key check(token_hash ~ '^[a-f0-9]{64}$'),
  kind text not null check(kind in ('ticket','session')),
  lti_subject text not null check(char_length(lti_subject) between 1 and 200),
  issuer text not null,
  client_id text not null,
  deployment_id text not null,
  context_id text not null,
  module_id text not null check(module_id in ('m1','m2','m3','m4')),
  resource_id text not null,
  line_item text not null,
  expires_at timestamptz not null
);
create index teacher_grants_expiry on psst_pilot.teacher_grants(expires_at);
alter table psst_pilot.teacher_grants enable row level security;
revoke all on psst_pilot.teacher_grants from public, anon, authenticated;
grant select, insert, delete on psst_pilot.teacher_grants to service_role;

create function public.psst_lti_teacher_ticket(p_hash text,p_issuer text,p_client text,p_deployment text,
  p_context text,p_subject text,p_module text,p_resource text,p_line_item text)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
  delete from psst_pilot.teacher_grants where expires_at<=now();
  insert into psst_pilot.teacher_grants
  select p_hash,'ticket',p_subject,p_issuer,p_client,p_deployment,p_context,p_module,p_resource,p_line_item,now()+interval '90 seconds'
  from psst_pilot.lti_registration r where r.singleton and r.config->>'teacherEnabled'='true'
    and r.config->>'issuer'=p_issuer and r.config->>'clientId'=p_client and r.config->>'deploymentId'=p_deployment
    and r.config->>'contextId'=p_context and p_context='154'
    and r.config->'resourceLinks'->>p_module=p_resource and r.config->'lineItems'->>p_module=p_line_item;
  return found;
end;
$$;

create function public.psst_lti_teacher_exchange(p_ticket_hash text,p_session_hash text)
returns boolean language sql security invoker set search_path='' as $$
  with taken as (
    delete from psst_pilot.teacher_grants where token_hash=p_ticket_hash and kind='ticket' and expires_at>now()
    returning lti_subject,issuer,client_id,deployment_id,context_id,module_id,resource_id,line_item
  ), started as (
    insert into psst_pilot.teacher_grants
    select p_session_hash,'session',lti_subject,issuer,client_id,deployment_id,context_id,module_id,resource_id,line_item,
      now()+interval '2 hours' from taken returning 1
  )
  select exists(select 1 from started);
$$;

create function public.psst_lti_enroll(p_hash text,p_issuer text,p_client text,p_deployment text,
  p_context text,p_subject text,p_module text,p_resource text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare w uuid;
begin
  if char_length(p_subject) not between 1 and 200 or not exists(
    select 1 from psst_pilot.lti_registration r where r.singleton and r.config->>'enrollmentEnabled'='true'
      and r.config->>'issuer'=p_issuer and r.config->>'clientId'=p_client and r.config->>'deploymentId'=p_deployment
      and r.config->>'contextId'=p_context and p_context='154' and r.config->'resourceLinks'->>p_module=p_resource
  ) then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_context||':'||p_subject,0));
  if not exists(
    select 1 from psst_pilot.workspaces wk join psst_pilot.members m on m.workspace_id=wk.id
    where wk.issuer=p_issuer and wk.client_id=p_client and wk.deployment_id=p_deployment
      and wk.context_id=p_context and m.lti_subject=p_subject
  ) then
    insert into psst_pilot.workspaces(issuer,client_id,deployment_id,context_id,label)
    values(p_issuer,p_client,p_deployment,p_context,'Proyecto · Moodle '||left(p_subject,150)) returning id into w;
    insert into psst_pilot.members(workspace_id,lti_subject) values(w,p_subject);
  end if;
  return public.psst_lti_ticket(p_hash,p_issuer,p_client,p_deployment,p_context,p_subject,p_module,p_resource);
end;
$$;

create function psst_pilot.capture_submission_inputs()
returns trigger language plpgsql security invoker set search_path='' as $$
declare config jsonb;
begin
  select r.config into config from psst_pilot.lti_registration r join psst_pilot.workspaces w on w.id=new.workspace_id
  where r.singleton and w.context_id=r.config->>'contextId' and w.issuer=r.config->>'issuer'
    and w.client_id=r.config->>'clientId' and w.deployment_id=r.config->>'deploymentId';
  if config#>>'{resourceLinks,m4}'=new.resource_link_id then
    select coalesce(jsonb_object_agg(m.module_id,jsonb_build_object(
      'data',coalesce(previous.snapshot,case when m.module_id='m1' then w.draft else d.draft end,'{}'::jsonb),
      'submittedAt',previous.submitted_at
    )),'{}'::jsonb) into new.integrated_inputs
    from psst_pilot.workspaces w cross join (values ('m1'),('m2'),('m3')) m(module_id)
    left join psst_pilot.module_drafts d on d.workspace_id=w.id and d.module_id=m.module_id
    left join lateral (
      select s.snapshot,s.submitted_at from psst_pilot.submissions s
      where s.workspace_id=w.id and s.resource_link_id=config->'resourceLinks'->>m.module_id
      order by s.submitted_at desc,s.draft_revision desc limit 1
    ) previous on true where w.id=new.workspace_id;
  end if;
  return new;
end;
$$;
revoke execute on function psst_pilot.capture_submission_inputs() from public, anon, authenticated;
create trigger capture_submission_inputs before insert on psst_pilot.submissions
for each row execute function psst_pilot.capture_submission_inputs();

create function public.psst_lti_teacher(p_hash text,p_action text,p_delivery uuid default null,
  p_scores jsonb default null,p_feedback text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare g psst_pilot.teacher_grants%rowtype; s psst_pilot.submissions%rowtype;
  review psst_pilot.reviews%rowtype; points integer; label text; result jsonb;
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
          'technicalPoints',r.technical_points,'submittedBy',newest.submitted_by) row_data
        from (
          select distinct on (d.workspace_id) d.*,w.label
          from psst_pilot.submissions d join psst_pilot.workspaces w on w.id=d.workspace_id
          where d.resource_link_id=g.resource_id and w.context_id=g.context_id and w.issuer=g.issuer
            and w.client_id=g.client_id and w.deployment_id=g.deployment_id
          order by d.workspace_id,d.submitted_at desc,d.draft_revision desc
        ) newest left join psst_pilot.reviews r on r.submission_id=newest.id
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
    if review.submission_id is not null and (review.rubric_scores is distinct from p_scores or review.feedback is distinct from btrim(p_feedback))
      then raise sqlstate '22023' using message='Ya existe una revisión cerrada para esta versión'; end if;
    if review.submission_id is null then
      select sum(value::text::int) into points from jsonb_array_elements(p_scores) value;
      perform psst_pilot.close_module_one_review(s.id,g.lti_subject,points::smallint,btrim(p_feedback));
      update psst_pilot.reviews set rubric_scores=p_scores where submission_id=s.id;
      select * into review from psst_pilot.reviews where submission_id=s.id;
    end if;
  elsif p_action='claim' then
    if review.submission_id is null then raise sqlstate '22023' using message='Guarda primero la rúbrica'; end if;
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
  elsif p_action<>'detail' then return null;
  end if;

  select w.label into label from psst_pilot.workspaces w where w.id=s.workspace_id;
  return jsonb_build_object('id',s.id,'moduleId',g.module_id,'label',label,'revision',s.draft_revision,
    'submittedAt',s.submitted_at,'automaticPoints',s.automatic_points,'checks',s.checks,
    'snapshot',s.snapshot,'inputs',s.integrated_inputs,'submittedBy',s.submitted_by,
    'review',case when review.submission_id is not null then jsonb_build_object('scores',review.rubric_scores,
      'technicalPoints',review.technical_points,'feedback',review.feedback,'reviewedAt',review.reviewed_at) end,
    'sync',coalesce((select jsonb_agg(jsonb_build_object('subject',q.lti_subject,'score',q.score,
      'state',q.state,'http',q.dispatch_http)) from psst_pilot.grade_outbox q where q.submission_id=s.id),'[]'::jsonb));
end;
$$;

revoke execute on function public.psst_lti_teacher_ticket(text,text,text,text,text,text,text,text,text),
 public.psst_lti_teacher_exchange(text,text), public.psst_lti_enroll(text,text,text,text,text,text,text,text),
 public.psst_lti_teacher(text,text,uuid,jsonb,text) from public, anon, authenticated;
grant execute on function public.psst_lti_teacher_ticket(text,text,text,text,text,text,text,text,text),
 public.psst_lti_teacher_exchange(text,text), public.psst_lti_enroll(text,text,text,text,text,text,text,text),
 public.psst_lti_teacher(text,text,uuid,jsonb,text) to service_role;

CREATE OR REPLACE FUNCTION public.psst_lti_workspace(p_hash text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'label',w.label,'moduleId',g.module_id,
    'draft',case when g.module_id = 'm1' then w.draft else coalesce(d.draft,'{}'::jsonb) end,
    'revision',case when g.module_id = 'm1' then w.draft_revision else coalesce(d.revision,0) end,
    'delivery',(
      select jsonb_build_object('id',s.id,'automaticPoints',s.automatic_points,
        'revision',s.draft_revision,'submittedAt',s.submitted_at,
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
    where (g.module_id='m4' or (g.module_id='m2' and m.module_id='m1') or (g.module_id='m3' and m.module_id='m2'))
      and r.config->>'contextId'=w.context_id and r.config->>'issuer'=w.issuer
      and r.config->>'clientId'=w.client_id and r.config->>'deploymentId'=w.deployment_id
  ),'{}'::jsonb)) else '{}'::jsonb end
  from psst_pilot.lti_grants g join psst_pilot.workspaces w on w.id = g.workspace_id
  left join psst_pilot.module_drafts d on d.workspace_id = w.id and d.module_id = g.module_id
  left join psst_pilot.lti_registration r on g.module_id in ('m2','m3','m4') and r.singleton
  where g.token_hash = p_hash and g.kind = 'session' and g.expires_at > now();
$function$
;
