begin;
alter table public.sms_dispatches add column channel text not null default 'sms' check(channel in('sms','whatsapp')),add column channel_decided boolean not null default false,add column whatsapp_template text,add column whatsapp_message_id text unique,add column meta_error_code integer,add column whatsapp_status_at timestamptz,add column read_at timestamptz,add column fallback_of uuid unique references public.sms_dispatches(id);
alter table public.sms_dispatches drop constraint sms_dispatches_status_check;
alter table public.sms_dispatches add constraint sms_dispatches_status_check check(status in('pending','sending','accepted','sent','delivered','read','failed','unknown','not_configured','cancelled'));
alter table public.operations_notifications add column delivery_channel text;
alter table public.operations_notifications drop constraint operations_notifications_delivery_status_check;
alter table public.operations_notifications add constraint operations_notifications_delivery_status_check check(delivery_status in('pending','sending','accepted','sent','delivered','read','failed','unknown','not_configured','cancelled'));
create table private.whatsapp_templates(name text primary key,parameter_count int not null check(parameter_count between 1 and 20));
-- Registry is generated from the supplied catalogue. It contains no example values.
insert into private.whatsapp_templates(name,parameter_count) values ('gml_alerte_encaissement_direction_fr',9),('gml_equipement_encaisse_direction_fr',4),('gml_depot_lolc_direction_fr',5),('gml_versement_confirme_fr',7),('gml_versement_annule_fr',9),('gml_depot_lolc_confirme_fr',5),('gml_proprietaire_mise_exploitation_fr',11),('gml_proprietaire_recap_avance_fr',8),('gml_proprietaire_paiement_mensuel_fr',9),('gml_copie_contrat_fr',3),('gml_contrat_active_fr',9),('gml_rendez_vous_confirmation_fr',6),('gml_rendez_vous_annule_fr',5),('gml_candidature_recue_fr',3),('gml_candidature_admin_fr',4),('gml_dossier_retenu_fr',3),('gml_dossier_refuse_fr',3),('gml_lolc_accord_fr',2),('gml_lolc_complement_fr',3),('gml_lolc_refus_fr',2),('gml_equipements_installes_fr',3),('gml_vehicule_remis_fr',5),('gml_chauffeur_pret_affectation_fr',2),('gml_yango_rattachement_fr',2),('gml_devis_recu_fr',3),('gml_devis_admin_fr',3),('gml_compte_equipe_invitation_fr',3);
create table private.whatsapp_contacts(phone text primary key check(phone ~ '^243[0-9]{9}$'),opted_in boolean not null,source text not null check(length(source) between 3 and 1000),updated_by uuid not null references auth.users(id),updated_at timestamptz not null default now());
create table private.whatsapp_payloads(sms_id uuid primary key references public.sms_dispatches(id),template_name text not null,parameters jsonb not null,runtime_kind text,runtime_position int,ciphertext jsonb,expires_at timestamptz);
create table private.whatsapp_tests(id uuid primary key,phone text not null,reference text not null,force_failure boolean not null default false,authorized_until timestamptz not null,created_by uuid references auth.users(id),sms_id uuid unique references public.sms_dispatches(id));
create table private.whatsapp_commands(request_id uuid primary key,actor_id uuid not null,payload jsonb not null);
do $$declare t text;begin foreach t in array array['whatsapp_templates','whatsapp_contacts','whatsapp_payloads','whatsapp_tests','whatsapp_commands'] loop execute format('alter table private.%I enable row level security',t);execute format('revoke all on private.%I from public,anon,authenticated',t);end loop;end $$;

