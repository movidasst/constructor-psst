create schema psst_pilot;
revoke all on schema psst_pilot from public, anon, authenticated;
grant usage on schema psst_pilot to service_role;

create table psst_pilot.workspaces (
  id uuid primary key default gen_random_uuid(),
  issuer text not null,
  client_id text not null,
  deployment_id text not null,
  context_id text not null,
  label text not null check (char_length(btrim(label)) between 1 and 200),
  draft jsonb not null default '{}'::jsonb
    check (jsonb_typeof(draft) = 'object' and octet_length(draft::text) <= 262144),
  draft_revision integer not null default 0 check (draft_revision >= 0),
  updated_at timestamptz not null default now()
);

create table psst_pilot.members (
  workspace_id uuid not null references psst_pilot.workspaces(id),
  lti_subject text not null check (btrim(lti_subject) <> ''),
  joined_at timestamptz not null default now(),
  primary key (workspace_id, lti_subject)
);

create table psst_pilot.submissions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references psst_pilot.workspaces(id),
  submitted_by text not null,
  resource_link_id text not null check (btrim(resource_link_id) <> ''),
  draft_revision integer not null,
  request_id uuid not null,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  rubric_version text not null default 'm1-v1',
  checks jsonb not null,
  automatic_points smallint not null check (automatic_points between 0 and 60),
  submitted_at timestamptz not null default now(),
  foreign key (workspace_id, submitted_by) references psst_pilot.members(workspace_id, lti_subject),
  unique (workspace_id, request_id),
  unique (workspace_id, resource_link_id, draft_revision)
);

create table psst_pilot.submission_recipients (
  submission_id uuid not null references psst_pilot.submissions(id),
  lti_subject text not null,
  primary key (submission_id, lti_subject)
);

create table psst_pilot.reviews (
  submission_id uuid primary key references psst_pilot.submissions(id),
  reviewer_subject text not null check (btrim(reviewer_subject) <> ''),
  technical_points smallint not null check (technical_points between 0 and 40),
  feedback text not null check (char_length(btrim(feedback)) between 1 and 4000),
  reviewed_at timestamptz not null default now()
);

create table psst_pilot.grade_outbox (
  submission_id uuid not null references psst_pilot.reviews(submission_id),
  lti_subject text not null,
  score smallint not null check (score between 0 and 100),
  state text not null default 'pending' check (state in ('pending', 'sent', 'retry')),
  attempts integer not null default 0 check (attempts >= 0),
  queued_at timestamptz not null default now(),
  primary key (submission_id, lti_subject),
  foreign key (submission_id, lti_subject) references psst_pilot.submission_recipients(submission_id, lti_subject)
);

alter table psst_pilot.workspaces enable row level security;
alter table psst_pilot.members enable row level security;
alter table psst_pilot.submissions enable row level security;
alter table psst_pilot.submission_recipients enable row level security;
alter table psst_pilot.reviews enable row level security;
alter table psst_pilot.grade_outbox enable row level security;
revoke all on all tables in schema psst_pilot from public, anon, authenticated;
grant select, insert, update on psst_pilot.workspaces to service_role;
grant select, insert on psst_pilot.members, psst_pilot.submissions, psst_pilot.submission_recipients, psst_pilot.reviews to service_role;
grant select, insert, update on psst_pilot.grade_outbox to service_role;

