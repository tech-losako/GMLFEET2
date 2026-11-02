begin;
do $patch$ declare definition text;marker text;begin
 definition:=pg_get_functiondef('private.edit_client_information(jsonb)'::regprocedure);
 marker:='updated public.applications;';if position(marker in definition)=0 then raise exception 'Unexpected client information function';end if;
 definition:=replace(definition,marker,marker||' deposit_value numeric;');
 marker:=' update public.applications set name=btrim';if position(marker in definition)=0 then raise exception 'Unexpected profile update';end if;
 definition:=replace(definition,marker,$new$ if p ? 'initialDeposit' then
  if a.program_type<>'DRIVE_TO_OWN' then raise exception 'L’apport initial concerne uniquement Car na ngai';end if;
  deposit_value:=nullif(btrim(p->>'initialDeposit'),'')::numeric;
  if deposit_value is not null and (deposit_value::text='NaN' or deposit_value<0 or deposit_value>1000000 or deposit_value<>round(deposit_value,2)) then raise exception 'Apport initial USD invalide : montant positif ou nul, deux décimales maximum';end if;
  if deposit_value is null then d:=d-'initialDeposit';else d:=jsonb_set(d,'{initialDeposit}',to_jsonb(to_char(deposit_value,'FM999999990.00')||' USD'));end if;
 end if;
$new$||marker);execute definition;
 definition:=pg_get_functiondef('private.guard_final_client_information()'::regprocedure);
 marker:=' (new.service_details->''idNumber'') is distinct from (old.service_details->''idNumber'')';
 if position(marker in definition)=0 then raise exception 'Unexpected final client information guard';end if;
 definition:=replace(definition,marker,' (new.service_details->''initialDeposit'') is distinct from (old.service_details->''initialDeposit'') or'||marker);execute definition;
end $patch$;
notify pgrst,'reload schema';
commit;
