begin;
insert into psst_pilot.lti_grade_test(subject,resource_id,line_item,score)
select '99999999',config#>>'{resourceLinks,m1}',config#>>'{lineItems,m1}',95
from psst_pilot.lti_registration where singleton;
set local role service_role;
do $$
declare x jsonb; m1 text; m2 text;
begin
  select config#>>'{lineItems,m1}',config#>>'{lineItems,m2}' into m1,m2 from psst_pilot.lti_registration where singleton;
  if public.psst_lti_claim_grade_test('2',m2) is not null then raise exception 'wrong module'; end if;
  x := public.psst_lti_claim_grade_test('1',m1);
  if x is null or x->>'subject' <> '99999999' or x->>'score' <> '95' then raise exception 'wrong recipient'; end if;
  if public.psst_lti_claim_grade_test('1',m1) is not null then raise exception 'duplicate attempt'; end if;
  if not public.psst_lti_finish_grade_test((x->>'attempt')::uuid,true,204) then raise exception 'could not close'; end if;
  if has_function_privilege('authenticated','public.psst_lti_claim_grade_test(text,text)','EXECUTE') then raise exception 'public trigger'; end if;
end $$;
select 'ok' as restricted_grade_test;
rollback;