create function psst_pilot.module_one_checks(payload jsonb)
returns jsonb language sql immutable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'alcance', coalesce(
      jsonb_typeof(payload#>'{alcance,centro}') = 'string' and btrim(payload#>>'{alcance,centro}') <> ''
      and jsonb_typeof(payload#>'{alcance,area}') = 'string' and btrim(payload#>>'{alcance,area}') <> '', false),
    'flujo', coalesce(
      jsonb_typeof(payload#>'{flujo,proceso}') = 'string' and btrim(payload#>>'{flujo,proceso}') <> ''
      and jsonb_typeof(payload#>'{flujo,referencia}') = 'string' and btrim(payload#>>'{flujo,referencia}') <> '', false),
    'tarea', coalesce(
      jsonb_typeof(payload#>'{tarea,descripcion}') = 'string' and btrim(payload#>>'{tarea,descripcion}') <> ''
      and jsonb_typeof(payload#>'{tarea,etapa}') = 'string' and btrim(payload#>>'{tarea,etapa}') <> '', false),
    'mesa', coalesce(
      jsonb_typeof(payload#>'{mesa,aportes}') = 'string' and btrim(payload#>>'{mesa,aportes}') <> ''
      and jsonb_typeof(payload#>'{mesa,referencia}') = 'string' and btrim(payload#>>'{mesa,referencia}') <> '', false),
    'bitacora', coalesce(
      jsonb_typeof(payload#>'{bitacora,referencia}') = 'string' and btrim(payload#>>'{bitacora,referencia}') <> ''
      and case when jsonb_typeof(payload#>'{bitacora,horas}') = 'number'
        then (payload#>>'{bitacora,horas}')::numeric >= 8 else false end, false)
  );
$$;

create function psst_pilot.submit_module_one(
  p_workspace uuid, p_subject text, p_resource_link text, p_expected_revision integer, p_request uuid
) returns uuid language plpgsql security invoker set search_path = ''
as $$
declare w psst_pilot.workspaces%rowtype;
        existing uuid;
        result jsonb;
        points smallint;
begin
  select workspace.* into w
  from psst_pilot.workspaces workspace
  join psst_pilot.members member on member.workspace_id = workspace.id
  where workspace.id = p_workspace and member.lti_subject = p_subject
  for update of workspace;
  if not found then raise exception 'Proyecto no disponible para este participante'; end if;

  select id into existing from psst_pilot.submissions
  where workspace_id = p_workspace and request_id = p_request
      and submitted_by = p_subject and resource_link_id = p_resource_link
      and draft_revision = p_expected_revision;
  if found then return existing; end if;
  if w.draft_revision is distinct from p_expected_revision then
    raise exception 'El borrador cambió. Actualiza antes de entregar';
  end if;

  select id into existing from psst_pilot.submissions
  where workspace_id = p_workspace and resource_link_id = p_resource_link and draft_revision = w.draft_revision;
  if found then return existing; end if;

  result := psst_pilot.module_one_checks(w.draft);
  select (count(*) * 12)::smallint into points
  from jsonb_each(result) item where item.value = 'true'::jsonb;

  insert into psst_pilot.submissions
    (workspace_id, submitted_by, resource_link_id, draft_revision, request_id, snapshot, checks, automatic_points)
  values (p_workspace, p_subject, p_resource_link, w.draft_revision, p_request, w.draft, result, points)
  returning id into existing;
  insert into psst_pilot.submission_recipients (submission_id, lti_subject)
  select existing, lti_subject from psst_pilot.members where workspace_id = p_workspace;
  return existing;
end;
$$;

create function psst_pilot.close_module_one_review(
  p_submission uuid, p_reviewer text, p_technical_points smallint, p_feedback text
) returns smallint language plpgsql security invoker set search_path = ''
as $$
declare final_points smallint;
begin
  select automatic_points + p_technical_points into final_points
  from psst_pilot.submissions where id = p_submission;
  if not found then raise exception 'No se encontró la entrega'; end if;

  insert into psst_pilot.reviews (submission_id, reviewer_subject, technical_points, feedback)
  values (p_submission, p_reviewer, p_technical_points, p_feedback)
  on conflict (submission_id) do nothing;
  if not found and not exists (
    select 1 from psst_pilot.reviews where submission_id = p_submission
      and reviewer_subject = p_reviewer and technical_points = p_technical_points and feedback = p_feedback
  ) then raise exception 'La revisión ya fue cerrada'; end if;

  insert into psst_pilot.grade_outbox (submission_id, lti_subject, score)
  select p_submission, lti_subject, final_points from psst_pilot.submission_recipients
  where submission_id = p_submission
  on conflict (submission_id, lti_subject) do nothing;
  return final_points;
end;
$$;

create function psst_pilot.save_draft(
  p_workspace uuid, p_subject text, p_expected_revision integer, p_draft jsonb
) returns integer language plpgsql security invoker set search_path = ''
as $$
declare new_revision integer;
begin
  update psst_pilot.workspaces w
  set draft = p_draft, draft_revision = draft_revision + 1, updated_at = now()
  where w.id = p_workspace and w.draft_revision = p_expected_revision
    and exists (select 1 from psst_pilot.members m
                where m.workspace_id = w.id and m.lti_subject = p_subject)
  returning draft_revision into new_revision;
  if not found then raise exception 'Borrador no disponible o desactualizado'; end if;
  return new_revision;
end;
$$;

revoke all on all functions in schema psst_pilot from public, anon, authenticated;
grant execute on all functions in schema psst_pilot to service_role;
