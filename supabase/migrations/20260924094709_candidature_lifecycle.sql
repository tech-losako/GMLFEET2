begin;
-- Preserve historical contracts; all unprocessed and future dossiers use the new lifecycle.
alter table public.applications
 add column review_status text not null default 'pending' check(review_status in ('pending','accepted','rejected')),
 add column review_reason text,
 add column reviewed_at timestamptz,
 add column reviewed_by uuid references public.staff_members(user_id),
 add column process_step text not null default 'review',
 add column lifecycle_version integer not null default 2;
update public.applications set review_status=case when workflow_stage in ('rejected','withdrawn') then 'rejected' when workflow_stage not in ('new','to_contact','contacted','screening') then 'accepted' else 'pending' end,
 process_step=case when workflow_stage='handed_over' then 'handover' else 'review' end,
 lifecycle_version=case when workflow_stage='handed_over' or exists(select 1 from public.contracts c where c.application_id=applications.id) then 1 else 2 end;
create index applications_review_queue_idx on public.applications(review_status,program_type,created_at desc);
create index applications_reviewer_idx on public.applications(reviewed_by);
alter table public.appointments add column purpose text not null default 'meeting' check(purpose in ('meeting','account','driving_test','vehicle_inspection','handover','installation'));
alter table public.vehicles add column owner_application_id bigint references public.applications(id);
create unique index vehicles_owner_application_idx on public.vehicles(owner_application_id) where owner_application_id is not null;

create table public.operations_notifications (
 id bigint generated always as identity primary key,
 application_id bigint not null references public.applications(id),
 appointment_id uuid references public.appointments(id),
 kind text not null check(kind in ('intake','accepted','rejected','appointment')),
 channel text not null check(channel in ('internal','sms_draft')),
 recipient text, body text not null,
 status text not null default 'draft' check(status in ('unread','read','draft')),
 created_at timestamptz not null default now(),
 unique(application_id,kind,appointment_id)
);
create index operations_notifications_application_idx on public.operations_notifications(application_id,created_at desc);
create index operations_notifications_appointment_idx on public.operations_notifications(appointment_id);
alter table public.operations_notifications enable row level security;
revoke all on public.operations_notifications from anon,authenticated;
grant select on public.operations_notifications to authenticated;
create policy staff_read on public.operations_notifications for select to authenticated using ((select private.is_staff()));

create function private.case_notifications() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='applications' then
  if tg_op='INSERT' then
   insert into public.operations_notifications(application_id,kind,channel,status,body) values(new.id,'intake','internal','unread','Nouvelle candidature : '||new.name||'. Documents à examiner.');
  elsif new.review_status is distinct from old.review_status and new.review_status in ('accepted','rejected') then
   insert into public.operations_notifications(application_id,kind,channel,recipient,body) values(new.id,new.review_status,'sms_draft',new.phone,
    case when new.review_status='accepted' then 'Bonjour '||new.name||', GML a retenu votre dossier. '||case when new.program_type='YANGO' then 'Vous pouvez maintenant demander votre rattachement à GM Fleet dans Yango. Notre équipe vous accompagne et confirme votre intégration.' else 'Notre équipe vous contactera pour convenir de votre rendez-vous. Cette validation du dossier ne vaut pas accord de financement.' end
    else 'Bonjour '||new.name||', votre candidature n’a pas été retenue par GML. Contactez notre équipe pour plus d’informations.' end);
  end if;
 else
  insert into public.operations_notifications(application_id,appointment_id,kind,channel,recipient,body)
   select a.id,new.id,'appointment','sms_draft',a.phone,
   'Bonjour '||a.name||', votre rendez-vous GML est prévu le '||to_char(new.starts_at at time zone 'Africa/Kinshasa','DD/MM/YYYY à HH24:MI')||' (Kinshasa), à '||new.location||'. '||new.instructions
   from public.applications a where a.id=new.application_id;
 end if;
 return new;
