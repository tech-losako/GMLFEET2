do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('private.driver_payment_context(text)'::regprocedure);
 if position('''schedule''' in definition)=0 then
  definition:=replace(definition,'''contract_id'',c.id,', $addition$'as_of',(now() at time zone 'Africa/Kinshasa')::date,'phone',(select d.phone from public.drivers d where d.id=c.driver_id),'schedule',(select coalesce(jsonb_agg(jsonb_build_object('due_on',r.due_on,'expected',r.lolc_due+r.gml_due,'paid',coalesce(a.paid,0),'remaining',r.lolc_due+r.gml_due-coalesce(a.paid,0)) order by r.due_on),'[]'::jsonb) from public.repayment_schedules r left join lateral(select sum(amount) paid from public.payment_allocations where schedule_id=r.id) a on true where r.contract_id=c.id),'contract_id',c.id,$addition$);
  execute definition;
 end if;
 definition:=pg_get_functiondef('private.driver_payment_receipt(jsonb)'::regprocedure);
 if position('''lolc_amount''' in definition)=0 then
  definition:=replace(definition,'''amount'',receipt.amount,', $addition$'lolc_amount',receipt.lolc_amount,'gml_amount',receipt.amount-receipt.lolc_amount,'covered_dates',(select coalesce(jsonb_agg(jsonb_build_object('date',s.due_on,'amount',a.amount) order by s.due_on),'[]'::jsonb) from public.payment_allocations a join public.repayment_schedules s on s.id=a.schedule_id where a.payment_id=receipt.id),'amount',receipt.amount,$addition$);
  execute definition;
 end if;
end $migration$;
