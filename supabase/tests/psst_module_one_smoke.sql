begin;
set local role service_role;
do $test$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  request uuid := gen_random_uuid(); delivery uuid; original uuid; points smallint;
  data jsonb := '{"alcance":{"centro":"Caso ficticio","area":"Recepción"},"flujo":{"proceso":"Ingreso","referencia":"E01"},"tarea":{"descripcion":"Registrar mercancía","etapa":"Ingreso"},"mesa":{"aportes":"Turnos diferentes","referencia":"E02"},"bitacora":{"referencia":"E03","horas":8}}';
begin
  insert into psst_pilot.workspaces(id, issuer, client_id, deployment_id, context_id, label)
    values (a, 'https://moodle.example', 'test', 'test', 'course-test', 'Equipo A'),
           (b, 'https://moodle.example', 'test', 'test', 'course-test', 'Equipo B');
  insert into psst_pilot.members(workspace_id, lti_subject)
    values (a,'alice'),(a,'eva'),(b,'bob');
  if psst_pilot.save_draft(a,'alice',0,data) <> 1 then raise exception 'Revisión incorrecta'; end if;
  begin
    perform psst_pilot.save_draft(a,'bob',1,data);
    raise exception 'Se aceptó una edición de otro equipo';
  exception when raise_exception then
    if sqlerrm <> 'Borrador no disponible o desactualizado' then raise; end if;
  end;
  original := psst_pilot.submit_module_one(a,'alice','module-1',1,request);
  delivery := psst_pilot.submit_module_one(a,'alice','module-1',1,request);
  if original <> delivery then raise exception 'Entrega duplicada'; end if;
  if exists(select 1 from psst_pilot.grade_outbox where submission_id = delivery)
    then raise exception 'La nota se puso en cola antes de revisar'; end if;
  if (select automatic_points from psst_pilot.submissions where id = delivery) <> 60
    then raise exception 'Puntuación automática incorrecta'; end if;
  if psst_pilot.module_one_checks('{"bitacora":{"referencia":"E","horas":"ocho"}}')->>'bitacora' <> 'false'
    then raise exception 'Se aceptaron horas inválidas'; end if;
  perform psst_pilot.save_draft(a,'alice',1,'{}'::jsonb);
  if (select snapshot from psst_pilot.submissions where id = delivery) <> data
    then raise exception 'La entrega cambió con el borrador'; end if;
  points := psst_pilot.close_module_one_review(delivery,'teacher',35::smallint,'Caso de prueba');
  if points <> 95 then raise exception 'Nota final incorrecta'; end if;
  perform psst_pilot.close_module_one_review(delivery,'teacher',35::smallint,'Caso de prueba');
  if (select count(*) from psst_pilot.grade_outbox where submission_id = delivery and score = 95 and state = 'pending') <> 2
    then raise exception 'Cola por integrante incorrecta'; end if;
  if exists(select 1 from psst_pilot.grade_outbox where submission_id = delivery and lti_subject = 'bob')
    then raise exception 'Se encoló la nota para otro equipo'; end if;
end
$test$;
reset role;
select 'ok' as pilot_workflow,
  not has_schema_privilege('anon', 'psst_pilot', 'USAGE') as anon_blocked,
  not has_schema_privilege('authenticated', 'psst_pilot', 'USAGE') as direct_student_api_blocked;
rollback;
