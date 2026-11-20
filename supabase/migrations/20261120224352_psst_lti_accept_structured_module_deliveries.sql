create or replace function public.psst_lti_submit_activity(p_hash text, p_revision integer, p_request uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare g psst_pilot.lti_grants%rowtype; d psst_pilot.module_drafts%rowtype;
  delivery uuid; assessed jsonb; points smallint; fields text[]; module_draft jsonb; rows jsonb; structured_checks jsonb;
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
    module_draft := d.draft->g.module_id;
    rows := case when jsonb_typeof(module_draft->'filas')='array' then module_draft->'filas' else '[]'::jsonb end;
    structured_checks := case g.module_id
      when 'm2' then (
        select jsonb_build_object(
          'matriz',coalesce(bool_or(r.ct_complete),false),
          'procesos',coalesce(bool_or(r.ct_complete),false),
          'pendientes',coalesce(bool_or(r.ct_complete and nullif(btrim(r.entry->>'pendiente'),'') is not null),false),
          'evidencia',coalesce(bool_or(r.ct_complete and nullif(btrim(r.entry->>'evidencia'),'') is not null),false))
        from (
          select entry, not exists (
            select 1 from unnest(array['etapa','peligro','riesgo']) k
            where not coalesce(jsonb_typeof(entry->k)='string' and btrim(entry->>k)<>'',false)
          ) as ct_complete
          from jsonb_array_elements(rows) entry
        ) r
      )
      when 'm3' then (
        select jsonb_build_object(
          'planes',coalesce(bool_or(r.complete),false),
          'gantt',coalesce(bool_or(r.complete),false),
          'responsables',coalesce(bool_or(r.complete),false),
          'recursos',coalesce(bool_or(r.complete and nullif(btrim(r.entry->>'recursos'),'') is not null),false),
          'seguimiento',coalesce(bool_or(r.complete and nullif(btrim(r.entry->>'seguimiento'),'') is not null),false))
        from (
          select entry,
            nullif(btrim(entry->>'plan'),'') is not null
            and nullif(btrim(entry->>'actividad'),'') is not null
            and nullif(btrim(entry->>'responsable'),'') is not null
            and case when entry->>'inicio' ~ '^(1[0-2]|[1-9])$' and entry->>'fin' ~ '^(1[0-2]|[1-9])$'
              then (entry->>'inicio')::int <= (entry->>'fin')::int else false end as complete
          from jsonb_array_elements(rows) entry
        ) r
      )
      when 'm4' then jsonb_build_object(
        'borrador', exists (
          select 1 from generate_series(1,8) c
          where jsonb_typeof(module_draft->('cap'||c))='string' and btrim(module_draft->>('cap'||c))<>''
        ),
        'brechas', (nullif(btrim(module_draft->>'resultado'),'') is not null or exists (
          select 1 from jsonb_array_elements(rows) entry
          where jsonb_typeof(entry->'brecha')='string' and btrim(entry->>'brecha')<>''
        ))
      )
    end;
    assessed := (
      select jsonb_object_agg(field,
        coalesce(jsonb_typeof(module_draft->field) = 'string' and btrim(module_draft->>field) <> '',false)
        or coalesce((structured_checks->>field)::boolean,false))
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

