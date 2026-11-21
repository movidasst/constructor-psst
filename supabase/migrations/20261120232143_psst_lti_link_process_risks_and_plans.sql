alter table psst_pilot.module_drafts
  drop constraint module_drafts_draft_check,
  add constraint module_drafts_draft_check check (jsonb_typeof(draft)='object' and octet_length(draft::text)<=262144);

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
  ) || case when g.module_id in ('m2','m3','m4') then jsonb_build_object('inputs',coalesce((
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
    where (g.module_id='m4' or (g.module_id='m2' and m.module_id='m1') or (g.module_id='m3' and m.module_id='m2'))
      and r.config->>'contextId'=w.context_id and r.config->>'issuer'=w.issuer
      and r.config->>'clientId'=w.client_id and r.config->>'deploymentId'=w.deployment_id
  ),'{}'::jsonb)) else '{}'::jsonb end
  from psst_pilot.lti_grants g join psst_pilot.workspaces w on w.id = g.workspace_id
  left join psst_pilot.module_drafts d on d.workspace_id = w.id and d.module_id = g.module_id
  left join psst_pilot.lti_registration r on g.module_id in ('m2','m3','m4') and r.singleton
  where g.token_hash = p_hash and g.kind = 'session' and g.expires_at > now();
$$;

CREATE OR REPLACE FUNCTION psst_pilot.module_one_checks(payload jsonb)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'alcance', coalesce(
      jsonb_typeof(payload#>'{alcance,centro}') = 'string' and btrim(payload#>>'{alcance,centro}') <> ''
      and jsonb_typeof(payload#>'{alcance,area}') = 'string' and btrim(payload#>>'{alcance,area}') <> '', false),
    'flujo', coalesce(
      jsonb_typeof(payload#>'{flujo,proceso}') = 'string' and btrim(payload#>>'{flujo,proceso}') <> ''
      and jsonb_typeof(payload#>'{flujo,referencia}') = 'string' and btrim(payload#>>'{flujo,referencia}') <> '', false)
      or exists (
        select 1 from jsonb_array_elements(case when jsonb_typeof(payload#>'{flujo,procesos}')='array' then payload#>'{flujo,procesos}' else '[]'::jsonb end) p
        where nullif(btrim(p->>'nombre'),'') is not null and nullif(btrim(p->>'evidencia'),'') is not null
      ),
    'tarea', coalesce(
      jsonb_typeof(payload#>'{tarea,descripcion}') = 'string' and btrim(payload#>>'{tarea,descripcion}') <> ''
      and jsonb_typeof(payload#>'{tarea,etapa}') = 'string' and btrim(payload#>>'{tarea,etapa}') <> '', false)
      or exists (
        select 1 from jsonb_array_elements(case when jsonb_typeof(payload#>'{tarea,actividades}')='array' then payload#>'{tarea,actividades}' else '[]'::jsonb end) t
        join jsonb_array_elements(case when jsonb_typeof(payload#>'{flujo,procesos}')='array' then payload#>'{flujo,procesos}' else '[]'::jsonb end) p
          on p->>'id'=t->>'procesoRef'
        where nullif(btrim(t->>'nombre'),'') is not null and nullif(btrim(t->>'etapa'),'') is not null
          and nullif(btrim(t->>'descripcion'),'') is not null
      ),
    'mesa', coalesce(
      jsonb_typeof(payload#>'{mesa,aportes}') = 'string' and btrim(payload#>>'{mesa,aportes}') <> ''
      and jsonb_typeof(payload#>'{mesa,referencia}') = 'string' and btrim(payload#>>'{mesa,referencia}') <> '', false),
    'bitacora', coalesce(
      jsonb_typeof(payload#>'{bitacora,referencia}') = 'string' and btrim(payload#>>'{bitacora,referencia}') <> ''
      and case when jsonb_typeof(payload#>'{bitacora,horas}') = 'number'
        then (payload#>>'{bitacora,horas}')::numeric >= 8 else false end, false)
  );
$function$;

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
      ))
    ) then raise sqlstate '22023' using message='Completa y vincula las fichas de los planes'; end if;
    if g.module_id='m3' and exists (
      select 1 from jsonb_array_elements(rows) activity
      where (nullif(activity->>'planRef','') is not null and not exists (
        select 1 from jsonb_array_elements(plans) plan where plan->>'id'=activity->>'planRef'
      )) or (nullif(activity->>'riesgoRef','') is not null and not exists (
        select 1 from jsonb_array_elements(source_rows) risk where risk->>'id'=activity->>'riesgoRef'
      ))
    ) then raise sqlstate '22023' using message='Revisa las referencias de las actividades'; end if;
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

