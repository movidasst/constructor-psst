create or replace function public.psst_lti_workspace(p_hash text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'label',w.label,'moduleId',g.module_id,
    'draft',case when g.module_id = 'm1' then w.draft else coalesce(d.draft,'{}'::jsonb) end,
    'revision',case when g.module_id = 'm1' then w.draft_revision else coalesce(d.revision,0) end,
    'delivery',(
      select jsonb_build_object('id',s.id,'automaticPoints',s.automatic_points,
        'revision',s.draft_revision,'submittedAt',s.submitted_at)
      from psst_pilot.submissions s
      where s.workspace_id = w.id and s.resource_link_id = g.resource_link_id
      order by s.submitted_at desc,s.draft_revision desc limit 1
    )
  ) || case when g.module_id='m4' then jsonb_build_object('inputs',coalesce((
    select jsonb_object_agg(m.module_id,jsonb_build_object(
      'data',coalesce(delivered.snapshot, case when m.module_id='m1' then w.draft else saved.draft end, '{}'::jsonb),
      'submittedAt',delivered.submitted_at
    ))
    from (values ('m1'),('m2'),('m3')) m(module_id)
    left join psst_pilot.module_drafts saved on saved.workspace_id=w.id and saved.module_id=m.module_id
    left join lateral (
      select s.snapshot,s.submitted_at
      from psst_pilot.submissions s
      where s.workspace_id=w.id and s.resource_link_id=r.config->'resourceLinks'->>m.module_id
      order by s.submitted_at desc,s.draft_revision desc limit 1
    ) delivered on true
    where r.config->>'contextId'=w.context_id and r.config->>'issuer'=w.issuer
      and r.config->>'clientId'=w.client_id and r.config->>'deploymentId'=w.deployment_id
  ),'{}'::jsonb)) else '{}'::jsonb end
  from psst_pilot.lti_grants g join psst_pilot.workspaces w on w.id = g.workspace_id
  left join psst_pilot.module_drafts d on d.workspace_id = w.id and d.module_id = g.module_id
  left join psst_pilot.lti_registration r on g.module_id='m4' and r.singleton
  where g.token_hash = p_hash and g.kind = 'session' and g.expires_at > now();
$$;
