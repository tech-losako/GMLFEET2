begin;
do $patch$declare definition text;marker text;begin
 definition:=pg_get_functiondef('private.edit_client_information(jsonb)'::regprocedure);
 marker:='updated public.applications;';if position(marker in definition)=0 then raise exception 'Unexpected client editor';end if;
 definition:=replace(definition,marker,marker||' legal_key text;');
 marker:=' update public.applications set name=btrim';if position(marker in definition)=0 then raise exception 'Unexpected client editor update';end if;
 definition:=replace(definition,marker,$new$
 foreach legal_key in array array['birthPlace','nationality','licenseCategory','addressNumber','addressAvenue','addressQuarter','addressCommune','carBrand','carYear'] loop
  if p ? legal_key then
   if length(coalesce(p->>legal_key,''))>120 then raise exception 'Champ contractuel trop long : %',legal_key;end if;
   d:=d||jsonb_build_object(legal_key,nullif(btrim(p->>legal_key),''));
  end if;
 end loop;
 d:=d||jsonb_build_object('birthDate',nullif(p->>'birth_date',''));
$new$||marker);execute definition;
 definition:=pg_get_functiondef('private.guard_final_client_information()'::regprocedure);
 marker:=' (new.service_details->''idNumber'') is distinct from (old.service_details->''idNumber'')';if position(marker in definition)=0 then raise exception 'Unexpected final identity guard';end if;
 definition:=replace(definition,marker,$new$
 row(new.service_details->'birthPlace',new.service_details->'birthDate',new.service_details->'nationality',new.service_details->'licenseCategory',new.service_details->'addressNumber',new.service_details->'addressAvenue',new.service_details->'addressQuarter',new.service_details->'addressCommune',new.service_details->'carBrand',new.service_details->'carYear') is distinct from
 row(old.service_details->'birthPlace',old.service_details->'birthDate',old.service_details->'nationality',old.service_details->'licenseCategory',old.service_details->'addressNumber',old.service_details->'addressAvenue',old.service_details->'addressQuarter',old.service_details->'addressCommune',old.service_details->'carBrand',old.service_details->'carYear') or
$new$||marker);execute definition;
 definition:=pg_get_functiondef('private.complete_public_submission(uuid)'::regprocedure);
 marker:='service_details,license_file_name,source)';if position(marker in definition)=0 then raise exception 'Unexpected public intake insert';end if;
 definition:=replace(definition,marker,'service_details,license_file_name,source,birth_date)');
 marker:='a->>''license_file_name'',''website'')';if position(marker in definition)=0 then raise exception 'Unexpected public intake values';end if;
 definition:=replace(definition,marker,'a->>''license_file_name'',''website'',nullif(a->>''birth_date'','''')::date)');execute definition;
end $patch$;
notify pgrst,'reload schema';
commit;


