alter table psst_pilot.lti_login_states
  add column browser_challenge text check (browser_challenge ~ '^[a-f0-9]{64}$');

create table psst_pilot.lti_ticket_bindings (
  ticket_hash text primary key check (ticket_hash ~ '^[a-f0-9]{64}$'),
  browser_challenge text not null check (browser_challenge ~ '^[a-f0-9]{64}$'),
  teacher boolean not null,
  expires_at timestamptz not null default now()+interval '90 seconds'
);
alter table psst_pilot.lti_ticket_bindings enable row level security;
revoke all on psst_pilot.lti_ticket_bindings from public, anon, authenticated;
grant select,insert,delete on psst_pilot.lti_ticket_bindings to service_role;

create function public.psst_lti_begin_bound(p_state_hash text,p_browser_hash text,p_nonce text,p_challenge text)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if p_challenge is null or p_challenge !~ '^[a-f0-9]{64}$' then raise sqlstate '22023'; end if;
  delete from psst_pilot.lti_login_states where expires_at<=now();
  insert into psst_pilot.lti_login_states(state_hash,browser_hash,nonce,browser_challenge)
    values(p_state_hash,p_browser_hash,p_nonce,p_challenge);
end
$$;

create function public.psst_lti_consume_bound(p_state_hash text,p_browser_hash text,p_nonce text)
returns text language sql security invoker set search_path='' as $$
  with used as (
    delete from psst_pilot.lti_login_states
    where state_hash=p_state_hash and browser_hash=p_browser_hash and nonce=p_nonce
      and expires_at>now() and browser_challenge is not null
    returning browser_challenge
  )
  select browser_challenge from used
$$;

create function public.psst_lti_issue_bound(p_hash text,p_challenge text,p_issuer text,p_client text,p_deployment text,
  p_context text,p_subject text,p_module text,p_resource text,p_teacher boolean,p_enroll boolean,p_line_item text default null)
returns boolean language plpgsql security invoker set search_path='' as $$
declare allowed boolean;
begin
  if p_challenge is null or p_challenge !~ '^[a-f0-9]{64}$' then return false; end if;
  allowed:=case
    when p_teacher then public.psst_lti_teacher_ticket(p_hash,p_issuer,p_client,p_deployment,p_context,p_subject,p_module,p_resource,p_line_item)
    when p_enroll then public.psst_lti_enroll(p_hash,p_issuer,p_client,p_deployment,p_context,p_subject,p_module,p_resource)
    else public.psst_lti_ticket(p_hash,p_issuer,p_client,p_deployment,p_context,p_subject,p_module,p_resource)
  end;
  if allowed is distinct from true then return false; end if;
  delete from psst_pilot.lti_ticket_bindings where expires_at<=now();
  insert into psst_pilot.lti_ticket_bindings(ticket_hash,browser_challenge,teacher) values(p_hash,p_challenge,p_teacher);
  return true;
end
$$;

create function public.psst_lti_exchange_bound(p_ticket_hash text,p_challenge text,p_session_hash text,p_teacher boolean)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
  delete from psst_pilot.lti_ticket_bindings
    where ticket_hash=p_ticket_hash and browser_challenge=p_challenge and teacher=p_teacher and expires_at>now();
  if not found then return false; end if;
  if p_teacher then return public.psst_lti_teacher_exchange(p_ticket_hash,p_session_hash); end if;
  return public.psst_lti_exchange(p_ticket_hash,p_session_hash);
end
$$;

revoke execute on function public.psst_lti_begin_bound(text,text,text,text),
  public.psst_lti_consume_bound(text,text,text),
  public.psst_lti_issue_bound(text,text,text,text,text,text,text,text,text,boolean,boolean,text),
  public.psst_lti_exchange_bound(text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.psst_lti_begin_bound(text,text,text,text),
  public.psst_lti_consume_bound(text,text,text),
  public.psst_lti_issue_bound(text,text,text,text,text,text,text,text,text,boolean,boolean,text),
  public.psst_lti_exchange_bound(text,text,text,boolean) to service_role;
