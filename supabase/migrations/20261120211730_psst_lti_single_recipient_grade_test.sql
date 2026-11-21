create table psst_pilot.lti_grade_test (
  singleton boolean primary key default true check (singleton),
  subject text not null check (subject ~ '^[1-9][0-9]{0,17}$'),
  resource_id text not null,
  line_item text not null,
  score smallint not null check (score between 0 and 100),
  score_timestamp timestamptz not null default now(),
  state text not null default 'queued' check (state in ('queued','sending','sent','failed')),
  attempt uuid,
  attempted_at timestamptz,
  http_status integer check (http_status between 100 and 599),
  check (state = 'queued' or attempt is not null)
);
alter table psst_pilot.lti_grade_test enable row level security;
revoke all on psst_pilot.lti_grade_test from public, anon, authenticated;
grant select, update on psst_pilot.lti_grade_test to service_role;

create function public.psst_lti_claim_grade_test(p_resource text, p_line_item text)
returns jsonb language sql security invoker set search_path = '' as $$
  update psst_pilot.lti_grade_test
  set state = 'sending', attempt = gen_random_uuid(), attempted_at = now()
  where singleton and state = 'queued' and resource_id = p_resource and line_item = p_line_item
    and exists (
      select 1 from psst_pilot.lti_registration
      where singleton and config->>'contextId' = '154'
        and config->>'diagnostic' = 'true'
        and config#>>'{resourceLinks,m1}' = p_resource
        and config#>>'{lineItems,m1}' = p_line_item
    )
  returning jsonb_build_object('attempt', attempt, 'subject',subject,
    'score',score, 'timestamp',score_timestamp);
$$;

create function public.psst_lti_finish_grade_test(p_attempt uuid, p_sent boolean, p_http integer)
returns boolean language sql security invoker set search_path = '' as $$
  with finished as (
    update psst_pilot.lti_grade_test
    set state = case when p_sent then 'sent' else 'failed' end, http_status = p_http
    where singleton and state = 'sending' and attempt = p_attempt
    returning 1
  )
  select exists(select 1 from finished);
$$;

revoke execute on function public.psst_lti_claim_grade_test(text,text),
  public.psst_lti_finish_grade_test(uuid,boolean,integer) from public, anon, authenticated;
grant execute on function public.psst_lti_claim_grade_test(text,text),
  public.psst_lti_finish_grade_test(uuid,boolean,integer) to service_role;