end $$;
revoke all on function private.case_notifications() from public,anon,authenticated;
create trigger lifecycle_notifications after insert or update on public.applications for each row execute function private.case_notifications();
create trigger appointment_notifications after insert on public.appointments for each row execute function private.case_notifications();
insert into public.operations_notifications(application_id,kind,channel,status,body)
 select id,'intake','internal','unread','Candidature à examiner : '||name from public.applications where review_status='pending';

-- Guard every staff mutation, including clients that bypass the new UI.
create function private.guard_case_lifecycle() returns trigger language plpgsql security definer set search_path='' as $$
declare p text; steps text[]; required text[]; n integer; k text;
begin
 if tg_op='INSERT' and (new.lifecycle_version<>2 or new.review_status<>'pending' or new.process_step<>'review' or new.reviewed_at is not null or new.reviewed_by is not null) then raise exception 'Toute nouvelle candidature doit être examinée par GML'; end if;
 p:=case when new.service='Chauffeur Yango' then 'YANGO' when new.service='Gestion de flotte' then 'FLEET_OWNER' when new.service in ('Recrutement','Recrutement Chauffeur') then 'PARTNER_DRIVER' else 'DRIVE_TO_OWN' end;
 if tg_op='UPDATE' then
  if old.review_status<>'pending' and new.service is distinct from old.service then raise exception 'Programme déjà traité : créez une candidature distincte'; end if;
  if new.lifecycle_version<>old.lifecycle_version then raise exception 'La version du parcours ne peut pas être modifiée'; end if;
  if new.review_status is distinct from old.review_status then
   if not private.is_staff() then raise exception 'Accès personnel requis'; end if;
   if old.review_status<>'pending' then raise exception 'Décision déjà enregistrée. Conservez son historique.'; end if;
   if new.review_status='rejected' and length(trim(coalesce(new.review_reason,'')))<3 then raise exception 'Indiquez le motif du refus'; end if;
   new.reviewed_by:=auth.uid();new.reviewed_at:=now();
   new.workflow_stage:=case when new.review_status='rejected' then 'rejected' else 'contacted' end;
   new.process_step:=case when new.review_status='accepted' then 'appointment' else 'review' end;
   update public.operations_notifications set status='read' where application_id=new.id and channel='internal';
  end if;
  if exists(select 1 from public.contracts where application_id=new.id and status='active') or exists(select 1 from public.vehicles where owner_application_id=new.id) then
   if new.review_status<>old.review_status or new.process_step<>old.process_step or new.workflow_stage<>old.workflow_stage or new.preparation<>old.preparation then raise exception 'Dossier actif : modifiez les opérations depuis le contrat ou la flotte'; end if;
  end if;
 end if;
 if new.lifecycle_version=1 then return new; end if;
 if new.review_status<>'accepted' then
  if new.process_step<>'review' or new.workflow_stage not in ('new','to_contact','contacted','screening','rejected','withdrawn') then raise exception 'Validez d’abord la candidature GML'; end if;
  return new;
 end if;
 if p='DRIVE_TO_OWN' then
  steps:=array['appointment','account','sourcing','gml_inspection','lolc_inspection','client_validation','custody','equipment','documents','handover'];
  required:=array['account_opened','lolc_eligible','vehicle_found','gml_inspected','lolc_inspected','client_validated','vehicle_received','tracker','paperwork'];
 elsif p='PARTNER_DRIVER' then
  steps:=array['appointment','interview','test','allocation'];required:=array['interview_passed','driving_test_passed','training_completed'];
 elsif p='FLEET_OWNER' then
  steps:=array['appointment','inspection','repairs','equipment','ready'];required:=array[]::text[];
 else
  steps:=array['appointment','invited','joined'];required:=array['invitation_explained','yango_joined'];
 end if;
 n:=array_position(steps,new.process_step);
 if n is null then raise exception 'Étape invalide pour ce programme'; end if;
 if p in ('DRIVE_TO_OWN','PARTNER_DRIVER','YANGO') then
  for i in 1..n-1 loop
   if not coalesce(new.preparation @> jsonb_build_object(required[i],true),false) then raise exception 'Contrôle requis : %',required[i]; end if;
  end loop;
 end if;
 if p='DRIVE_TO_OWN' and n>=3 and new.lolc_status<>'approved' then raise exception 'Accord LOLC requis avant recherche du véhicule'; end if;
 if p='DRIVE_TO_OWN' and new.process_step='handover' then
  if nullif(new.preparation->>'handover_on','') is null or (new.preparation->>'handover_on')::date>(now() at time zone 'Africa/Kinshasa')::date then raise exception 'Date réelle de remise requise, non future'; end if;
  if not coalesce(new.preparation @> '{"yango":true}',false) then raise exception 'Intégration Yango requise avant remise'; end if;
 end if;
 if p='FLEET_OWNER' and new.process_step in ('equipment','ready') then
  foreach k in array array['roadworthy','carte_rose','insurance','transport_authorization','vignette','technical_control'] loop
   if not coalesce(new.preparation @> jsonb_build_object(k,true),false) then raise exception 'Contrôle propriétaire requis : %',k; end if;
  end loop;
  if new.process_step='ready' and not new.preparation @> '{"tracker":true,"dashcam":true}' then raise exception 'Tracker et dashcam requis'; end if;
 end if;
 new.workflow_stage:=case
  when p='DRIVE_TO_OWN' then case new.process_step when 'appointment' then 'contacted' when 'account' then 'lolc_pending' when 'sourcing' then 'approved' when 'gml_inspection' then 'vehicle_arrangements' when 'lolc_inspection' then 'inspection' when 'client_validation' then 'inspection' when 'custody' then 'paperwork_check' when 'equipment' then 'preparation' when 'documents' then 'ready' when 'handover' then 'handed_over' end
  when p='PARTNER_DRIVER' then case when new.process_step='allocation' then 'available' when new.process_step='appointment' then 'contacted' else 'screening' end
  when p='FLEET_OWNER' then case new.process_step when 'appointment' then 'contacted' when 'inspection' then 'inspection' when 'repairs' then 'on_hold' when 'equipment' then 'preparation' else 'ready' end
  else case new.process_step when 'appointment' then 'contacted' when 'invited' then 'preparation' else 'ready' end end;
 return new;
