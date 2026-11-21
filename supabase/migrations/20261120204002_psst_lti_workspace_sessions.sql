create table psst_pilot.lti_grants (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  kind text not null check (kind in ('ticket','session')),
  workspace_id uuid not null,
  lti_subject text not null,
  module_id text not null check (module_id in ('m1','m2','m3','m4')),
  resource_link_id text not null check (btrim(resource_link_id) <> ''),
  expires_at timestamptz not null,
  foreign key (workspace_id,lti_subject) references psst_pilot.members(workspace_id,lti_subject)
    on delete cascade
);
create index lti_grants_expiry_idx on psst_pilot.lti_grants(expires_at);
alter table psst_pilot.lti_grants enable row level security;
revoke all on psst_pilot.lti_grants from public, anon, authenticated;
grant select, insert, delete on psst_pilot.lti_grants to service_role;

create function public.psst_lti_ticket(
  p_hash text, p_issuer text, p_client text, p_deployment text, p_context text,
  p_subject text, p_module text, p_resource text
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare w uuid;
begin
  delete from psst_pilot.lti_grants where expires_at <= now();
  select workspace.id into strict w
  from psst_pilot.workspaces workspace join psst_pilot.members member on member.workspace_id = workspace.id
  where workspace.issuer = p_issuer and workspace.client_id = p_client
    and workspace.deployment_id = p_deployment and workspace.context_id = p_context
    and member.lti_subject = p_subject;
  insert into psst_pilot.lti_grants (token_hash,kind,workspace_id,lti_subject,module_id,resource_link_id,expires_at)
    values (p_hash,'ticket',w,p_subject,p_module,p_resource,now() + interval '90 seconds');
  return true;
exception when no_data_found or too_many_rows then
  return false;
end;
$$;

create function public.psst_lti_exchange(p_ticket_hash text, p_session_hash text)
returns boolean language sql security invoker set search_path = '' as $$
  with taken as (
    delete from psst_pilot.lti_grants where token_hash = p_ticket_hash and kind = 'ticket' and expires_at > now()
    returning workspace_id,lti_subject,module_id,resource_link_id
  ), new_session as (
    insert into psst_pilot.lti_grants (token_hash,kind,workspace_id,lti_subject,module_id,resource_link_id,expires_at)
    select p_session_hash,'session',workspace_id,lti_subject,module_id,resource_link_id,now() + interval '2 hours'
      from taken returning 1
  )
  select exists(select 1 from new_session);
$$;

create function public.psst_lti_workspace(p_hash text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('label',w.label,'moduleId',g.module_id,'draft',w.draft,'revision',w.draft_revision)
  from psst_pilot.lti_grants g join psst_pilot.workspaces w on w.id = g.workspace_id
  where g.token_hash = p_hash and g.kind = 'session' and g.expires_at > now();
$$;

create function public.psst_lti_save_m1(p_hash text, p_revision integer, p_draft jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare g psst_pilot.lti_grants%rowtype;
begin
  select * into g from psst_pilot.lti_grants
  where token_hash = p_hash and kind = 'session' and module_id = 'm1' and expires_at > now();
  if not found then return null; end if;
  return psst_pilot.save_draft(g.workspace_id,g.lti_subject,p_revision,p_draft);
end;
$$;

create function public.psst_lti_submit_m1(p_hash text, p_revision integer, p_request uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare g psst_pilot.lti_grants%rowtype; delivery uuid;
begin
  select * into g from psst_pilot.lti_grants
  where token_hash = p_hash and kind = 'session' and module_id = 'm1' and expires_at > now();
  if not found then return null; end if;
  delivery := psst_pilot.submit_module_one(g.workspace_id,g.lti_subject,g.resource_link_id,p_revision,p_request);
  return (select jsonb_build_object('id',id,'checks',checks,'automaticPoints',automatic_points)
          from psst_pilot.submissions where id = delivery);
end;
$$;

revoke execute on function public.psst_lti_ticket(text,text,text,text,text,text,text,text),
  public.psst_lti_exchange(text,text), public.psst_lti_workspace(text),
  public.psst_lti_save_m1(text,integer,jsonb), public.psst_lti_submit_m1(text,integer,uuid)
  from public, anon, authenticated;
grant execute on function public.psst_lti_ticket(text,text,text,text,text,text,text,text),
  public.psst_lti_exchange(text,text), public.psst_lti_workspace(text),
  public.psst_lti_save_m1(text,integer,jsonb), public.psst_lti_submit_m1(text,integer,uuid)
  to service_role;
