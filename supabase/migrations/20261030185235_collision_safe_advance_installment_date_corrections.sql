begin;
-- Advance installments have their own unique date key. Move them transactionally
-- through unused dates before assigning the recalculated dates, just like the base schedule.
do $patch$ declare definition text;marker text:=' update public.advance_instalments ai set due_on=x.day from unnest(ids,new_dates) x(id,day) where ai.schedule_id=x.id;';begin
 definition:=pg_get_functiondef('private.correct_contract_start_date(jsonb)'::regprocedure);
 if position(marker in definition)=0 then raise exception 'Unexpected date correction function';end if;
 definition:=replace(definition,marker,$new$ update public.advance_instalments ai set due_on='0001-01-01'::date+x.ordinality::integer from unnest(ids) with ordinality x(id,ordinality) where ai.schedule_id=x.id;
$new$||marker);execute definition;
end $patch$;
notify pgrst,'reload schema';
commit;