end $$;
revoke all on function private.guard_case_lifecycle() from public,anon,authenticated;
-- Alphabetically before validate_case, which retains historical LOLC and revision checks.
create trigger lifecycle_guard before insert or update on public.applications for each row execute function private.guard_case_lifecycle();

create function private.guard_appointment_lifecycle() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.applications;
begin
 select * into a from public.applications where id=new.application_id;
 if a.lifecycle_version=2 and a.review_status<>'accepted' then raise exception 'Acceptez la candidature avant de programmer le rendez-vous'; end if;
 if new.purpose='handover' and a.lifecycle_version=2 and (a.process_step not in ('documents','handover') or not a.preparation @> '{"paperwork":true}') then raise exception 'Finalisez la préparation avant le rendez-vous de remise'; end if;
 return new;
end $$;
revoke all on function private.guard_appointment_lifecycle() from public,anon,authenticated;
create trigger appointment_lifecycle_guard before insert on public.appointments for each row execute function private.guard_appointment_lifecycle();

create function private.guard_contract_lifecycle() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.applications;
begin
 select * into a from public.applications where id=new.application_id;
 if a.lifecycle_version=2 then
  if a.review_status<>'accepted' then raise exception 'Validation GML requise'; end if;
  if a.program_type='DRIVE_TO_OWN' and (a.process_step<>'handover' or new.first_payment_date<>(a.preparation->>'handover_on')::date+1) then raise exception 'Premier paiement requis le lendemain de la remise, en fin de journée'; end if;
  if a.program_type='DRIVE_TO_OWN' and (not extract(isodow from new.first_payment_date)::integer=any(new.operating_days) or new.first_payment_date=any(new.excluded_dates)) then raise exception 'Le lendemain de la remise doit être inclus dans les jours de versement'; end if;
  if a.program_type='PARTNER_DRIVER' and a.process_step<>'allocation' then raise exception 'Entretien, test et formation requis avant affectation'; end if;
 end if;
 return new;
