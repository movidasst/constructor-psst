create table psst_pilot.lti_registration (
  singleton boolean primary key default true check (singleton),
  config jsonb not null check (jsonb_typeof(config) = 'object')
);
alter table psst_pilot.lti_registration enable row level security;
revoke all on psst_pilot.lti_registration from public, anon, authenticated;
grant select on psst_pilot.lti_registration to service_role;

create function public.psst_lti_registration()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select config from psst_pilot.lti_registration where singleton;
$$;
revoke execute on function public.psst_lti_registration() from public, anon, authenticated;
grant execute on function public.psst_lti_registration() to service_role;
