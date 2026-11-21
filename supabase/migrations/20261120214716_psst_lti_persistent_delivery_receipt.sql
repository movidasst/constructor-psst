create or replace function public.psst_lti_workspace(p_hash text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'label',w.label,'moduleId',g.module_id,'draft',w.draft,'revision',w.draft_revision,
    'delivery',(
      select jsonb_build_object('id',s.id,'automaticPoints',s.automatic_points,
        'revision',s.draft_revision,'submittedAt',s.submitted_at)
      from psst_pilot.submissions s
      where s.workspace_id = w.id and s.resource_link_id = g.resource_link_id
      order by s.submitted_at desc,s.draft_revision desc limit 1
    )
  )
  from psst_pilot.lti_grants g join psst_pilot.workspaces w on w.id = g.workspace_id
  where g.token_hash = p_hash and g.kind = 'session' and g.expires_at > now();
$$;

create or replace function public.psst_lti_submit_m1(p_hash text, p_revision integer, p_request uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare g psst_pilot.lti_grants%rowtype; delivery uuid;
begin
  select * into g from psst_pilot.lti_grants
  where token_hash = p_hash and kind = 'session' and module_id = 'm1' and expires_at > now();
  if not found then return null; end if;
  delivery := psst_pilot.submit_module_one(g.workspace_id,g.lti_subject,g.resource_link_id,p_revision,p_request);
  return (select jsonb_build_object('id',id,'checks',checks,'automaticPoints',automatic_points,
            'revision',draft_revision,'submittedAt',submitted_at)
          from psst_pilot.submissions where id = delivery);
end;
$$;