create function private.whatsapp_snapshot(n public.sms_dispatches) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.applications;c public.contracts;v public.vehicles;d public.drivers;pay public.payments;orig public.payments;ap public.appointments;cp public.lolc_case_payments;m public.fleet_mandates;os public.owner_settlements;q public.equipment_quotes;adv public.vehicle_advances;staff public.staff_members;r jsonb;t text;p jsonb;rt text;rp int;kind text;reference text;due_day date;due_amount numeric;paid numeric;uid text;pr text;
begin
 if n.kind in('driver_payment_reminder','staff_recovery','owner_collection','mobile_owner_linked') or n.fallback_of is not null then return null;end if;
 select * into a from public.applications where id=n.application_id;
 pr:=case a.program_type when 'DRIVE_TO_OWN' then 'Car na ngai' when 'FLEET_OWNER' then 'Gestion de flotte' when 'PARTNER_DRIVER' then 'Chauffeur partenaire' when 'YANGO' then 'Partenaire Yango' end;
 if n.kind in('payment_receipt','boss_payment') and n.event_key ~ '^payment:[0-9]+' then
  select * into pay from public.payments where id=split_part(n.event_key,':',2)::bigint;select * into c from public.contracts where id=pay.contract_id;
  if pay.id is null or c.id is null then return null;end if;
  if pay.entry_kind='reversal' then select * into orig from public.payments where id=pay.reverses_payment_id;t:='gml_versement_annule_fr';p:=jsonb_build_array(coalesce(a.name,pay.driver_name),c.signed_reference,pay.amount::text,c.currency,(pay.amount-pay.lolc_amount)::text,pay.lolc_amount::text,orig.reference,pay.reference,to_char(pay.paid_on,'DD/MM/YYYY'));
  elsif n.kind='boss_payment' then t:='gml_alerte_encaissement_direction_fr';p:=jsonb_build_array(coalesce(a.name,pay.driver_name),c.signed_reference,pay.amount::text,c.currency,(pay.amount-pay.lolc_amount)::text,pay.lolc_amount::text,replace(pay.method,'Araka ','Mobile Money '),to_char(pay.paid_on,'DD/MM/YYYY'),pay.reference);
  else t:='gml_versement_confirme_fr';p:=jsonb_build_array(coalesce(a.name,pay.driver_name),pay.amount::text,c.currency,c.signed_reference,to_char(pay.paid_on,'DD/MM/YYYY'),replace(pay.method,'Araka ','Mobile Money '),pay.reference);end if;
 elsif n.kind in('boss_payment','lolc_deposit_receipt') and n.event_key ~ '^lolc-(deposit|equipment):[0-9a-f-]{36}' then
  select * into cp from public.lolc_case_payments where id=split_part(n.event_key,':',2)::uuid;if cp.id is null then return null;end if;
  if cp.kind='equipment_received' then t:='gml_equipement_encaisse_direction_fr';p:=jsonb_build_array(a.name,cp.amount::text,to_char(cp.paid_on,'DD/MM/YYYY'),cp.reference);
  elsif n.kind='boss_payment' then t:='gml_depot_lolc_direction_fr';p:=jsonb_build_array(a.name,a.case_reference,cp.amount::text,to_char(cp.paid_on,'DD/MM/YYYY'),cp.reference);
  else t:='gml_depot_lolc_confirme_fr';p:=jsonb_build_array(a.name,cp.amount::text,to_char(cp.paid_on,'DD/MM/YYYY'),a.case_reference,cp.reference);end if;
 elsif n.kind in('contract_activated','owner_assignment','owner_debt_recap') and n.event_key ~ '^contract:[0-9a-f-]{36}' then
  select * into c from public.contracts where id=split_part(n.event_key,':',2)::uuid;select * into v from public.vehicles where id=c.vehicle_id;select * into d from public.drivers where id=c.driver_id;
  if c.id is null then return null;end if;
  if n.kind='contract_activated' then
   due_day:=case when c.payment_frequency='weekly' then c.first_payment_date+(7-extract(isodow from c.first_payment_date)::int) else c.first_payment_date end;
   select count(*)*(c.daily_lolc+c.daily_gml) into due_amount from generate_series(c.first_payment_date::timestamp,least(due_day,c.end_date)::timestamp,interval '1 day')g(day) where extract(isodow from day)::int=any(c.operating_days) and not day::date=any(c.excluded_dates);
   t:='gml_contrat_active_fr';p:=jsonb_build_array(a.name,c.signed_reference,v.model,v.plate,to_char(c.start_date,'DD/MM/YYYY'),to_char(due_day,'DD/MM/YYYY'),case when c.payment_frequency='weekly' then 'Hebdomadaire' else 'Quotidien' end,due_amount::text,c.currency);
  elsif n.kind='owner_assignment' then
   select * into m from public.fleet_mandates where vehicle_id=v.id and status='active';r:=private.owner_financial_recap(a.id,c.start_date);
   t:='gml_proprietaire_mise_exploitation_fr';p:=jsonb_build_array(a.name,v.model,v.plate,to_char(c.start_date,'DD/MM/YYYY'),m.reference,r->>'remaining',r->>'next_deduction',r->>'next_period',r->>'owner_target',r->>'projected_net',d.full_name);
  else
   select * into adv from public.vehicle_advances where id=split_part(n.event_key,':',4)::uuid;
   select coalesce(sum(x.amount),0) into paid from public.advance_recoveries x join public.advance_instalments ai on ai.id=x.instalment_id where ai.advance_id=adv.id;
   if adv.recovery_deadline<(now() at time zone 'Africa/Kinshasa')::date and adv.total>paid then return null;end if;
   t:='gml_proprietaire_recap_avance_fr';p:=jsonb_build_array(adv.description,adv.principal::text,adv.fee::text,adv.total::text,(adv.total-paid)::text,adv.months::text,to_char(adv.recovery_deadline,'DD/MM/YYYY'),adv.approval_reference);
  end if;
 elsif n.kind='owner_settlement' and n.event_key ~ '^owner-settlement:[0-9a-f-]{36}' then
  select * into os from public.owner_settlements where id=split_part(n.event_key,':',2)::uuid;select * into m from public.fleet_mandates where id=os.mandate_id;select * into v from public.vehicles where id=m.vehicle_id;
  t:='gml_proprietaire_paiement_mensuel_fr';p:=jsonb_build_array(a.name,v.model,v.plate,to_char(os.period_start,'MM/YYYY'),os.owner_gross::text,os.recovered::text,os.owner_net::text,to_char(os.paid_on,'DD/MM/YYYY'),os.payment_reference);
 elsif n.kind in('appointment','appointment_cancelled') then
  if n.appointment_id is not null then select * into ap from public.appointments where id=n.appointment_id;elsif n.event_key ~ '^appointment:[0-9a-f-]{36}' then select * into ap from public.appointments where id=split_part(n.event_key,':',2)::uuid;end if;
  if ap.id is null or not ap.sms_requested then return null;end if;
  reference:=case ap.purpose when 'account' then 'Ouverture du compte LOLC' when 'driving_test' then 'Entretien et test de conduite' when 'vehicle_inspection' then 'Inspection du véhicule propriétaire' when 'vehicle_purchase' then 'Achat et réception du véhicule' when 'handover' then 'Remise du véhicule' when 'installation' then 'Installation des équipements' when 'meeting' then 'Échange avec GM Fleet' else ap.purpose end;
  if n.kind='appointment' then t:='gml_rendez_vous_confirmation_fr';p:=jsonb_build_array(a.name,reference,to_char(ap.starts_at at time zone 'Africa/Kinshasa','DD/MM/YYYY'),to_char(ap.starts_at at time zone 'Africa/Kinshasa','HH24:MI'),ap.location,a.case_reference);
  else t:='gml_rendez_vous_annule_fr';p:=jsonb_build_array(a.name,reference,to_char(ap.starts_at at time zone 'Africa/Kinshasa','DD/MM/YYYY'),to_char(ap.starts_at at time zone 'Africa/Kinshasa','HH24:MI'),a.case_reference);end if;
 elsif n.kind in('application_received','accepted','rejected') then
  t:=case n.kind when 'application_received' then 'gml_candidature_recue_fr' when 'accepted' then 'gml_dossier_retenu_fr' else 'gml_dossier_refuse_fr' end;
  p:=jsonb_build_array(a.name,a.case_reference,case when n.kind='rejected' then a.review_reason else pr end);
  if n.kind='application_received' then p:=jsonb_build_array(a.name,pr,a.case_reference);end if;
 elsif n.kind='case_milestone' then
  kind:=case when a.lolc_status='information_required' then 'information_required' when a.lolc_status='rejected' then 'lolc_rejected' when a.program_type='DRIVE_TO_OWN' and a.process_step='sourcing' then 'lolc_approved' when a.program_type='DRIVE_TO_OWN' and a.process_step='documents' then 'equipment_completed' when a.program_type='DRIVE_TO_OWN' and a.process_step='handover' then 'handover' when a.program_type='PARTNER_DRIVER' and a.process_step='allocation' then 'allocation' when a.program_type='YANGO' and a.process_step='joined' then 'yango_joined' end;
  t:=case kind when 'lolc_approved' then 'gml_lolc_accord_fr' when 'information_required' then 'gml_lolc_complement_fr' when 'lolc_rejected' then 'gml_lolc_refus_fr' when 'equipment_completed' then 'gml_equipements_installes_fr' when 'handover' then 'gml_vehicule_remis_fr' when 'allocation' then 'gml_chauffeur_pret_affectation_fr' when 'yango_joined' then 'gml_yango_rattachement_fr' end;
  p:=jsonb_build_array(a.name,a.case_reference);
  if kind='information_required' then p:=p||jsonb_build_array(a.preparation->'last_decision'->>'notes');end if;
  if kind='equipment_completed' then p:=jsonb_build_array(a.name,case a.preparation->'equipment'->>'equipment_package' when 'tracker' then 'Tracker GPS' when 'tracker_camera' then 'Tracker GPS et caméra' end,a.case_reference);end if;
  if kind='handover' then p:=jsonb_build_array(a.name,a.preparation->'purchased_vehicle'->>'model',a.preparation->'purchased_vehicle'->>'plate',a.preparation->>'handover_on',a.case_reference);end if;
 elsif n.kind in('equipment_received','admin_intake') and n.quote_id is not null then
  select * into q from public.equipment_quotes where id=n.quote_id;reference:=case q.payload->>'equipment' when 'gps' then 'Tracker GPS' when 'dashcam' then 'Dashcam' when 'both' then 'Tracker GPS et dashcam' end;
  if n.kind='equipment_received' then t:='gml_devis_recu_fr';p:=jsonb_build_array(q.payload->>'name',reference,q.id::text);else t:='gml_devis_admin_fr';p:=jsonb_build_array(q.id::text,q.payload->>'name',reference);end if;
 elsif n.kind='admin_intake' and a.id is not null then t:='gml_candidature_admin_fr';p:=jsonb_build_array(a.case_reference,a.name,pr,a.vehicle);
 elsif n.kind='contract_copy' then
  select signed_reference into reference from public.contracts where application_id=a.id and status='active' order by created_at desc limit 1;
  if a.program_type='FLEET_OWNER' then select fm.reference into reference from public.fleet_mandates fm join public.vehicles vv on vv.id=fm.vehicle_id where vv.owner_application_id=a.id and fm.status<>'ended' order by fm.created_at desc limit 1;end if;
  t:='gml_copie_contrat_fr';p:=jsonb_build_array(a.name,reference,'');rt:='link';rp:=3;
 elsif n.kind='staff_invitation' then
  select * into staff from public.staff_members where active and deleted_at is null and private.normalize_driver_phone(phone)=private.normalize_driver_phone(n.recipient) limit 1;
  if (select count(*) from public.staff_members where active and deleted_at is null and private.normalize_driver_phone(phone)=private.normalize_driver_phone(n.recipient))<>1 then staff:=null;end if;
  t:='gml_compte_equipe_invitation_fr';p:=jsonb_build_array(staff.display_name,staff.role,'');rt:='link';rp:=3;
 end if;
 if t is null then return null;end if;
 if not exists(select 1 from private.whatsapp_templates where name=t and parameter_count=jsonb_array_length(p)) then return null;end if;
 if exists(select 1 from jsonb_array_elements(p) with ordinality x(value,position) where (value='null'::jsonb or length(value#>>'{}')=0) and position<>coalesce(rp,0)) then
  if n.kind<>'staff_invitation' then return null;end if;
 end if;
 return jsonb_build_object('template',t,'parameters',p,'runtime_kind',rt,'runtime_position',rp);
end $$;
revoke all on function private.whatsapp_snapshot(public.sms_dispatches) from public,anon,authenticated;

create function private.capture_whatsapp_payload() returns trigger language plpgsql security definer set search_path='' as $$
declare j jsonb;begin
 if new.channel_decided or new.event_key like '%:sms' then return new;end if;
 j:=private.whatsapp_snapshot(new);if j is null then return new;end if;
 insert into private.whatsapp_payloads(sms_id,template_name,parameters,runtime_kind,runtime_position) values(new.id,j->>'template',j->'parameters',j->>'runtime_kind',(j->>'runtime_position')::int);
 update public.sms_dispatches set whatsapp_template=j->>'template' where id=new.id;return new;
exception when others then
 -- Notification enrichment must never roll back a recorded payment or dossier action.
 raise warning 'WhatsApp template enrichment unavailable (%)',sqlstate;return new;
end $$;
revoke all on function private.capture_whatsapp_payload() from public,anon,authenticated;
create trigger capture_whatsapp_payload after insert on public.sms_dispatches for each row execute function private.capture_whatsapp_payload();

create function private.whatsapp_sms_fallback(parent_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare n public.sms_dispatches;f public.sms_dispatches;
begin
 select * into n from public.sms_dispatches where id=parent_id for update;
 if n.channel<>'whatsapp' or n.status<>'failed' then return null;end if;
 insert into public.sms_dispatches(event_key,kind,recipient,body,sensitive,application_id,appointment_id,quote_id,notification_id,actor_id,channel,channel_decided,fallback_of)
 values(n.event_key||':sms',n.kind,n.recipient,n.body,n.sensitive,n.application_id,n.appointment_id,n.quote_id,n.notification_id,n.actor_id,'sms',true,n.id) on conflict do nothing;
 select * into f from public.sms_dispatches where fallback_of=n.id;return to_jsonb(f);
end $$;
revoke all on function private.whatsapp_sms_fallback(uuid) from public,anon,authenticated;

create or replace function private.claim_sms_dispatch(p jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare n public.sms_dispatches;use_wa boolean:=false;
begin
 if not coalesce((select enabled from private.sms_transport_config where singleton),false) then return null;end if;
 update public.sms_dispatches set status='cancelled',error='Délai d’envoi dépassé : contacter le client directement' where status='pending' and created_at<=now()-interval '48 hours';
 update public.sms_dispatches s set status='cancelled',error='Rendez-vous clôturé : notification non envoyée' where s.status='pending' and s.appointment_id is not null and not exists(select 1 from public.appointments ap where ap.id=s.appointment_id and ap.status in('scheduled','confirmed') and ap.sms_requested);
 update public.sms_dispatches set status='unknown',error='Envoi interrompu : vérifier avant tout nouvel envoi' where status='sending' and started_at<now()-interval '5 minutes';
 select * into n from public.sms_dispatches q where (case when p?'id' then q.id=(p->>'id')::uuid else not q.sensitive end) and (q.status='pending' or (coalesce((p->>'retry')::boolean,false) and q.channel='sms' and q.status in('failed','not_configured') and q.attempts<3)) and q.created_at>now()-interval '48 hours' order by q.created_at for update skip locked limit 1;
 if n.id is null then return null;end if;
 if not n.channel_decided and n.fallback_of is null then
  use_wa:=coalesce((p->>'whatsapp_enabled')::boolean,false) and (select enabled from private.sms_transport_config where singleton)
   and n.whatsapp_template is not null and coalesce(p->'approved_templates','[]'::jsonb)?n.whatsapp_template
   and exists(select 1 from private.whatsapp_contacts where phone=private.normalize_driver_phone(n.recipient) and opted_in)
   and exists(select 1 from private.whatsapp_tests t join public.sms_dispatches x on x.id=t.sms_id where not t.force_failure and x.read_at is not null)
   and exists(select 1 from private.whatsapp_tests t join public.sms_dispatches x on x.fallback_of=t.sms_id where t.force_failure and x.status in('accepted','sent','delivered'));
  if n.kind='whatsapp_test' then use_wa:=coalesce((p->>'whatsapp_test')::boolean,false) and exists(select 1 from private.whatsapp_tests where sms_id=n.id and authorized_until>now()) and (select enabled from private.sms_transport_config where singleton);end if;
  update public.sms_dispatches set channel=case when use_wa then 'whatsapp' else 'sms' end,channel_decided=true where id=n.id;
 end if;
 update public.sms_dispatches set status='sending',attempts=attempts+1,started_at=now(),error=null where id=n.id returning * into n;
 if n.notification_id is not null then update public.operations_notifications set delivery_channel=n.channel,delivery_status='sending' where id=n.notification_id;end if;
 return to_jsonb(n);
end $$;

create function private.get_whatsapp_payload(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare n public.sms_dispatches;x private.whatsapp_payloads;j jsonb;begin
 select * into n from public.sms_dispatches where id=(p->>'id')::uuid;
 select * into x from private.whatsapp_payloads where sms_id=coalesce(n.fallback_of,n.id);
 if x.sms_id is null then return null;end if;
 if n.channel='whatsapp' and n.kind<>'whatsapp_test' and (not(select enabled from private.sms_transport_config where singleton) or not exists(select 1 from private.whatsapp_contacts where phone=private.normalize_driver_phone(n.recipient) and opted_in)) then return null;end if;
 if n.kind='staff_invitation' and x.ciphertext is null then j:=private.whatsapp_snapshot(n);if j is not null then x.parameters:=j->'parameters';end if;end if;
 return jsonb_build_object('template',x.template_name,'parameters',x.parameters,'runtime_kind',x.runtime_kind,'runtime_position',x.runtime_position,'ciphertext',x.ciphertext,'expires_at',x.expires_at,'source_id',x.sms_id,'parameter_count',coalesce((select parameter_count from private.whatsapp_templates where name=x.template_name),case when n.kind='whatsapp_test' then 3 end));
end $$;
create function private.save_whatsapp_runtime(p jsonb) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if length((p->'ciphertext')::text)>64000 or p->'ciphertext'->>'iv' is null or p->'ciphertext'->>'data' is null then raise exception 'Enveloppe invalide';end if;
 update private.whatsapp_payloads x set ciphertext=p->'ciphertext',expires_at=least(now()+interval '48 hours',(p->>'expires_at')::timestamptz) where sms_id=(p->>'id')::uuid and exists(select 1 from public.sms_dispatches n where n.id=x.sms_id and n.channel='whatsapp' and n.status='sending');
 return found;
end $$;
create function private.finish_whatsapp_dispatch(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare n public.sms_dispatches;f jsonb;st text:=p->>'status';begin
 if st not in('accepted','failed','unknown') then raise exception 'État WhatsApp invalide';end if;
 select * into n from public.sms_dispatches where id=(p->>'id')::uuid for update;
 if n.channel<>'whatsapp' or n.status<>'sending' then return to_jsonb(n);end if;
 if st='accepted' and (p->>'wamid' is null or length(p->>'wamid') not between 8 and 300) then raise exception 'Identifiant WhatsApp requis';end if;
 update public.sms_dispatches set status=st,whatsapp_message_id=p->>'wamid',meta_error_code=(p->>'error_code')::int,error=case when st='unknown' then 'Réponse WhatsApp inconnue : ne pas renvoyer' when st='failed' then 'WhatsApp refusé : code '||coalesce(p->>'error_code','inconnu') end,submitted_at=case when st='accepted' then now() else submitted_at end where id=n.id returning * into n;
 if st='failed' then f:=private.whatsapp_sms_fallback(n.id);end if;
 if n.notification_id is not null then update public.operations_notifications set delivery_channel='whatsapp',delivery_status=st,delivery_error=n.error where id=n.notification_id;end if;
 return to_jsonb(n)||jsonb_build_object('fallback',f);
end $$;
create function private.record_whatsapp_statuses(p jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare s jsonb;n public.sms_dispatches;st text;at_time timestamptz;updated int:=0;begin
 for s in select value from jsonb_array_elements(p->'statuses') loop
  select * into n from public.sms_dispatches where whatsapp_message_id=s->>'wamid' and channel='whatsapp' for update;
  if n.id is null or regexp_replace(n.recipient,'[^0-9]','','g')<>regexp_replace(s->>'recipient','[^0-9]','','g') then continue;end if;
  st:=s->>'status';at_time:=(s->>'at')::timestamptz;
  if st not in('sent','delivered','read','failed') or n.status in('failed','cancelled') then continue;end if;
  if st='failed' and n.status in('delivered','read') then continue;end if;
  if st<>'failed' and (case n.status when 'read' then 4 when 'delivered' then 3 when 'sent' then 2 else 1 end)>=(case st when 'read' then 4 when 'delivered' then 3 else 2 end) then continue;end if;
  update public.sms_dispatches set status=st,whatsapp_status_at=greatest(coalesce(whatsapp_status_at,at_time),at_time),delivered_at=case when st in('delivered','read') then coalesce(delivered_at,at_time) else delivered_at end,read_at=case when st='read' then at_time else read_at end,meta_error_code=case when st='failed' then (s->>'error_code')::int else meta_error_code end,error=case when st='failed' then 'WhatsApp non livré : code '||coalesce(s->>'error_code','inconnu') else null end where id=n.id;
  if st='failed' then perform private.whatsapp_sms_fallback(n.id);end if;
  if n.notification_id is not null then update public.operations_notifications set delivery_channel='whatsapp',delivery_status=st where id=n.notification_id and not exists(select 1 from public.sms_dispatches where fallback_of=n.id and status in('sending','accepted','sent','delivered'));end if;
  updated:=updated+1;
 end loop;insert into public.mobile_bridge_events(action,outcome) values('whatsapp_status','updated:'||updated);return updated;
end $$;

create function private.authorize_whatsapp_test(ph text,source text,force_failure boolean default false,request_uuid uuid default gen_random_uuid()) returns jsonb language plpgsql security definer set search_path='' as $$
declare tid uuid:=request_uuid;sid uuid;existing private.whatsapp_tests;phone text:='+'||private.normalize_driver_phone(ph);name text;begin
 if tid is null then raise exception 'Identifiant requis';end if;
 perform pg_advisory_xact_lock(hashtextextended(tid::text,0));select * into existing from private.whatsapp_tests where id=tid;if found then if existing.phone<>phone or existing.reference<>source or existing.force_failure<>force_failure then raise exception 'Commande différente';end if;return jsonb_build_object('id',tid,'sms_id',existing.sms_id,'recipient',phone);end if;
 if phone is null or length(source)<3 then raise exception 'Numéro et autorisation requis';end if;
 name:=case when force_failure then 'GMFLEET_INVALID_TEMPLATE_TEST' else 'gml_candidature_recue_fr' end;
 insert into private.whatsapp_tests(id,phone,reference,force_failure,authorized_until,created_by) values(tid,phone,source,force_failure,now()+interval '1 hour',auth.uid());
 insert into public.sms_dispatches(event_key,kind,recipient,body,actor_id) values('whatsapp-test:'||tid,'whatsapp_test',phone,'TEST GM Fleet : vérification du repli SMS WhatsApp. Aucun dossier ni paiement réel.',auth.uid()) returning id into sid;
 update public.sms_dispatches set whatsapp_template=name where id=sid;update private.whatsapp_tests set sms_id=sid where id=tid;
 insert into private.whatsapp_payloads(sms_id,template_name,parameters) values(sid,name,jsonb_build_array('TEST TECHNIQUE','Test WhatsApp sans candidature','TEST-WA-'||left(tid::text,8)));
 return jsonb_build_object('id',tid,'sms_id',sid,'recipient',phone);
end $$;
revoke all on function private.authorize_whatsapp_test(text,text,boolean,uuid) from public,anon,authenticated,service_role;

create function private.cancel_whatsapp_notification(p jsonb) returns boolean language plpgsql security definer set search_path='' as $$
begin update public.sms_dispatches set status='cancelled',error=left(p->>'reason',200) where id=(p->>'id')::uuid and (fallback_of is not null or kind='whatsapp_test') and status in('pending','sending');return found;end $$;

create function private.whatsapp_health() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 return jsonb_build_object('contacts',(select count(*) from private.whatsapp_contacts where opted_in),'test_read_at',(select max(n.read_at) from private.whatsapp_tests t join public.sms_dispatches n on n.id=t.sms_id where not t.force_failure),'fallback_count',(select count(*) from private.whatsapp_tests t join public.sms_dispatches n on n.fallback_of=t.sms_id where t.force_failure),'recent',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from(select id,event_key,channel,status,whatsapp_message_id,meta_error_code,read_at from public.sms_dispatches where channel='whatsapp' order by created_at desc limit 10)x));
end $$;
do $$declare f text;begin foreach f in array array['get_whatsapp_payload','save_whatsapp_runtime','finish_whatsapp_dispatch','record_whatsapp_statuses','cancel_whatsapp_notification'] loop
 execute format('create function public.%I(p jsonb) returns %s language sql security invoker set search_path='''' as %L',f,case when f='record_whatsapp_statuses' then 'integer' when f in('save_whatsapp_runtime','cancel_whatsapp_notification') then 'boolean' else 'jsonb' end,'select private.'||f||'(p)');
 execute format('revoke all on function private.%I(jsonb),public.%I(jsonb) from public,anon,authenticated',f,f);execute format('grant execute on function private.%I(jsonb),public.%I(jsonb) to service_role',f,f);
end loop;end $$;
create function public.whatsapp_health() returns jsonb language sql security invoker set search_path='' as $$select private.whatsapp_health();$$;
revoke all on function private.whatsapp_health(),public.whatsapp_health() from public,anon,authenticated;
grant execute on function private.whatsapp_health(),public.whatsapp_health() to service_role;
grant select on private.whatsapp_contacts,private.whatsapp_tests to service_role;
grant execute on function private.normalize_driver_phone(text) to service_role;

create function private.set_whatsapp_consent(p jsonb) returns boolean language plpgsql security definer set search_path='' as $$
declare ph text:=private.normalize_driver_phone(p->>'phone');actor uuid:=auth.uid();r private.whatsapp_commands;begin
 if actor is null or not exists(select 1 from public.staff_members where user_id=actor and active and deleted_at is null and role in('admin','super_admin')) then raise exception 'Accès administrateur requis';end if;
 if ph is null or length(trim(coalesce(p->>'source',''))) not between 3 and 1000 or p->>'request_id' is null then raise exception 'Numéro, preuve du consentement et commande requis';end if;
 insert into private.whatsapp_commands values((p->>'request_id')::uuid,actor,p) on conflict do nothing;select * into r from private.whatsapp_commands where request_id=(p->>'request_id')::uuid for update;
 if r.actor_id<>actor or r.payload<>p then raise exception 'Identifiant déjà utilisé';end if;
 if exists(select 1 from public.finance_events where action='whatsapp_consent' and details->>'request_id'=p->>'request_id') then return true;end if;
 insert into private.whatsapp_contacts(phone,opted_in,source,updated_by) values(ph,(p->>'opted_in')::boolean,trim(p->>'source'),actor) on conflict(phone) do update set opted_in=excluded.opted_in,source=excluded.source,updated_by=actor,updated_at=now();
 insert into public.finance_events(actor_id,action,entity_id,details) values(actor,'whatsapp_consent',ph,p);return true;
end $$;
create function public.set_whatsapp_consent(p jsonb) returns boolean language sql security invoker set search_path='' as $$select private.set_whatsapp_consent(p);$$;
revoke all on function private.set_whatsapp_consent(jsonb),public.set_whatsapp_consent(jsonb) from public,anon;
grant execute on function private.set_whatsapp_consent(jsonb),public.set_whatsapp_consent(jsonb) to authenticated;

create function private.create_own_whatsapp_test(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare ph text;begin
 select phone into ph from public.staff_members where user_id=auth.uid() and active and deleted_at is null and role in('admin','super_admin');
 if ph is null or not coalesce((p->>'consent')::boolean,false) then raise exception 'Compte administrateur avec téléphone et autorisation de test requis';end if;
 return private.authorize_whatsapp_test(ph,'Test WhatsApp autorisé sur mon numéro équipe',coalesce((p->>'force_failure')::boolean,false),(p->>'request_id')::uuid);
end $$;
create function public.create_own_whatsapp_test(p jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.create_own_whatsapp_test(p);$$;
revoke all on function private.create_own_whatsapp_test(jsonb),public.create_own_whatsapp_test(jsonb) from public,anon;
grant execute on function private.create_own_whatsapp_test(jsonb),public.create_own_whatsapp_test(jsonb) to authenticated;

-- Future events only. Never sweep or resend historical accepted messages.
do $patch$declare definition text;begin
 definition:=pg_get_functiondef('private.invoke_sms_worker()'::regprocedure);
 definition:=replace(definition,'if not(select enabled','update private.whatsapp_payloads set ciphertext=null where expires_at<=now(); if not(select enabled');
 definition:=replace(definition,'not sensitive or kind=''driver_payment_reminder''','not sensitive or kind=''driver_payment_reminder'' or fallback_of is not null');execute definition;
end $patch$;
notify pgrst,'reload schema';
commit;
