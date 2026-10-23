begin;
create sequence private.contract_reference_sequence;
revoke all on sequence private.contract_reference_sequence from public,anon,authenticated;
create function private.assign_system_contract_reference() returns trigger language plpgsql security definer set search_path='' as $$
declare reference_number bigint;
begin
 loop
  reference_number:=nextval('private.contract_reference_sequence');
  new.signed_reference:='GMF-CTR-'||extract(year from now() at time zone 'Africa/Kinshasa')::text||'-'||lpad(reference_number::text,greatest(6,length(reference_number::text)),'0');
  exit when not exists(select 1 from public.contracts where signed_reference=new.signed_reference);
 end loop;
 return new;
end $$;
revoke all on function private.assign_system_contract_reference() from public,anon,authenticated;
create trigger a_contract_system_reference before insert on public.contracts for each row execute function private.assign_system_contract_reference();
create unique index contracts_reference_unique on public.contracts(signed_reference);
alter table public.contracts
 add column repayment_count integer not null default 0 check(repayment_count>=0),
 add column repayment_lolc_total numeric(14,2) not null default 0 check(repayment_lolc_total>=0),
 add column repayment_gml_total numeric(14,2) not null default 0 check(repayment_gml_total>=0),
 add column repayment_total numeric(14,2) not null default 0 check(repayment_total=repayment_lolc_total+repayment_gml_total),
 add column vehicle_snapshot jsonb not null default '{}'::jsonb;
with totals as(select contract_id,count(*)::integer n,sum(lolc_due) l,sum(gml_due) g from public.repayment_schedules group by contract_id)
update public.contracts c set repayment_count=t.n,repayment_lolc_total=t.l,repayment_gml_total=t.g,repayment_total=t.l+t.g from totals t where t.contract_id=c.id;

do $patch$
declare definition text; marker text;
begin
 definition:=pg_get_functiondef('private.activate_contract(jsonb)'::regprocedure);
 definition:=replace(definition,'row_count integer;','row_count integer; raw_p jsonb; saved_vehicle jsonb; saved_equipment jsonb;');
 marker:=$old$ if p->>'request_id' is null then raise exception 'Identifiant de requête requis'; end if;$old$;
 if position(marker in definition)=0 then raise exception 'Unexpected activation function';end if;
 definition:=replace(definition,marker,' raw_p:=p;'||chr(10)||marker);
 marker:=$old$ start_day:=(p->>'start_date')::date;$old$;
 definition:=replace(definition,marker,$new$ if a.program_type='DRIVE_TO_OWN' then
  saved_vehicle:=coalesce(a.preparation->'purchased_vehicle','{}'::jsonb);saved_equipment:=coalesce(a.preparation->'equipment','{}'::jsonb);
  if nullif(saved_vehicle->>'model','') is not null then
   if nullif(btrim(p->>'model'),'') is not null and btrim(p->>'model')<>btrim(saved_vehicle->>'model') then raise exception 'Le modèle doit correspondre au véhicule validé dans le dossier';end if;
   p:=p||jsonb_build_object('model',btrim(saved_vehicle->>'model'));
  end if;
  if nullif(saved_vehicle->>'vin','') is not null then
   if nullif(btrim(p->>'vin'),'') is not null and btrim(p->>'vin')<>btrim(saved_vehicle->>'vin') then raise exception 'Le châssis doit correspondre au véhicule validé dans le dossier';end if;
   p:=p||jsonb_build_object('vin',btrim(saved_vehicle->>'vin'));
  end if;
  if nullif(saved_equipment->>'tracker_id','') is not null then
   if nullif(btrim(p->>'tracker_id'),'') is not null and btrim(p->>'tracker_id')<>btrim(saved_equipment->>'tracker_id') then raise exception 'Le tracker doit correspondre à l’installation enregistrée';end if;
   p:=p||jsonb_build_object('tracker_id',btrim(saved_equipment->>'tracker_id'));
  end if;
 end if;
 start_day:=(p->>'start_date')::date;$new$);
 definition:=replace(definition,$old$update public.vehicles set vin=trim(p->>'vin'),tracker_id=trim(p->>'tracker_id'),status='En location',driver=a.name where id=v.id;$old$,$new$update public.vehicles set vin=trim(p->>'vin'),tracker_id=trim(p->>'tracker_id'),status='En location',driver=a.name where id=v.id returning * into v;$new$);
 definition:=replace(definition,$old$values((p->>'request_id')::uuid,p,a.id,$old$,$new$values((p->>'request_id')::uuid,raw_p,a.id,$new$);
 marker:=$old$ insert into public.vehicle_assignments(contract_id,driver_id,vehicle_id,start_date,assigned_by)$old$;
 definition:=replace(definition,marker,$new$ update public.contracts set repayment_count=row_count,repayment_lolc_total=row_count*l,repayment_gml_total=row_count*g,repayment_total=row_count*(l+g),
  vehicle_snapshot=jsonb_build_object('model',v.model,'plate',v.plate,'vin',v.vin,'tracker_id',v.tracker_id,'equipment',coalesce(a.preparation->'equipment','{}'::jsonb)) where id=result_id;
$new$||marker);
 definition:=replace(definition,$old$values(auth.uid(),'contract_activated',result_id::text,p);$old$,$new$values(auth.uid(),'contract_activated',result_id::text,p||jsonb_build_object('signed_reference',(select signed_reference from public.contracts where id=result_id),'repayment_count',row_count,'repayment_lolc_total',row_count*l,'repayment_gml_total',row_count*g,'repayment_total',row_count*(l+g)));$new$);
 execute definition;
 definition:=pg_get_functiondef('private.record_case_step(jsonb)'::regprocedure);
 marker:=$old$coalesce(length(btrim(result_value->>'model')),0)<2 or coalesce(length(btrim(result_value->>'plate')),0)<2 or coalesce(length(btrim(result_value->>'vin')),0)<3$old$;
 if position(marker in definition)=0 then raise exception 'Unexpected vehicle registration validation';end if;
 definition:=replace(definition,marker,$new$coalesce(length(btrim(result_value->>'model')),0)<2 or coalesce(length(btrim(result_value->>'vin')),0)<3$new$);
 definition:=replace(definition,'Modele, plaque et chassis requis','Modèle et châssis requis ; la plaque sera obligatoire à l’activation du contrat');
 execute definition;
end $patch$;
notify pgrst,'reload schema';
commit;
