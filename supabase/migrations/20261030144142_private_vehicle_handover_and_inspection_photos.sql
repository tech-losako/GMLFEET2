begin;
create table public.vehicle_condition_reports(
 id uuid primary key default gen_random_uuid(),kind text not null check(kind in('handover','inspection')),
 application_id bigint references public.applications(id),vehicle_id bigint references public.vehicles(id),inspection_id uuid unique references public.vehicle_inspections(id),
 observed_on date not null,odometer integer not null check(odometer>=0),photos jsonb not null check(jsonb_typeof(photos)='array' and jsonb_array_length(photos) between 1 and 12),
 created_by uuid not null references public.staff_members(user_id),created_at timestamptz not null default now(),request_id uuid not null unique,command_payload jsonb not null,
 check((kind='handover' and application_id is not null and inspection_id is null) or(kind='inspection' and vehicle_id is not null and inspection_id is not null))
);
create index vehicle_condition_application on public.vehicle_condition_reports(application_id);
create index vehicle_condition_vehicle on public.vehicle_condition_reports(vehicle_id);
create index vehicle_condition_actor on public.vehicle_condition_reports(created_by);
alter table public.vehicle_condition_reports enable row level security;
revoke all on public.vehicle_condition_reports from anon,authenticated;
grant select on public.vehicle_condition_reports to authenticated;
create policy staff_condition_read on public.vehicle_condition_reports for select to authenticated using((select private.is_staff()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('vehicle-condition-photos','vehicle-condition-photos',false,8388608,array['image/jpeg','image/png','image/webp']);
create policy staff_condition_photo_read on storage.objects for select to authenticated using(bucket_id='vehicle-condition-photos' and (select private.is_staff()));
create policy staff_condition_photo_upload on storage.objects for insert to authenticated with check(
 bucket_id='vehicle-condition-photos' and (select private.is_staff()) and name ~ '^(handover|inspection)/[0-9]+/[a-f0-9-]{36}/[a-f0-9-]{36}[.](jpg|png|webp)$' and
 ((split_part(name,'/',1)='handover' and exists(select 1 from public.applications where id::text=split_part(storage.objects.name,'/',2))) or
 (split_part(name,'/',1)='inspection' and exists(select 1 from public.vehicles where id::text=split_part(storage.objects.name,'/',2))))
);
create function private.record_vehicle_condition(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare existing public.vehicle_condition_reports;a public.applications;i public.vehicle_inspections;photo jsonb;prefix text;rid uuid;stamp date;km integer;app bigint;veh bigint;
begin
 if not private.is_staff() then raise exception 'Accès personnel requis';end if;
 if p->>'request_id' is null then raise exception 'Identifiant de relevé requis';end if;
 perform pg_advisory_xact_lock(hashtextextended(p->>'request_id',4));
 select * into existing from public.vehicle_condition_reports where request_id=(p->>'request_id')::uuid;
 if found then if existing.command_payload<>p or existing.created_by<>auth.uid() then raise exception 'Requête de photos réutilisée';end if;return existing.id;end if;
 if p->>'kind'='handover' then
  select * into a from public.applications where id=(p->>'application_id')::bigint;
  if not found or a.review_status<>'accepted' then raise exception 'Dossier accepté requis pour le relevé initial';end if;
  app:=a.id;prefix:='handover/'||app||'/';stamp:=(p->>'observed_on')::date;km:=(p->>'odometer')::integer;
  select id into veh from public.vehicles where owner_application_id=app;
  if veh is null then select vehicle_id into veh from public.contracts where application_id=app and status='active';end if;
 elsif p->>'kind'='inspection' then
  select * into i from public.vehicle_inspections where id=(p->>'inspection_id')::uuid;
  if not found then raise exception 'Contrôle introuvable';end if;
  veh:=i.vehicle_id;stamp:=i.inspected_on;km:=i.odometer;prefix:='inspection/'||veh||'/';
 else raise exception 'Type de relevé invalide';end if;
 if stamp is null or stamp>(now() at time zone 'Africa/Kinshasa')::date or km is null or km<0 then raise exception 'Date réelle et kilométrage positif ou nul requis';end if;
 if jsonb_typeof(p->'photos') is distinct from 'array' or jsonb_array_length(p->'photos') not between 1 and 12 then raise exception 'Ajoutez entre 1 et 12 photos du véhicule';end if;
 if not exists(select 1 from jsonb_array_elements(p->'photos') x where x->>'role'='vehicle') then raise exception 'Ajoutez au moins une photo de l’état du véhicule';end if;
 for photo in select * from jsonb_array_elements(p->'photos') loop
  if coalesce(photo->>'role','') not in('vehicle','odometer') or coalesce(length(photo->>'name'),0) not between 1 and 250 or left(coalesce(photo->>'path',''),length(prefix))<>prefix then raise exception 'Référence de photo invalide';end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='vehicle-condition-photos' and o.name=photo->>'path' and o.owner_id=auth.uid()::text
   and o.metadata->>'mimetype' in('image/jpeg','image/png','image/webp') and (o.metadata->>'size')::bigint between 1 and 8388608
   and (o.metadata->>'size')::bigint=(photo->>'size_bytes')::bigint and o.metadata->>'mimetype'=photo->>'mime_type') then raise exception 'Photo non téléversée ou non autorisée';end if;
 end loop;
 if (select count(distinct x->>'path') from jsonb_array_elements(p->'photos') x)<>jsonb_array_length(p->'photos') then raise exception 'Photo en double';end if;
 insert into public.vehicle_condition_reports(kind,application_id,vehicle_id,inspection_id,observed_on,odometer,photos,created_by,request_id,command_payload)
 values(p->>'kind',app,veh,i.id,stamp,km,p->'photos',auth.uid(),(p->>'request_id')::uuid,p) returning id into rid;
 insert into public.finance_events(actor_id,action,entity_id,details) values(auth.uid(),'vehicle_condition_recorded',rid::text,jsonb_build_object('application_id',app,'vehicle_id',veh,'kind',p->>'kind','odometer',km,'observed_on',stamp,'photo_count',jsonb_array_length(p->'photos')));
 return rid;
end $$;
create function public.record_vehicle_condition(p jsonb) returns uuid language sql security invoker set search_path='' as $$select private.record_vehicle_condition(p);$$;
revoke all on function private.record_vehicle_condition(jsonb),public.record_vehicle_condition(jsonb) from public,anon;
grant execute on function private.record_vehicle_condition(jsonb),public.record_vehicle_condition(jsonb) to authenticated;
-- Attach inspection photos in the same transaction as the inspection itself.
do $patch$ declare definition text;marker text:=' insert into public.finance_events(actor_id,action,entity_id,details) values(auth.uid(),''vehicle_inspected'',result_id::text,p);';begin
 definition:=pg_get_functiondef('private.record_fleet_inspection(jsonb)'::regprocedure);
 if position(marker in definition)=0 then raise exception 'Unexpected inspection function';end if;
 definition:=replace(definition,marker,$new$ if p ? 'photos' then perform private.record_vehicle_condition(jsonb_build_object('kind','inspection','inspection_id',result_id,'photos',p->'photos','request_id',p->>'request_id'));end if;
$new$||marker);execute definition;
end $patch$;
notify pgrst,'reload schema';
commit;
