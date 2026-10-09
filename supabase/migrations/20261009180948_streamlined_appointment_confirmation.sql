begin;

alter table public.appointments add column booking_request_id uuid;
create unique index appointments_booking_request_idx on public.appointments(booking_request_id) where booking_request_id is not null;
alter table public.operations_notifications
 add column delivery_status text check(delivery_status in ('pending','sending','sent','failed','unknown','not_configured')),
 add column delivery_attempts integer not null default 0 check(delivery_attempts>=0),
 add column delivery_started_at timestamptz,
 add column sent_at timestamptz,
 add column provider_message_id text,
 add column delivery_error text;

create function private.appointment_invitation() returns trigger
language plpgsql security definer set search_path='' as $$
declare a public.applications; message text;
begin
 select * into a from public.applications where id=new.application_id;
 message:=case when new.sequence_no=1 then 'Felicitations '||a.name||' ! Votre candidature a passe la premiere verification GML. '
  else 'Bonjour '||a.name||', ' end ||
  'Rendez-vous le '||to_char(new.starts_at at time zone 'Africa/Kinshasa','DD/MM/YYYY')||
  ' a '||to_char(new.starts_at at time zone 'Africa/Kinshasa','HH24:MI')||
  ' (heure de Kinshasa), a '||new.location||'. Ref : '||a.case_reference||'.';
 insert into public.operations_notifications(application_id,appointment_id,kind,channel,recipient,body,delivery_status)
 values(a.id,new.id,'appointment','sms_draft',a.phone,message,'pending');
 return new;
end $$;
revoke all on function private.appointment_invitation() from public,anon,authenticated;
drop trigger appointment_notifications on public.appointments;
create trigger appointment_notifications after insert on public.appointments for each row execute function private.appointment_invitation();

-- Preserve the existing guarded process, while reflecting an active first meeting.
create function private.set_scheduled_case_stage() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.lifecycle_version=2 and new.review_status='accepted' and new.process_step='appointment'
  and exists(select 1 from public.appointments where application_id=new.id and status in ('scheduled','confirmed'))
 then new.workflow_stage:='appointment';end if;
 return new;
end $$;
revoke all on function private.set_scheduled_case_stage() from public,anon,authenticated;
create trigger lifecycle_scheduled_stage before update on public.applications for each row execute function private.set_scheduled_case_stage();

create function private.sync_appointment_stage() returns trigger
language plpgsql security definer set search_path='' as $$
declare target text;
begin
 target:=case when exists(select 1 from public.appointments where application_id=new.application_id and status in ('scheduled','confirmed')) then 'appointment' else 'contacted' end;
 update public.applications set workflow_stage=target where id=new.application_id and lifecycle_version=2
  and review_status='accepted' and process_step='appointment' and workflow_stage is distinct from target;
 return new;
end $$;
revoke all on function private.sync_appointment_stage() from public,anon,authenticated;
create trigger appointment_stage_sync after insert or update of status on public.appointments for each row execute function private.sync_appointment_stage();