end $$;
revoke all on function private.guard_contract_lifecycle() from public,anon,authenticated;
create trigger contract_lifecycle_guard before insert on public.contracts for each row execute function private.guard_contract_lifecycle();

create function private.onboard_owner_vehicle(p jsonb) returns bigint language plpgsql security definer set search_path='' as $$
declare a public.applications; v bigint; plate_value text;
begin
 if not private.is_staff() then raise exception 'Accès personnel requis'; end if;
 select * into a from public.applications where id=(p->>'application_id')::bigint for update;
 if not found or a.program_type<>'FLEET_OWNER' or a.review_status<>'accepted' or a.process_step<>'ready' then raise exception 'Finalisez les contrôles du véhicule propriétaire'; end if;
 select id into v from public.vehicles where owner_application_id=a.id;
 if found then return v; end if;
 if a.revision<>(p->>'revision')::integer then raise exception 'Le dossier a changé. Actualisez-le.'; end if;
 if not a.preparation @> '{"roadworthy":true,"carte_rose":true,"insurance":true,"transport_authorization":true,"vignette":true,"technical_control":true,"tracker":true,"dashcam":true}' then raise exception 'Contrôles incomplets'; end if;
 if length(trim(coalesce(p->>'fuel_reference','')))<3 or nullif(p->>'fuel_paid_on','') is null or (p->>'fuel_paid_on')::date>(now() at time zone 'Africa/Kinshasa')::date then raise exception 'Référence et date de réception des 70 USD requises'; end if;
 plate_value:=upper(trim(p->>'plate'));
 if coalesce(length(plate_value),0)=0 or coalesce(length(trim(p->>'model')),0)=0 or coalesce(length(trim(p->>'vin')),0)=0 or coalesce(length(trim(p->>'tracker_id')),0)=0 then raise exception 'Modèle, plaque, châssis et tracker requis'; end if;
 perform pg_advisory_xact_lock(hashtextextended(plate_value,1));
 if exists(select 1 from public.vehicles where upper(trim(plate))=plate_value) then raise exception 'Cette plaque figure déjà dans la flotte'; end if;
 update public.applications set preparation=preparation||jsonb_build_object('fuel_amount',70,'fuel_currency','USD','fuel_reference',trim(p->>'fuel_reference'),'fuel_paid_on',p->>'fuel_paid_on','fuel_recorded_by',auth.uid(),'fleet_joined_on',(now() at time zone 'Africa/Kinshasa')::date) where id=a.id;
 insert into public.vehicles(model,plate,vin,tracker_id,status,owner_application_id)
 values(trim(p->>'model'),plate_value,trim(p->>'vin'),trim(p->>'tracker_id'),'Disponible',a.id) returning id into v;
 return v;
end $$;
revoke all on function private.onboard_owner_vehicle(jsonb) from public,anon;
grant execute on function private.onboard_owner_vehicle(jsonb) to authenticated;
create function public.onboard_owner_vehicle(p jsonb) returns bigint language sql security invoker set search_path='' as $$ select private.onboard_owner_vehicle(p); $$;
revoke all on function public.onboard_owner_vehicle(jsonb) from public,anon;
grant execute on function public.onboard_owner_vehicle(jsonb) to authenticated;
do $patch$
declare definition text; marker text := ' else' || chr(10) || '  insert into public.vehicles(model,plate,status,driver,vin,tracker_id)';
begin
 definition:=pg_get_functiondef('private.activate_contract(jsonb)'::regprocedure);
 if position(marker in definition)=0 then raise exception 'Activation function changed: review migration'; end if;
 definition:=replace(definition,marker,' else' || chr(10) || '  if a.lifecycle_version=2 and a.program_type=''PARTNER_DRIVER'' then raise exception ''Choisissez un véhicule disponible déjà enregistré dans la flotte''; end if;' || chr(10) || '  insert into public.vehicles(model,plate,status,driver,vin,tracker_id)');
 execute definition;
end $patch$;
notify pgrst,'reload schema';
commit;
