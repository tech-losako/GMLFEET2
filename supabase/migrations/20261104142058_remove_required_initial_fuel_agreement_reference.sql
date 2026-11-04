begin;
-- Initial owner fuel advances are calculated from the amount and repayment term.
-- Do not invent an approval reference merely to satisfy the former required field.
alter table public.vehicle_advances alter column approval_reference drop not null;
alter table public.vehicle_advances add constraint advances_agreement_other_expenses check(
 (debtor='owner' and kind='fuel') or approval_reference is not null
);
do $$declare definition text;begin
 definition:=replace(pg_get_functiondef('private.onboard_owner_vehicle(jsonb)'::regprocedure),chr(13),'');
 if position('''approval_reference'',p->>''fuel_approval_reference'',' in definition)=0 then raise exception 'Unexpected owner onboarding definition';end if;
 definition:=replace(definition,'''approval_reference'',p->>''fuel_approval_reference'',','');
 execute definition;
 if to_regprocedure('private.queue_contract_sms()') is not null then
  definition:=replace(pg_get_functiondef('private.queue_contract_sms()'::regprocedure),chr(13),'');
  if strpos(definition,'||''. Accord ''||(item->>''approval_reference'')||''.''')>0 then
   definition:=replace(definition,'||''. Accord ''||(item->>''approval_reference'')||''.''',$replacement$||'.'||case when nullif(item->>'approval_reference','') is not null then ' Accord '||(item->>'approval_reference')||'.' else '' end$replacement$);
   execute definition;
  end if;
 end if;
end $$;
commit;


