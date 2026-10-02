begin;

alter table public.applications
 add column case_reference text,
 add column claimed_at timestamptz;

create function private.application_reference(p_service text,p_id bigint,p_date date)
returns text language sql immutable set search_path='' as $$
 select (case
  when p_service='Chauffeur Yango' then 'YNG'
  when p_service='Gestion de flotte' then 'FLT'
  when p_service in ('Recrutement','Recrutement Chauffeur') then 'DRV'
  else 'CNG' end)||'-'||extract(year from p_date)::integer||'-'||lpad(p_id::text,6,'0');
$$;
revoke all on function private.application_reference(text,bigint,date) from public,anon,authenticated;

create function private.assign_application_reference()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.case_reference is null then
  new.case_reference:=private.application_reference(new.service,new.id,coalesce(new.created_on,(now() at time zone 'Africa/Kinshasa')::date));
 end if;
 return new;
end $$;
revoke all on function private.assign_application_reference() from public,anon,authenticated;
create trigger a_assign_application_reference before insert on public.applications
 for each row execute function private.assign_application_reference();

update public.applications
 set case_reference=private.application_reference(service,id,coalesce(created_on,(created_at at time zone 'Africa/Kinshasa')::date))
 where case_reference is null;
alter table public.applications alter column case_reference set not null;
create unique index applications_case_reference_idx on public.applications(case_reference);

alter table public.appointments
 add column sequence_no smallint,
 add column outcome text,
 add column outcome_notes text,
 add column result jsonb not null default '{}'::jsonb check(jsonb_typeof(result)='object'),
 add column completed_at timestamptz;
alter table public.appointments drop constraint appointments_purpose_check;
alter table public.appointments add constraint appointments_purpose_check check
 (purpose in ('meeting','account','driving_test','vehicle_inspection','vehicle_purchase','handover','installation'));
alter table public.appointments add constraint appointments_outcome_check check
 (outcome is null or outcome in ('lolc_approved','lolc_rejected','information_required','vehicle_bought','delayed','installed','installation_incomplete','handed_over','completed','missed','cancelled'));
create unique index appointments_application_sequence_idx on public.appointments(application_id,sequence_no) where sequence_no is not null;

with numbered as (
 select id,row_number() over(partition by application_id order by starts_at,id)::smallint as n
 from public.appointments
)
update public.appointments a set sequence_no=n.n from numbered n where n.id=a.id;

create or replace function private.guard_appointment_lifecycle()
returns trigger language plpgsql security definer set search_path='' as $$
declare a public.applications; expected_purpose text;
begin
 select * into a from public.applications where id=new.application_id for update;
 if not found then raise exception 'Dossier introuvable'; end if;
 if a.lifecycle_version=2 and a.review_status<>'accepted' then raise exception 'Acceptez la candidature avant de programmer le rendez-vous'; end if;
 if a.lifecycle_version=2 and exists(
  select 1 from public.appointments p where p.application_id=a.id and p.status in ('scheduled','confirmed')
 ) then raise exception 'Clôturez le rendez-vous en cours avant de programmer le suivant'; end if;
 if a.lifecycle_version=2 and a.program_type='DRIVE_TO_OWN' then
  expected_purpose:=case
   when a.process_step in ('appointment','account') then 'account'
   when a.process_step in ('sourcing','gml_inspection','lolc_inspection','client_validation','custody') then 'vehicle_purchase'
   when a.process_step='equipment' then 'installation'
   when a.process_step='documents' then 'handover'
   else null end;
  if expected_purpose is null then raise exception 'Ce parcours ne nécessite plus de rendez-vous'; end if;
  if new.purpose<>expected_purpose then raise exception 'Prochain rendez-vous requis : %',expected_purpose; end if;
 end if;
 if new.purpose='handover' and a.lifecycle_version=2 and (a.process_step not in ('documents','handover') or not a.preparation @> '{"tracker":true}') then raise exception 'Finalisez l’installation avant le rendez-vous de remise'; end if;
 new.assigned_to:=coalesce(a.assigned_to,auth.uid());
 new.sequence_no:=coalesce((select max(p.sequence_no) from public.appointments p where p.application_id=a.id),0)+1;
 return new;
end $$;

