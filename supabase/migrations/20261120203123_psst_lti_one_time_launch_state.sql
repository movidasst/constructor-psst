create table psst_pilot.lti_login_states (
  state_hash text primary key check (state_hash ~ '^[a-f0-9]{64}$'),
  browser_hash text not null check (browser_hash ~ '^[a-f0-9]{64}$'),
  nonce text not null check (nonce ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null default now() + interval '5 minutes'
);
create index lti_login_states_expires_at_idx on psst_pilot.lti_login_states (expires_at);
alter table psst_pilot.lti_login_states enable row level security;
revoke all on psst_pilot.lti_login_states from public, anon, authenticated;
grant select, insert, delete on psst_pilot.lti_login_states to service_role;

create function public.psst_lti_begin(p_state_hash text, p_browser_hash text, p_nonce text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  delete from psst_pilot.lti_login_states where expires_at <= now();
  insert into psst_pilot.lti_login_states (state_hash, browser_hash, nonce)
    values (p_state_hash, p_browser_hash, p_nonce);
end;
$$;

create function public.psst_lti_consume(p_state_hash text, p_browser_hash text, p_nonce text)
returns boolean language sql security invoker set search_path = '' as $$
  with used as (
    delete from psst_pilot.lti_login_states
    where state_hash = p_state_hash and browser_hash = p_browser_hash
      and nonce = p_nonce and expires_at > now()
    returning 1
  )
  select exists(select 1 from used);
$$;

revoke execute on function public.psst_lti_begin(text,text,text) from public, anon, authenticated;
revoke execute on function public.psst_lti_consume(text,text,text) from public, anon, authenticated;
grant execute on function public.psst_lti_begin(text,text,text) to service_role;
grant execute on function public.psst_lti_consume(text,text,text) to service_role;
