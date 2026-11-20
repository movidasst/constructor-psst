begin;
set local role service_role;
do $$
declare w uuid := gen_random_uuid(); w2 uuid := gen_random_uuid(); delivered jsonb;
begin
  insert into psst_pilot.workspaces(id,issuer,client_id,deployment_id,context_id,label)
  values (w,'issuer','client','deploy','ctx','Equipo A'),(w2,'issuer','client','deploy','ctx','Equipo B');
  insert into psst_pilot.members(workspace_id,lti_subject) values (w,'alice'),(w2,'bob');
  if public.psst_lti_ticket(repeat('a',64),'issuer','client','deploy','other-course','alice','m1','link-1') then raise exception 'wrong course'; end if;
  if public.psst_lti_ticket(repeat('a',64),'issuer','client','deploy','ctx','unassigned','m1','link-1') then raise exception 'unassigned'; end if;
  if not public.psst_lti_ticket(repeat('a',64),'issuer','client','deploy','ctx','alice','m1','link-1') then raise exception 'ticket'; end if;
  if not public.psst_lti_exchange(repeat('a',64),repeat('b',64)) then raise exception 'exchange'; end if;
  if public.psst_lti_exchange(repeat('a',64),repeat('c',64)) then raise exception 'replay'; end if;
  if public.psst_lti_workspace(repeat('b',64))->>'label' <> 'Equipo A' then raise exception 'wrong team'; end if;
  if public.psst_lti_save_m1(repeat('b',64),0,'{"alcance":{"centro":"Planta","area":"Recepción"}}') <> 1 then raise exception 'save'; end if;
  delivered := public.psst_lti_submit_m1(repeat('b',64),1,gen_random_uuid());
  if (delivered->>'automaticPoints')::integer <> 12 then raise exception 'score'; end if;
  if not public.psst_lti_ticket(repeat('c',64),'issuer','client','deploy','ctx','bob','m2','link-2') then raise exception 'm2 ticket'; end if;
  if not public.psst_lti_exchange(repeat('c',64),repeat('d',64)) then raise exception 'm2 exchange'; end if;
  if public.psst_lti_workspace(repeat('d',64))->>'label' <> 'Equipo B' then raise exception 'team leak'; end if;
  if public.psst_lti_save_m1(repeat('d',64),0,'{}') is not null then raise exception 'cross-module save'; end if;
  if public.psst_lti_submit_m1(repeat('d',64),0,gen_random_uuid()) is not null then raise exception 'cross-module submit'; end if;
  if has_function_privilege('anon','public.psst_lti_workspace(text)','EXECUTE') then raise exception 'public read'; end if;
end $$;
select 'ok' as session_workflow;
rollback;