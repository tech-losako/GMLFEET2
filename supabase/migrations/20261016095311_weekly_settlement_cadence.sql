alter table public.contracts add column payment_frequency text not null default 'daily' check(payment_frequency in ('daily','weekly'));
comment on column public.contracts.payment_frequency is 'Settlement cadence; weekly amounts are due Sunday and overdue Monday. Daily allocation rows are unchanged.';
do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('private.driver_payment_context(text)'::regprocedure);
 if position('filter(where r.due_on<=' in definition)=0 then raise exception 'Unexpected payment context definition';end if;
 definition:=replace(definition,'filter(where r.due_on<=','filter(where (case when c.payment_frequency=''weekly'' then (date_trunc(''week'',r.due_on::timestamp)::date+6) else r.due_on end)<=');
 definition:=replace(definition,'''daily_amount'',c.daily_lolc+c.daily_gml','''payment_frequency'',c.payment_frequency,''daily_amount'',c.daily_lolc+c.daily_gml');
 execute definition;
end $migration$;
notify pgrst,'reload schema';