create function private.record_guided_appointment(p jsonb)
returns bigint language plpgsql security definer set search_path='' as $$
declare ap public.appointments; a public.applications; result_value jsonb; outcome_value text; notes_value text; handover_date date;
begin
 if not private.is_staff() then raise exception 'Accès personnel requis'; end if;
 select * into ap from public.appointments where id=(p->>'appointment_id')::uuid for update;
 if not found then raise exception 'Rendez-vous introuvable'; end if;
 if ap.status not in ('scheduled','confirmed') then raise exception 'Ce rendez-vous est déjà clôturé'; end if;
 select * into a from public.applications where id=ap.application_id for update;
 outcome_value:=nullif(trim(p->>'outcome'),'');notes_value:=nullif(trim(p->>'notes'),'');
 result_value:=coalesce(p->'result','{}'::jsonb);
 if jsonb_typeof(result_value)<>'object' then raise exception 'Résultat invalide'; end if;
 if outcome_value is null then raise exception 'Sélectionnez le résultat du rendez-vous'; end if;
 if outcome_value in ('missed','cancelled') then
  update public.appointments set status=case when outcome_value='missed' then 'missed' else 'cancelled' end,outcome=outcome_value,outcome_notes=notes_value,result=result_value,completed_at=now() where id=ap.id;
  return a.id;
 end if;
 if a.program_type='DRIVE_TO_OWN' then
  if ap.purpose='account' then
   if outcome_value not in ('lolc_approved','lolc_rejected','information_required') then raise exception 'Décision LOLC invalide'; end if;
   update public.applications set
    preparation=preparation||jsonb_build_object('account_opened',true,'lolc_eligible',outcome_value='lolc_approved','lolc_decision_on',(now() at time zone 'Africa/Kinshasa')::date),
    lolc_status=case outcome_value when 'lolc_approved' then 'approved' when 'lolc_rejected' then 'rejected' else 'information_required' end,
    lolc_reference=coalesce(nullif(trim(result_value->>'lolc_reference'),''),lolc_reference),
    process_step=case when outcome_value='lolc_approved' then 'sourcing' else 'account' end,
    next_action=case outcome_value when 'lolc_approved' then 'Organiser l’achat du véhicule avec LOLC' when 'lolc_rejected' then 'Informer le candidat de la décision LOLC' else 'Obtenir les compléments demandés par LOLC' end,
    follow_up_on=case when outcome_value='lolc_approved' then null else (now() at time zone 'Africa/Kinshasa')::date+1 end
   where id=a.id;
  elsif ap.purpose='vehicle_purchase' then
   if outcome_value='vehicle_bought' then
    if coalesce(length(trim(result_value->>'model')),0)<2 or coalesce(length(trim(result_value->>'plate')),0)<2 or coalesce(length(trim(result_value->>'vin')),0)<3 then raise exception 'Modèle, plaque et châssis sont requis'; end if;
    update public.applications set
     preparation=preparation||jsonb_build_object('vehicle_found',true,'gml_inspected',true,'lolc_inspected',true,'client_validated',true,'vehicle_received',true,'purchased_vehicle',result_value,'vehicle_bought_on',coalesce(nullif(result_value->>'purchase_date',''),(now() at time zone 'Africa/Kinshasa')::date::text)),
     process_step='equipment',next_action='Installer le tracker et les équipements',follow_up_on=null
    where id=a.id;
   elsif outcome_value='delayed' then
    update public.applications set next_action=coalesce(notes_value,'Reprogrammer l’achat du véhicule'),follow_up_on=(now() at time zone 'Africa/Kinshasa')::date+1 where id=a.id;
   else raise exception 'Résultat d’achat invalide'; end if;
  elsif ap.purpose='installation' then
   if outcome_value='installed' then
    if coalesce(length(trim(result_value->>'tracker_id')),0)<2 then raise exception 'Identifiant du tracker requis'; end if;
    update public.applications set
     preparation=preparation||jsonb_build_object('tracker',true,'equipment',result_value,'installed_on',coalesce(nullif(result_value->>'installation_date',''),(now() at time zone 'Africa/Kinshasa')::date::text)),
     process_step='documents',next_action='Préparer la remise du véhicule',follow_up_on=null
    where id=a.id;
   elsif outcome_value in ('installation_incomplete','delayed') then
    update public.applications set next_action=coalesce(notes_value,'Finaliser l’installation des équipements'),follow_up_on=(now() at time zone 'Africa/Kinshasa')::date+1 where id=a.id;
   else raise exception 'Résultat d’installation invalide'; end if;
  elsif ap.purpose='handover' then
   if outcome_value='handed_over' then
    handover_date:=coalesce(nullif(result_value->>'handover_date','')::date,(now() at time zone 'Africa/Kinshasa')::date);
    if handover_date>(now() at time zone 'Africa/Kinshasa')::date then raise exception 'La date de remise ne peut pas être future'; end if;
    update public.applications set
     preparation=preparation||jsonb_build_object('paperwork',true,'yango',true,'handover_on',handover_date,'handover',result_value),
     process_step='handover',next_action='Activer le contrat signé',follow_up_on=null
    where id=a.id;
   elsif outcome_value='delayed' then
    update public.applications set next_action=coalesce(notes_value,'Reprogrammer la remise du véhicule'),follow_up_on=(now() at time zone 'Africa/Kinshasa')::date+1 where id=a.id;
   else raise exception 'Résultat de remise invalide'; end if;
  else raise exception 'Type de rendez-vous non pris en charge'; end if;
 else
  if outcome_value not in ('completed','delayed') then raise exception 'Résultat invalide'; end if;
  if outcome_value='delayed' then update public.applications set next_action=coalesce(notes_value,'Reprogrammer le rendez-vous'),follow_up_on=(now() at time zone 'Africa/Kinshasa')::date+1 where id=a.id; end if;
 end if;
 update public.appointments set status='completed',outcome=outcome_value,outcome_notes=notes_value,result=result_value,completed_at=now() where id=ap.id;
 return a.id;
end $$;
revoke all on function private.record_guided_appointment(jsonb) from public,anon;
grant execute on function private.record_guided_appointment(jsonb) to authenticated;
create function public.record_guided_appointment(p jsonb)
returns bigint language sql security invoker set search_path='' as $$ select private.record_guided_appointment(p); $$;
revoke all on function public.record_guided_appointment(jsonb) from public,anon;
grant execute on function public.record_guided_appointment(jsonb) to authenticated;

notify pgrst,'reload schema';
commit;
