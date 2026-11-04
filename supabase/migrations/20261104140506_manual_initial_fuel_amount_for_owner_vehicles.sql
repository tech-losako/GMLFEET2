begin;
-- Preserve all onboarding, equipment, revision and advance guards; remove the fixed fuel amount.
do $$declare definition text;begin
 definition:=replace(pg_get_functiondef('private.onboard_owner_vehicle(jsonb)'::regprocedure),chr(13),'');
 if position('declare a public.applications; v bigint; plate_value text;' in definition)=0 or position('''fuel_amount'',70' in definition)=0 or position('''principal'',70' in definition)=0 then raise exception 'Unexpected owner onboarding definition';end if;
 definition:=replace(definition,'declare a public.applications; v bigint; plate_value text;','declare a public.applications; v bigint; plate_value text; fuel_value numeric;');
 definition:=replace(definition,'perform private.validate_case_equipment(a.preparation->''equipment'');',$new$
 fuel_value:=nullif(btrim(p->>'fuel_amount'),'')::numeric;
 if fuel_value is null or fuel_value::text='NaN' or fuel_value<=0 or fuel_value>1000000 or fuel_value<>round(fuel_value,2) then raise exception 'Saisissez le montant réel du carburant en USD : positif, deux décimales maximum (actualisez le formulaire si le champ est absent)';end if;
 perform private.validate_case_equipment(a.preparation->'equipment');$new$);
 definition:=replace(definition,'Référence et date de réception des 70 USD requises','Référence du reçu et date réelle de réception ou d’avance du carburant requises');
 definition:=replace(definition,'''fuel_amount'',70','''fuel_amount'',fuel_value');
 definition:=replace(definition,'''principal'',70','''principal'',fuel_value');
 execute definition;
end $$;
commit;
