create or replace function public.psst_lti_submit_activity(p_hash text, p_revision integer, p_request uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare g psst_pilot.lti_grants%rowtype; d psst_pilot.module_drafts%rowtype;
  delivery uuid; assessed jsonb; points smallint; fields text[]; module_draft jsonb; rows jsonb; structured_checks jsonb; plans jsonb; source_rows jsonb; source_data jsonb;
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
    if g.module_id in ('m2','m3') then
      source_data := public.psst_lti_workspace(p_hash)->'inputs';
      source_rows := case g.module_id when 'm2' then source_data#>'{m1,data,tarea,actividades}'
                                     else source_data#>'{m2,data,m2,filas}' end;
      source_rows := case when jsonb_typeof(source_rows)='array' then source_rows else '[]'::jsonb end;
      if g.module_id='m2' and exists (
        select 1 from jsonb_array_elements(rows) item
        where nullif(item->>'tareaRef','') is not null and not exists (
          select 1 from jsonb_array_elements(source_rows) task where task->>'id'=item->>'tareaRef'
        )
      ) then raise sqlstate '22023' using message='Una referencia de tarea ya no está disponible'; end if;
    end if;
    plans:=case when jsonb_typeof(module_draft->'planesDetallados')='array'
      then module_draft->'planesDetallados' else '[]'::jsonb end;
    if g.module_id='m3' and jsonb_array_length(plans)>0 and exists (
      select 1 from jsonb_array_elements(plans) plan
      where exists (
        select 1 from unnest(array['codigo','nombre','familia','objetivo','meta','alcance','frecuencia',
          'responsable','procedimiento','instrumentos','recursos','seguimiento']) k
        where not coalesce(jsonb_typeof(plan->k)='string' and btrim(plan->>k)<>'',false)
      ) or (nullif(plan->>'riesgoRef','') is not null and not exists (
        select 1 from jsonb_array_elements(source_rows) risk where risk->>'id'=plan->>'riesgoRef'
      )) or exists (
        select 1 from jsonb_array_elements_text(
          case when jsonb_typeof(plan->'riesgoRefs')='array' then plan->'riesgoRefs' else '[]'::jsonb end
        ) ref(id)
        where not exists (select 1 from jsonb_array_elements(source_rows) risk where risk->>'id'=ref.id)
      )
    ) then raise sqlstate '22023' using message='Completa y vincula las fichas de los planes'; end if;
    if g.module_id='m3' and exists (
      select 1 from jsonb_array_elements(rows) activity
      where (nullif(activity->>'planRef','') is not null and not exists (
        select 1 from jsonb_array_elements(plans) plan where plan->>'id'=activity->>'planRef'
      )) or (nullif(activity->>'riesgoRef','') is not null and not exists (
        select 1 from jsonb_array_elements(source_rows) risk where risk->>'id'=activity->>'riesgoRef'
      ))
    ) then raise sqlstate '22023' using message='Revisa las referencias de las actividades'; end if;
    if g.module_id='m3' and exists (
      select 1 from jsonb_array_elements(rows) activity
      where nullif(btrim(activity->>'actividad'),'') is not null
        and not psst_pilot.valid_plan_schedule(activity)
    ) then raise sqlstate '22023' using message='Completa las fechas previstas de las actividades'; end if;
    if g.module_id='m4' then
      source_data := public.psst_lti_workspace(p_hash)->'inputs';
      if exists (
        select 1 from generate_series(1,8) ch(num)
        where not (
          exists (select 1 from jsonb_each(coalesce(module_draft,'{}'::jsonb)) section(key,value)
            where section.key ~ ('^cap'||ch.num||'(_[a-z_]+)?$') and jsonb_typeof(section.value)='string'
              and btrim(section.value#>>'{}')<>'' and strpos(section.value#>>'{}','[Completar]')=0)
          or case ch.num
            when 3 then coalesce(jsonb_array_length(source_data#>'{m1,data,flujo,procesos}'),0)>0
              and coalesce(jsonb_array_length(source_data#>'{m2,data,m2,filas}'),0)>0
            when 4 then coalesce(jsonb_array_length(source_data#>'{m3,data,m3,planesDetallados}'),0)>0
              and exists (select 1 from jsonb_array_elements(coalesce(source_data#>'{m3,data,m3,filas}','[]'::jsonb)) task
                where psst_pilot.valid_plan_schedule(task))
            when 6 then nullif(btrim(module_draft->>'compromiso'),'') is not null
            when 7 then coalesce(jsonb_array_length(module_draft->'contratistas'),0)>0
            when 8 then coalesce(jsonb_array_length(module_draft->'indicadores'),0)>0
            else false end
        )
      ) then raise sqlstate '22023' using message='Desarrolla o referencia los ocho capítulos antes de entregar'; end if;
    end if;
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
            (nullif(btrim(entry->>'plan'),'') is not null or exists (
              select 1 from jsonb_array_elements(plans) plan where plan->>'id'=entry->>'planRef'
            ))
            and nullif(btrim(entry->>'actividad'),'') is not null
            and nullif(btrim(entry->>'responsable'),'') is not null
            and psst_pilot.valid_plan_schedule(entry) as complete
          from jsonb_array_elements(rows) entry
        ) r
      )
      when 'm4' then jsonb_build_object(
        'borrador', exists (
          select 1 from jsonb_each(case when jsonb_typeof(module_draft)='object'
            then module_draft else '{}'::jsonb end) as entry(key,value)
          where entry.key ~ '^cap[1-8](_[a-z_]+)?$'
            and jsonb_typeof(entry.value)='string' and btrim(entry.value#>>'{}')<>'' and strpos(entry.value#>>'{}','[Completar]')=0
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

