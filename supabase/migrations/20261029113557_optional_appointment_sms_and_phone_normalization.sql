begin;
alter table public.appointments add column sms_requested boolean not null default true;
create or replace function private.appointment_invitation() returns trigger
language plpgsql security definer set search_path='' as $$
declare a public.applications; message text; phone text;
begin
 if not new.sms_requested then return new;end if;
 select * into a from public.applications where id=new.application_id;
 phone:=regexp_replace(coalesce(a.phone,''),'[[:space:]().-]','','g');
 if phone ~ '^0[0-9]{9}$' then phone:='+243'||substr(phone,2);
 elsif phone ~ '^[0-9]{9}$' then phone:='+243'||phone;
 elsif phone ~ '^243[0-9]{9}$' then phone:='+'||phone;
 elsif phone ~ '^00[1-9][0-9]{7,14}$' then phone:='+'||substr(phone,3);end if;
 if phone !~ '^[+][1-9][0-9]{7,14}$' then raise exception 'Numéro SMS invalide : utilisez +243, 09… ou 9 chiffres. Décochez l’envoi SMS pour enregistrer sans notification.';end if;
 message:=case when new.sequence_no=1 then 'Felicitations '||a.name||' ! Votre candidature a passe la premiere verification GML. '
  else 'Bonjour '||a.name||', ' end ||
  'Rendez-vous le '||to_char(new.starts_at at time zone 'Africa/Kinshasa','DD/MM/YYYY')||
  ' a '||to_char(new.starts_at at time zone 'Africa/Kinshasa','HH24:MI')||
  ' (heure de Kinshasa), a '||new.location||'. Ref : '||a.case_reference||'.';
 insert into public.operations_notifications(application_id,appointment_id,kind,channel,recipient,body,delivery_status)
 values(a.id,new.id,'appointment','sms_draft',phone,message,'pending');
 return new;
end $$;
revoke all on function private.appointment_invitation() from public,anon,authenticated;
create or replace function private.schedule_case_appointment(p jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare a public.applications; ap public.appointments; request uuid; when_value timestamptz; place text; purpose_value text; notification public.operations_notifications; send_sms boolean;
begin
 if not private.is_staff() then raise exception 'Acces personnel requis';end if;
 if p ? 'send_sms' and jsonb_typeof(p->'send_sms')<>'boolean' then raise exception 'Choix SMS invalide';end if;
 send_sms:=coalesce((p->>'send_sms')::boolean,true);
 request:=(p->>'request_id')::uuid;when_value:=(p->>'starts_at')::timestamptz;
 place:=coalesce(nullif(btrim(p->>'location'),''),'Bureau GM Fleet, 01 Ngongo Lutete, Kinshasa, Gombe');
 if request is null or when_value is null or length(place)>500 then raise exception 'Date, heure et adresse valides requises';end if;
 select * into a from public.applications where id=(p->>'application_id')::bigint for update;
 if not found then raise exception 'Dossier introuvable';end if;
 select * into ap from public.appointments where booking_request_id=request;
 if found then
  if ap.application_id<>a.id or ap.starts_at<>when_value or ap.location<>place or ap.created_by<>auth.uid() or ap.sms_requested<>send_sms then raise exception 'Cette confirmation correspond a un autre rendez-vous';end if;
 else
  if a.review_status<>'accepted' then raise exception 'Acceptez la candidature avant de fixer le rendez-vous';end if;
  if a.revision is distinct from (p->>'revision')::integer then raise exception 'Le dossier a change. Actualisez-le avant de confirmer';end if;
  purpose_value:=case when a.program_type='DRIVE_TO_OWN' then case
    when a.process_step in ('appointment','account') then 'account'
    when a.process_step in ('sourcing','gml_inspection','lolc_inspection','client_validation','custody') then 'vehicle_purchase'
    when a.process_step='equipment' then 'installation' when a.process_step='documents' then 'handover' end
   when a.program_type='PARTNER_DRIVER' then 'driving_test' when a.program_type='FLEET_OWNER' then 'vehicle_inspection' else 'meeting' end;
  if purpose_value is null then raise exception 'Le parcours ne necessite plus de rendez-vous';end if;
  if purpose_value<>'vehicle_purchase' and when_value<=now() then raise exception 'Choisissez une date et une heure futures';end if;
  insert into public.appointments(application_id,starts_at,location,assigned_to,briefing_confirmed,purpose,booking_request_id,sms_requested)
  values(a.id,when_value,place,coalesce(a.assigned_to,auth.uid()),true,purpose_value,request,send_sms) returning * into ap;
 end if;
 select * into notification from public.operations_notifications where appointment_id=ap.id and kind='appointment';
 return jsonb_build_object('appointment_id',ap.id,'application_id',a.id,'notification_id',notification.id,'sms_requested',ap.sms_requested,'sms_status',case when not ap.sms_requested then 'not_requested' else coalesce(notification.delivery_status,'pending') end);
end $$;
create or replace function public.schedule_case_appointment(p jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.schedule_case_appointment(p);$$;
revoke all on function private.schedule_case_appointment(jsonb),public.schedule_case_appointment(jsonb) from public,anon;
grant execute on function private.schedule_case_appointment(jsonb),public.schedule_case_appointment(jsonb) to authenticated;

create or replace function private.queue_appointment_cancellation_sms() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.applications;
begin
 if new.sms_requested and new.status='cancelled' and old.status in('scheduled','confirmed') then
 select * into a from public.applications where id=new.application_id;
 perform private.queue_sms('appointment:'||new.id||':cancelled','appointment_cancelled',a.phone,'GM Fleet - '||a.case_reference||' : votre rendez-vous du '||to_char(new.starts_at at time zone 'Africa/Kinshasa','DD/MM/YYYY à HH24:MI')||' est annulé. Contactez GML pour convenir de la suite.',a.id);
 end if;return new;
end $$;
revoke all on function private.queue_appointment_cancellation_sms() from public,anon,authenticated;

commit;
