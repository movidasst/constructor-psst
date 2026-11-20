create or replace function public.psst_lti_save_activity(p_hash text, p_revision integer, p_draft jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare g psst_pilot.lti_grants%rowtype; next_revision integer;
begin
  select * into g from psst_pilot.lti_grants
  where token_hash = p_hash and kind = 'session' and expires_at > now();
  if not found then return null; end if;
  if g.module_id = 'm1' then
    return public.psst_lti_save_m1(p_hash,p_revision,p_draft);
  end if;
  if g.module_id not in ('m2','m3','m4') then return null; end if;
  insert into psst_pilot.module_drafts (workspace_id,module_id)
  values (g.workspace_id,g.module_id) on conflict do nothing;
  update psst_pilot.module_drafts d set draft = p_draft, revision = d.revision + 1
  where d.workspace_id = g.workspace_id and d.module_id = g.module_id and d.revision = p_revision
  returning d.revision into next_revision;
  if not found then raise exception 'El borrador cambió'; end if;
  return next_revision;
end;
$$;

create or replace function public.psst_lti_submit_activity(p_hash text, p_revision integer, p_request uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare g psst_pilot.lti_grants%rowtype; d psst_pilot.module_drafts%rowtype;
  delivery uuid; assessed jsonb; points smallint; fields text[];
begin
  select * into g from psst_pilot.lti_grants
  where token_hash = p_hash and kind = 'session' and expires_at > now();
  if not found then return null; end if;
  if g.module_id = 'm1' then
    return public.psst_lti_submit_m1(p_hash,p_revision,p_request);
  end if;
  if g.module_id not in ('m2','m3','m4') then return null; end if;

  select * into d from psst_pilot.module_drafts
  where workspace_id = g.workspace_id and module_id = g.module_id for update;
  if not found then raise sqlstate '22023' using message = 'Guarda el borrador antes de entregar'; end if;
  select s.id into delivery from psst_pilot.submissions s
  where s.workspace_id = g.workspace_id and s.resource_link_id = g.resource_link_id
    and s.request_id = p_request and s.submitted_by = g.lti_subject and s.draft_revision = p_revision;
  if delivery is null and d.revision is distinct from p_revision then raise exception 'El borrador cambió'; end if;
  if delivery is null then
    select s.id into delivery from psst_pilot.submissions s
    where s.workspace_id = g.workspace_id and s.resource_link_id = g.resource_link_id
      and s.draft_revision = p_revision;
  end if;
  if delivery is null then
    fields := case g.module_id
      when 'm2' then array['etapa','matriz','procesos','pendientes','evidencia']
      when 'm3' then array['planes','gantt','responsables','recursos','seguimiento']
      when 'm4' then array['borrador','brechas','evidencia','validacion','pendientes']
    end;
    assessed := (
      select jsonb_object_agg(field,
        coalesce(jsonb_typeof(d.draft->g.module_id->field) = 'string'
          and btrim(d.draft->g.module_id->>field) <> '',false))
      from unnest(fields) as field
    );
    if not (assessed->>fields[1])::boolean or not (assessed->>fields[2])::boolean then
      raise sqlstate '22023' using message = 'Completa los dos campos obligatorios del módulo';
    end if;
    select (count(*) * 12)::smallint into points
    from jsonb_each(assessed) as check_item where check_item.value = 'true'::jsonb;
    insert into psst_pilot.submissions
      (workspace_id,submitted_by,resource_link_id,draft_revision,request_id,snapshot,rubric_version,checks,automatic_points)
    values (g.workspace_id,g.lti_subject,g.resource_link_id,d.revision,p_request,d.draft,g.module_id || '-pilot-v1',assessed,points)
    returning id into delivery;
    insert into psst_pilot.submission_recipients (submission_id,lti_subject)
    select delivery,lti_subject from psst_pilot.members where workspace_id = g.workspace_id;
  end if;
  return (select jsonb_build_object('id',id,'checks',checks,'automaticPoints',automatic_points,
            'revision',draft_revision,'submittedAt',submitted_at)
          from psst_pilot.submissions where id = delivery);
end;
$$;

