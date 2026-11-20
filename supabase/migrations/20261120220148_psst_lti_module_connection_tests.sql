create table psst_pilot.lti_connection_tests (
  module_id text primary key check (module_id in ('m2', 'm3', 'm4')),
  subject text not null check (subject ~ '^[1-9][0-9]{0,17}$'),
  resource_id text not null unique,
  line_item text not null unique,
  score smallint not null check (score between 0 and 100),
  score_timestamp timestamptz not null default now(),
  state text not null default 'queued' check (state in ('queued', 'sending', 'sent', 'failed')),
  attempt uuid unique,
  http_status integer check (http_status between 100 and 599),
  check (state = 'queued' or attempt is not null)
);

alter table psst_pilot.lti_connection_tests enable row level security;
revoke all on psst_pilot.lti_connection_tests from public, anon, authenticated;
grant select, update on psst_pilot.lti_connection_tests to service_role;

create function public.psst_lti_claim_connection_test(p_resource text, p_line_item text)
returns jsonb language sql security invoker set search_path = '' as $$
  update psst_pilot.lti_connection_tests as test
  set state = 'sending', attempt = gen_random_uuid()
  from psst_pilot.lti_registration as registration
  where test.state = 'queued' and test.resource_id = p_resource
    and test.line_item = p_line_item and registration.singleton
    and registration.config->>'contextId' = '154'
    and registration.config->>'diagnostic' = 'true'
    and registration.config#>>'{studentPilot,enabled}' = 'true'
    and registration.config#>>'{studentPilot,subject}' = test.subject
    and registration.config->'resourceLinks'->>test.module_id = p_resource
    and registration.config->'lineItems'->>test.module_id = p_line_item
  returning jsonb_build_object('attempt', test.attempt, 'subject', test.subject,
    'score', test.score, 'timestamp', test.score_timestamp);
$$;

create function public.psst_lti_finish_connection_test(p_attempt uuid, p_sent boolean, p_http integer)
returns boolean language sql security invoker set search_path = '' as $$
  with finished as (
    update psst_pilot.lti_connection_tests
    set state = case when p_sent then 'sent' else 'failed' end, http_status = p_http
    where state = 'sending' and attempt = p_attempt
    returning 1
  )
  select exists(select 1 from finished);
$$;

revoke execute on function public.psst_lti_claim_connection_test(text,text),
  public.psst_lti_finish_connection_test(uuid,boolean,integer) from public, anon, authenticated;
grant execute on function public.psst_lti_claim_connection_test(text,text),
  public.psst_lti_finish_connection_test(uuid,boolean,integer) to service_role;
