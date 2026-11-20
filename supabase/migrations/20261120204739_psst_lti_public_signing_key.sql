create table psst_pilot.lti_tool_key (
  singleton boolean primary key default true check (singleton),
  public_jwk jsonb not null,
  vault_id uuid not null,
  created_at timestamptz not null default now()
);
alter table psst_pilot.lti_tool_key enable row level security;
revoke all on psst_pilot.lti_tool_key from public, anon, authenticated;
grant select, insert on psst_pilot.lti_tool_key to service_role;

create function public.psst_lti_public_key()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select public_jwk from psst_pilot.lti_tool_key where singleton;
$$;

create function public.psst_lti_install_key(p_public jsonb, p_private jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare published jsonb; key_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(540077,154);
  select public_jwk into published from psst_pilot.lti_tool_key where singleton;
  if found then return published; end if;

  if p_public->>'kty' is distinct from 'RSA' or p_private->>'kty' is distinct from 'RSA'
     or coalesce(char_length(p_public->>'n'),0) < 342
     or coalesce(p_public->>'n','') !~ '^[A-Za-z0-9_-]+$'
     or p_public->>'e' is distinct from 'AQAB'
     or coalesce(p_public->>'kid','') !~ '^[a-f0-9-]{36}$'
     or p_private->>'n' is distinct from p_public->>'n'
     or p_private->>'e' is distinct from p_public->>'e'
     or coalesce(p_private->>'d','') !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'Par de llaves inválido';
  end if;
  published := jsonb_build_object('kty','RSA','n',p_public->>'n','e','AQAB',
    'kid',p_public->>'kid','alg','RS256','use','sig');
  key_id := vault.create_secret(p_private::text, 'psst_lti_ags_key_v1',
    'Llave de firma LTI del Constructor PSST', null);
  insert into psst_pilot.lti_tool_key(public_jwk,vault_id) values (published,key_id);
  return published;
end;
$$;

revoke execute on function public.psst_lti_public_key(), public.psst_lti_install_key(jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function public.psst_lti_public_key(), public.psst_lti_install_key(jsonb,jsonb)
  to service_role;