create function private.schedule_case_appointment(p jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare a public.applications; ap public.appointments; request uuid; when_value timestamptz; place text; purpose_value text; notification public.operations_notifications;
begin
 if not private.is_staff() then raise exception 'Acces personnel requis';end if;
 request:=(p->>'request_id')::uuid;when_value:=(p->>'starts_at')::timestamptz;
 place:=coalesce(nullif(btrim(p->>'location'),''),'Bureau GM Fleet, 01 Ngongo Lutete, Kinshasa, Gombe');
 if request is null or when_value is null or length(place)>500 then raise exception 'Date, heure et adresse valides requises';end if;
 select * into a from public.applications where id=(p->>'application_id')::bigint for update;
 if not found then raise exception 'Dossier introuvable';end if;
 select * into ap from public.appointments where booking_request_id=request;
 if found then
  if ap.application_id<>a.id or ap.starts_at<>when_value or ap.location<>place or ap.created_by<>auth.uid() then raise exception 'Cette confirmation correspond a un autre rendez-vous';end if;
 else
  if a.review_status<>'accepted' then raise exception 'Acceptez la candidature avant de fixer le rendez-vous';end if;
  if a.revision is distinct from (p->>'revision')::integer then raise exception 'Le dossier a change. Actualisez-le avant de confirmer';end if;
  if a.phone !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'Le numero du candidat doit etre au format international';end if;
  purpose_value:=case when a.program_type='DRIVE_TO_OWN' then case
    when a.process_step in ('appointment','account') then 'account'
    when a.process_step in ('sourcing','gml_inspection','lolc_inspection','client_validation','custody') then 'vehicle_purchase'
    when a.process_step='equipment' then 'installation' when a.process_step='documents' then 'handover' end
   when a.program_type='PARTNER_DRIVER' then 'driving_test' when a.program_type='FLEET_OWNER' then 'vehicle_inspection' else 'meeting' end;
  if purpose_value is null then raise exception 'Le parcours ne necessite plus de rendez-vous';end if;
  if purpose_value<>'vehicle_purchase' and when_value<=now() then raise exception 'Choisissez une date et une heure futures';end if;
  insert into public.appointments(application_id,starts_at,location,assigned_to,briefing_confirmed,purpose,booking_request_id)
  values(a.id,when_value,place,coalesce(a.assigned_to,auth.uid()),true,purpose_value,request) returning * into ap;
 end if;
 select * into notification from public.operations_notifications where appointment_id=ap.id and kind='appointment';
 return jsonb_build_object('appointment_id',ap.id,'application_id',a.id,'notification_id',notification.id,'sms_status',coalesce(notification.delivery_status,'pending'));
end $$;
create function public.schedule_case_appointment(p jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.schedule_case_appointment(p);$$;
revoke all on function private.schedule_case_appointment(jsonb),public.schedule_case_appointment(jsonb) from public,anon;
grant execute on function private.schedule_case_appointment(jsonb),public.schedule_case_appointment(jsonb) to authenticated;

-- Claim once before the external request. Unknown outcomes are never resent automatically.
create function private.claim_appointment_sms(notification_id bigint) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare n public.operations_notifications;
begin
 update public.operations_notifications as candidate set delivery_status='sending',delivery_attempts=delivery_attempts+1,delivery_started_at=now(),delivery_error=null
 where candidate.id=notification_id and candidate.kind='appointment' and coalesce(candidate.delivery_status,'pending') in ('pending','failed','not_configured')
  and exists(select 1 from public.appointments ap join public.applications a on a.id=ap.application_id
   where ap.id=candidate.appointment_id and ap.status in ('scheduled','confirmed') and a.review_status='accepted')
 returning candidate.* into n;
 if not found then return null;end if;
 return jsonb_build_object('notification_id',n.id,'recipient',n.recipient,'body',n.body);
end $$;
create function public.claim_appointment_sms(notification_id bigint) returns jsonb language sql security invoker set search_path='' as $$select private.claim_appointment_sms(notification_id);$$;
revoke all on function private.claim_appointment_sms(bigint),public.claim_appointment_sms(bigint) from public,anon,authenticated;
grant execute on function private.claim_appointment_sms(bigint),public.claim_appointment_sms(bigint) to service_role;
grant usage on schema private to service_role;
grant select on public.appointments,public.applications,public.operations_notifications to service_role;
grant update(delivery_status,delivery_attempts,delivery_started_at,sent_at,provider_message_id,delivery_error) on public.operations_notifications to service_role;

-- This is a GML tracking reference, not a lender-issued account number.
create function private.allocate_lolc_tracking_reference() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  if nullif(new.lolc_reference,'') is not null then raise exception 'Reference LOLC attribuee automatiquement';end if;
 elsif new.lolc_reference is distinct from old.lolc_reference then
  raise exception 'La reference de suivi LOLC ne peut pas etre modifiee';
 end if;
 if coalesce(new.service,'') not in ('Chauffeur Yango','Gestion de flotte','Recrutement','Recrutement Chauffeur') and new.lolc_status='approved' and nullif(new.lolc_reference,'') is null then
  new.lolc_reference:='LOLC-'||new.case_reference;
 end if;
 return new;
end $$;
revoke all on function private.allocate_lolc_tracking_reference() from public,anon,authenticated;
create trigger lifecycle_lolc_reference before insert or update on public.applications
 for each row execute function private.allocate_lolc_tracking_reference();

create function private.record_case_step(p jsonb) returns bigint
language plpgsql security definer set search_path='' as $$
declare a public.applications; ap public.appointments; prep jsonb; result_value jsonb;
 choice text; notes_value text; target text; action_value text; decision jsonb;
 request uuid; actual_date date; today date:=(now() at time zone 'Africa/Kinshasa')::date;
 checks text[]:=array['roadworthy','carte_rose','insurance','transport_authorization','vignette','technical_control'];k text;
begin
 if not private.is_staff() then raise exception 'Acces personnel requis';end if;
 request:=(p->>'request_id')::uuid;choice:=p->>'outcome';notes_value:=nullif(btrim(p->>'notes'),'');
 result_value:=coalesce(p->'result','{}'::jsonb);
 if request is null or choice is null or jsonb_typeof(result_value)<>'object' or length(coalesce(notes_value,''))>2000 then raise exception 'Decision invalide';end if;
 if result_value ? 'lolc_reference' then raise exception 'Reference LOLC attribuee automatiquement';end if;
 select * into a from public.applications where id=(p->>'application_id')::bigint for update;
 if not found then raise exception 'Dossier introuvable';end if;
 decision:=jsonb_build_object('request_id',request,'step',p->>'step','outcome',choice,'notes',notes_value,'result',result_value,'actor_id',auth.uid(),'appointment_id',p->>'appointment_id');
 if a.preparation->'last_decision'->>'request_id'=request::text then
  if (a.preparation->'last_decision')-'recorded_at'<>decision then raise exception 'Cette confirmation correspond a une autre decision';end if;
  return a.id;
 end if;
 if a.lifecycle_version<>2 or a.review_status<>'accepted' then raise exception 'Validation GML requise';end if;
 if a.revision is distinct from (p->>'revision')::integer or a.process_step is distinct from (p->>'step') then raise exception 'Le dossier a change. Actualisez-le';end if;
 if exists(select 1 from public.contracts where application_id=a.id and status='active') or exists(select 1 from public.vehicles where owner_application_id=a.id) then raise exception 'Dossier deja actif';end if;
 select * into ap from public.appointments where application_id=a.id and status in ('scheduled','confirmed') for update;
 if found then
  if ap.id is distinct from nullif(p->>'appointment_id','')::uuid then raise exception 'Traitez le rendez-vous en cours';end if;
  if (ap.starts_at at time zone 'Africa/Kinshasa')::date>today and choice not in ('cancelled') then raise exception 'Le rendez-vous est prevu a une date future';end if;
 elsif a.process_step='appointment' or nullif(p->>'appointment_id','') is not null then raise exception 'Rendez-vous actif requis';end if;
 prep:=a.preparation;target:=a.process_step;action_value:=a.next_action;
 if choice in ('missed','cancelled') then
  if ap.id is null then raise exception 'Aucun rendez-vous a cloturer';end if;
  action_value:='Reprogrammer le rendez-vous';
 elsif choice='deferred' then
  if notes_value is null or length(notes_value)<3 then raise exception 'Indiquez les points a resoudre';end if;
  action_value:=notes_value;
 elsif a.program_type='DRIVE_TO_OWN' then
  case a.process_step
   when 'appointment','account' then
    if choice not in ('lolc_approved','information_required','lolc_rejected') then raise exception 'Decision LOLC invalide';end if;
    if choice<>'lolc_approved' and coalesce(length(notes_value),0)<3 then raise exception 'Motif LOLC requis';end if;
    prep:=prep||jsonb_build_object('account_opened',true,'lolc_eligible',choice='lolc_approved','lolc_decision_on',today);
    target:=case when choice='lolc_approved' then 'sourcing' else 'account' end;
    action_value:=case choice when 'lolc_approved' then 'Identifier le vehicule a financer' when 'information_required' then 'Completer le dossier LOLC' else 'Informer le candidat du refus LOLC' end;
   when 'sourcing' then
    if choice<>'vehicle_selected' then raise exception 'Decision vehicule invalide';end if;
    if coalesce(length(btrim(result_value->>'model')),0)<2 or coalesce(length(btrim(result_value->>'plate')),0)<2 or coalesce(length(btrim(result_value->>'vin')),0)<3 then raise exception 'Modele, plaque et chassis requis';end if;
    prep:=prep||jsonb_build_object('vehicle_found',true,'purchased_vehicle',result_value);
    target:='gml_inspection';action_value:='Effectuer le controle GML du vehicule';
   when 'gml_inspection' then
    if choice<>'inspection_passed' then raise exception 'Decision inspection invalide';end if;
    prep:=prep||'{"gml_inspected":true}'::jsonb;target:='lolc_inspection';action_value:='Obtenir le controle favorable LOLC';
   when 'lolc_inspection' then
    if choice<>'inspection_passed' then raise exception 'Decision inspection LOLC invalide';end if;
    prep:=prep||'{"lolc_inspected":true}'::jsonb;target:='client_validation';action_value:='Faire valider le vehicule par le candidat';
   when 'client_validation' then
    if choice<>'vehicle_accepted' then raise exception 'Decision client invalide';end if;
    prep:=prep||'{"client_validated":true}'::jsonb;target:='custody';action_value:='Confirmer achat et reception chez GML';
   when 'custody' then
    if choice<>'vehicle_received' then raise exception 'Decision reception invalide';end if;
    actual_date:=nullif(result_value->>'purchase_date','')::date;
    if actual_date is null or actual_date>today then raise exception 'Date reelle achat / reception requise';end if;
    prep:=prep||jsonb_build_object('vehicle_received',true,'vehicle_bought_on',actual_date);
    target:='equipment';action_value:='Installer le tracker';
   when 'equipment' then
    if choice<>'installed' or coalesce(length(btrim(result_value->>'tracker_id')),0)<2 then raise exception 'Installation terminee et identifiant tracker requis';end if;
    prep:=prep||jsonb_build_object('tracker',true,'equipment',result_value,'installed_on',today);
    target:='documents';action_value:='Finaliser documents, integration Yango et remise';
   when 'documents' then
    if choice<>'handed_over' or not result_value @> '{"paperwork":true,"yango":true}' then raise exception 'Documents et integration Yango requis avant remise';end if;
    actual_date:=nullif(result_value->>'handover_date','')::date;
    if actual_date is null or actual_date>today then raise exception 'Date reelle de remise requise';end if;
    prep:=prep||jsonb_build_object('paperwork',true,'yango',true,'handover_on',actual_date,'handover',result_value);
    target:='handover';action_value:='Activer le contrat signe';
   else raise exception 'Parcours deja termine';
  end case;
 elsif a.program_type='PARTNER_DRIVER' then
  if a.process_step='appointment' and choice='interview_passed' then prep:=prep||'{"interview_passed":true}'::jsonb;target:='interview';action_value:='Effectuer le test de conduite';
  elsif a.process_step='interview' and choice='driving_test_passed' then prep:=prep||'{"driving_test_passed":true}'::jsonb;target:='test';action_value:='Terminer la formation et integration';
  elsif a.process_step='test' and choice='training_completed' then prep:=prep||'{"training_completed":true}'::jsonb;target:='allocation';action_value:='Affecter un vehicule disponible';
  else raise exception 'Decision chauffeur invalide';end if;
 elsif a.program_type='YANGO' then
  if a.process_step='appointment' and choice='invitation_explained' then prep:=prep||'{"invitation_explained":true}'::jsonb;target:='invited';action_value:='Verifier le rattachement a GM Fleet';
  elsif a.process_step='invited' and choice='yango_joined' then prep:=prep||'{"yango_joined":true}'::jsonb;target:='joined';action_value:='Partenaire Yango integre';
  else raise exception 'Decision Yango invalide';end if;
 elsif a.program_type='FLEET_OWNER' then
  if a.process_step in ('appointment','inspection','repairs') then
   if choice='repairs_required' then
    if coalesce(length(notes_value),0)<3 then raise exception 'Reparations a preciser';end if;
    target:='repairs';action_value:=notes_value;
   elsif choice='inspection_passed' then
    foreach k in array checks loop
     if not result_value @> jsonb_build_object(k,true) then raise exception 'Controle proprietaire requis : %',k;end if;
     prep:=prep||jsonb_build_object(k,true);
    end loop;
    target:='equipment';action_value:='Installer tracker et dashcam';
   else raise exception 'Decision inspection invalide';end if;
  elsif a.process_step='equipment' and choice='installed' then
   if coalesce(length(btrim(result_value->>'tracker_id')),0)<2 or coalesce(length(btrim(result_value->>'dashcam_id')),0)<2 then raise exception 'Identifiants tracker et dashcam requis';end if;
   prep:=prep||jsonb_build_object('tracker',true,'dashcam',true,'equipment',result_value);target:='ready';action_value:='Confirmer reception du plein et entree flotte';
  else raise exception 'Decision proprietaire invalide';end if;
 else raise exception 'Programme inconnu';end if;
 update public.applications set preparation=prep||jsonb_build_object('last_decision',decision||jsonb_build_object('recorded_at',now())),process_step=target,next_action=action_value,
  lolc_status=case when a.program_type='DRIVE_TO_OWN' and a.process_step in ('appointment','account') and choice in ('lolc_approved','information_required','lolc_rejected') then case choice when 'lolc_approved' then 'approved' when 'information_required' then 'information_required' else 'rejected' end else a.lolc_status end,
  follow_up_on=case when target=a.process_step or choice in ('information_required','lolc_rejected','repairs_required') then today+1 else null end
 where id=a.id;
 if ap.id is not null then
  update public.appointments set status=case choice when 'missed' then 'missed' when 'cancelled' then 'cancelled' else 'completed' end,
   outcome=case when choice in ('lolc_approved','information_required','lolc_rejected','installed','handed_over','missed','cancelled') then choice when choice='deferred' then 'delayed' else 'completed' end,
   outcome_notes=notes_value,result=result_value||jsonb_build_object('decision',choice),completed_at=now() where id=ap.id;
 end if;
 return a.id;
end $$;
create function public.record_case_step(p jsonb) returns bigint language sql security invoker set search_path='' as $$select private.record_case_step(p);$$;
revoke all on function private.record_case_step(jsonb),public.record_case_step(jsonb) from public,anon;
grant execute on function private.record_case_step(jsonb),public.record_case_step(jsonb) to authenticated;

update public.applications a set workflow_stage='appointment'
 where a.lifecycle_version=2 and a.review_status='accepted' and a.process_step='appointment'
 and a.workflow_stage<>'appointment' and exists(select 1 from public.appointments ap where ap.application_id=a.id and ap.status in ('scheduled','confirmed'));

notify pgrst,'reload schema';
commit;
