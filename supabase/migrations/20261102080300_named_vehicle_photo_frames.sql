begin;
do $patch$ declare definition text;marker text:=' for photo in select * from jsonb_array_elements(p->''photos'') loop';begin
 definition:=pg_get_functiondef('private.record_vehicle_condition(jsonb)'::regprocedure);
 if position(marker in definition)=0 then raise exception 'Unexpected vehicle photo validation function';end if;
 definition:=replace(definition,marker,$new$ if exists(select 1 from jsonb_array_elements(p->'photos') x where x ? 'view') then
  if exists(select 1 from jsonb_array_elements(p->'photos') x where coalesce(x->>'view','') not in('front','rear','left','right','interior','boot','engine_bay','dashboard','tyres','damage','spare_accessories','odometer') or (x->>'role') is distinct from case when x->>'view'='odometer' then 'odometer' else 'vehicle' end) then raise exception 'Vue de photo inconnue ou mal classée';end if;
  if exists(select 1 from unnest(array['front','rear','left','right','interior','boot','engine_bay','dashboard']) required(view_key) where not exists(select 1 from jsonb_array_elements(p->'photos') x where x->>'view'=required.view_key)) then raise exception 'Complétez les huit vues obligatoires du véhicule';end if;
  if (select count(distinct x->>'view') from jsonb_array_elements(p->'photos') x)<>jsonb_array_length(p->'photos') then raise exception 'Chaque vue du véhicule doit avoir son propre cadre, sans doublon';end if;
 end if;
$new$||marker);execute definition;
end $patch$;
notify pgrst,'reload schema';
commit;
