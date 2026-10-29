begin;
create table public.sms_dispatches(
 id uuid primary key default gen_random_uuid(),event_key text not null unique check(length(event_key)<=240),kind text not null,
 recipient text not null,body text, sensitive boolean not null default false, payload_hash text,
 application_id bigint references public.applications(id) on delete set null,appointment_id uuid references public.appointments(id) on delete set null,
 quote_id uuid references public.equipment_quotes(id) on delete set null,notification_id bigint references public.operations_notifications(id) on delete set null,
 actor_id uuid references auth.users(id),status text not null default 'pending' check(status in('pending','sending','accepted','sent','delivered','failed','unknown','not_configured','cancelled')),
 attempts integer not null default 0,provider_message_id text,provider_code integer,error text,sandbox boolean not null default false,
 created_at timestamptz not null default now(),started_at timestamptz,submitted_at timestamptz,delivered_at timestamptz,
 check(not sensitive or body is null)
);
create index sms_pending_idx on public.sms_dispatches(created_at) where status='pending';
create unique index sms_provider_id_idx on public.sms_dispatches(provider_message_id) where provider_message_id is not null;
alter table public.sms_dispatches enable row level security;
revoke all on public.sms_dispatches from anon,authenticated;
grant select on public.sms_dispatches to authenticated;
create policy sms_admin_read on public.sms_dispatches for select to authenticated using(exists(select 1 from public.staff_members s where s.user_id=auth.uid() and s.active and s.deleted_at is null and s.role in('admin','super_admin')));
grant select,insert,update on public.sms_dispatches to service_role;
create table private.sms_transport_config(singleton boolean primary key default true check(singleton),enabled boolean not null default false,callback_token text not null default(replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','')),worker_token text not null default(replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','')));
insert into private.sms_transport_config(singleton) values(true);
create table private.sms_delivery_reports(message_id text primary key,phone text,status text not null,reason text,received_at timestamptz not null default now());
alter table private.sms_transport_config enable row level security;
alter table private.sms_delivery_reports enable row level security;
revoke all on private.sms_transport_config,private.sms_delivery_reports from public,anon,authenticated;
grant select on private.sms_transport_config to service_role;
grant select,insert,update on private.sms_delivery_reports to service_role;
alter table public.operations_notifications drop constraint operations_notifications_delivery_status_check;
alter table public.operations_notifications add constraint operations_notifications_delivery_status_check check(delivery_status in('pending','sending','accepted','sent','delivered','failed','unknown','not_configured','cancelled'));

create function private.reserve_sms_dispatch(p jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare n public.sms_dispatches;
begin
 if length(p->>'event_key') not between 3 and 240 or length(p->>'kind') not between 2 and 80 or length(p->>'recipient') not between 5 and 40 then raise exception 'SMS invalide';end if;
 insert into public.sms_dispatches(event_key,kind,recipient,body,sensitive,payload_hash,application_id,appointment_id,quote_id,notification_id,actor_id)
 values(p->>'event_key',p->>'kind',p->>'recipient',case when coalesce((p->>'sensitive')::boolean,false) then null else p->>'body' end,coalesce((p->>'sensitive')::boolean,false),p->>'payload_hash',(p->>'application_id')::bigint,(p->>'appointment_id')::uuid,(p->>'quote_id')::uuid,(p->>'notification_id')::bigint,(p->>'actor_id')::uuid)
 on conflict(event_key) do nothing;
 select * into n from public.sms_dispatches where event_key=p->>'event_key';
 if n.recipient<>p->>'recipient' or n.kind<>p->>'kind' or (n.payload_hash is not null and n.payload_hash is distinct from p->>'payload_hash') then raise exception 'Cette demande SMS correspond a une autre operation';end if;
 return to_jsonb(n);
end $$;
create function public.reserve_sms_dispatch(p jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.reserve_sms_dispatch(p);$$;

create function private.claim_sms_dispatch(p jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare n public.sms_dispatches;
begin
 update public.sms_dispatches set status='cancelled',error='Délai d’envoi dépassé : contacter le client directement' where status='pending' and created_at<=now()-interval '48 hours';
 update public.sms_dispatches s set status='cancelled',error='Rendez-vous clôturé : SMS non envoyé' where s.status='pending' and s.appointment_id is not null and not exists(select 1 from public.appointments ap where ap.id=s.appointment_id and ap.status in('scheduled','confirmed'));
 update public.sms_dispatches set status='unknown',error='Envoi interrompu : vérifier avant de renvoyer' where status='sending' and started_at<now()-interval '5 minutes';
 update public.sms_dispatches s set status='sending',attempts=attempts+1,started_at=now(),error=null where s.id=(
  select q.id from public.sms_dispatches q where (case when p ? 'id' then q.id=(p->>'id')::uuid else not q.sensitive end)
  and (q.status='pending' or (coalesce((p->>'retry')::boolean,false) and q.status in('failed','not_configured') and q.attempts<3))
  and q.created_at>now()-interval '48 hours' order by q.created_at for update skip locked limit 1)
 returning s.* into n;
 return case when n.id is null then null else to_jsonb(n) end;
end $$;
create function public.claim_sms_dispatch(p jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.claim_sms_dispatch(p);$$;

create function private.finish_sms_dispatch(p jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare n public.sms_dispatches;r private.sms_delivery_reports;final_status text:=p->>'status';
begin
 if final_status not in('accepted','sent','delivered','failed','unknown','not_configured') then raise exception 'Etat SMS invalide';end if;
 select * into r from private.sms_delivery_reports where message_id=p->>'message_id';
 update public.sms_dispatches s set status=case when r.message_id is not null and (r.phone is null or r.phone=s.recipient) then r.status else final_status end,
 provider_message_id=coalesce(p->>'message_id',s.provider_message_id),provider_code=(p->>'code')::integer,error=coalesce(r.reason,p->>'error'),sandbox=coalesce((p->>'sandbox')::boolean,false),submitted_at=case when final_status in('accepted','sent','delivered') then now() else submitted_at end,
 delivered_at=case when r.status='delivered' then r.received_at else delivered_at end
 where s.id=(p->>'id')::uuid and s.status='sending' returning * into n;
 if n.notification_id is not null then update public.operations_notifications set delivery_status=n.status,provider_message_id=n.provider_message_id,delivery_error=n.error,delivery_attempts=n.attempts,sent_at=n.submitted_at where id=n.notification_id;end if;
 return to_jsonb(n);
end $$;
create function public.finish_sms_dispatch(p jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.finish_sms_dispatch(p);$$;

create function private.record_sms_delivery(p jsonb) returns boolean language plpgsql security invoker set search_path='' as $$
declare st text:=p->>'status';n public.sms_dispatches;ph text:=nullif(p->>'phone','');
begin
 if st not in('accepted','sent','delivered','failed') or length(p->>'message_id') not between 3 and 160 then raise exception 'Rapport SMS invalide';end if;
 insert into private.sms_delivery_reports(message_id,phone,status,reason) values(p->>'message_id',ph,st,p->>'reason') on conflict(message_id) do update set status=excluded.status,reason=excluded.reason,received_at=now() where private.sms_delivery_reports.status not in('delivered','failed');
 select * into n from public.sms_dispatches where provider_message_id=p->>'message_id' for update;
 if n.id is not null and (ph is null or ph=n.recipient) and n.status not in('delivered','failed') then
  update public.sms_dispatches set status=st,error=p->>'reason',delivered_at=case when st='delivered' then now() else delivered_at end where id=n.id;
 end if;
 update public.operations_notifications set delivery_status=st,delivery_error=p->>'reason' where provider_message_id=p->>'message_id' and (ph is null or recipient=ph) and coalesce(delivery_status,'') not in('delivered','failed');
 return true;
end $$;
create function public.record_sms_delivery(p jsonb) returns boolean language sql security invoker set search_path='' as $$select private.record_sms_delivery(p);$$;
create function private.sms_transport_configuration() returns jsonb language sql security invoker set search_path='' as $$select to_jsonb(c) from private.sms_transport_config c where singleton;$$;
create function public.sms_transport_configuration() returns jsonb language sql security invoker set search_path='' as $$select private.sms_transport_configuration();$$;
do $$declare n text;begin foreach n in array array['reserve_sms_dispatch(jsonb)','claim_sms_dispatch(jsonb)','finish_sms_dispatch(jsonb)','record_sms_delivery(jsonb)','sms_transport_configuration()'] loop execute 'revoke all on function public.'||n||',private.'||n||' from public,anon,authenticated';execute 'grant execute on function public.'||n||',private.'||n||' to service_role';end loop;end $$;
grant usage on schema private to service_role;

create function private.queue_sms(k text,t text,ph text,msg text,a bigint default null,ap uuid default null,q uuid default null,n bigint default null) returns void language plpgsql security definer set search_path='' as $$
begin
 if not (select enabled from private.sms_transport_config where singleton) then return;end if;
 insert into public.sms_dispatches(event_key,kind,recipient,body,application_id,appointment_id,quote_id,notification_id)
 values(k,t,coalesce(ph,''),msg,a,ap,q,n) on conflict(event_key) do nothing;
end $$;
revoke all on function private.queue_sms(text,text,text,text,bigint,uuid,uuid,bigint) from public,anon,authenticated;
create function private.queue_admin_sms(k text,msg text,a bigint default null,q uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare ph text;begin
 for ph in select distinct phone from public.staff_members where active and deleted_at is null and role in('admin','super_admin') and phone is not null loop
 perform private.queue_sms(k||':admin:'||ph,'admin_intake',ph,msg,a,null,q);end loop;
end $$;
revoke all on function private.queue_admin_sms(text,text,bigint,uuid) from public,anon,authenticated;
create function private.queue_case_notifications_sms() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.kind in('accepted','rejected','appointment') and new.channel='sms_draft' then
 perform private.queue_sms('notification:'||new.id,new.kind,new.recipient,new.body,new.application_id,new.appointment_id,new.quote_id,new.id);
 elsif new.kind='intake' and new.application_id is not null then
 perform private.queue_admin_sms('application:'||new.application_id,'GM Fleet : nouvelle candidature reçue. Ouvrez les opérations. Réf. DOSSIER-'||new.application_id,new.application_id);
 end if;return new;
end $$;
revoke all on function private.queue_case_notifications_sms() from public,anon,authenticated;
create trigger queue_case_sms after insert on public.operations_notifications for each row execute function private.queue_case_notifications_sms();
create function private.queue_application_receipt_sms() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.source='website' then perform private.queue_sms('application:'||new.id||':received','application_received',new.phone,'GM Fleet : demande '||new.case_reference||' reçue. Notre équipe examine votre dossier. Conservez votre récépissé.',new.id);end if;return new;
end $$;
revoke all on function private.queue_application_receipt_sms() from public,anon,authenticated;
create trigger queue_application_receipt after insert on public.applications for each row execute function private.queue_application_receipt_sms();
create function private.queue_equipment_receipt_sms() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform private.queue_sms('quote:'||new.id||':received','equipment_received',new.payload->>'phone','GM Fleet : demande de devis reçue. Un professionnel vous contactera pour confirmer votre besoin et planifier l’installation.',null,null,new.id);
 perform private.queue_admin_sms('quote:'||new.id,'GM Fleet : nouvelle demande de devis équipements. Ouvrez les opérations.',null,new.id);return new;
end $$;
revoke all on function private.queue_equipment_receipt_sms() from public,anon,authenticated;
create trigger queue_equipment_sms after insert on public.equipment_quotes for each row execute function private.queue_equipment_receipt_sms();
create function private.queue_case_milestone_sms() returns trigger language plpgsql security definer set search_path='' as $$
declare msg text;
begin
 if new.review_status<>'accepted' then return new;end if;
 if new.process_step is distinct from old.process_step then
 msg:=case when new.program_type='DRIVE_TO_OWN' and new.process_step='sourcing' then 'LOLC a approuvé votre dossier. GML poursuit l’identification du véhicule.'
 when new.program_type='DRIVE_TO_OWN' and new.process_step='documents' then 'L’installation des équipements est terminée. GML prépare les documents et la remise de votre véhicule.'
 when new.program_type='DRIVE_TO_OWN' and new.process_step='handover' then 'La remise de votre véhicule est enregistrée. Les dates de versement sont celles de votre contrat.'
 when new.program_type='PARTNER_DRIVER' and new.process_step='allocation' then 'Votre intégration est terminée. GML prépare votre affectation selon les véhicules disponibles.'
 when new.program_type='YANGO' and new.process_step='joined' then 'Votre rattachement à GM Fleet sur Yango est confirmé.' end;
 end if;
 if new.lolc_status is distinct from old.lolc_status and new.lolc_status in('information_required','rejected') then msg:=case when new.lolc_status='rejected' then 'LOLC n’a pas approuvé le financement. Contactez GML pour les explications.' else 'LOLC demande un complément à votre dossier. Contactez GML pour les pièces nécessaires.' end;end if;
 if msg is not null then perform private.queue_sms('case:'||new.id||':revision:'||new.revision,'case_milestone',new.phone,'GM Fleet - '||new.case_reference||' : '||msg,new.id);end if;return new;
end $$;
revoke all on function private.queue_case_milestone_sms() from public,anon,authenticated;
create trigger queue_milestone_sms after update on public.applications for each row execute function private.queue_case_milestone_sms();
create function private.queue_contract_sms() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.applications;v public.vehicles;o public.applications;
begin
 select * into a from public.applications where id=new.application_id;
 perform private.queue_sms('contract:'||new.id,'contract_activated',a.phone,'GM Fleet : contrat '||new.signed_reference||' activé. Premier versement le '||to_char(new.first_payment_date,'DD/MM/YYYY')||'. Montants et reçus : https://gmfleet.georgemichaellogistics.cd/payer.html',a.id);
 select * into v from public.vehicles where id=new.vehicle_id;
 if v.owner_application_id is not null then select * into o from public.applications where id=v.owner_application_id;perform private.queue_sms('contract:'||new.id||':owner','owner_assignment',o.phone,'GM Fleet : un chauffeur est affecté à votre véhicule. La mise en exploitation est enregistrée selon votre mandat.',o.id);end if;return new;
end $$;
revoke all on function private.queue_contract_sms() from public,anon,authenticated;
create trigger z_queue_contract_sms after insert on public.contracts for each row execute function private.queue_contract_sms();
create function private.queue_payment_sms() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.applications;c public.contracts;
begin
 select * into c from public.contracts where id=new.contract_id;select * into a from public.applications where id=c.application_id;if a.id is null then return new;end if;
 perform private.queue_sms('payment:'||new.id,'payment_receipt',a.phone,'GM Fleet : '||case when new.entry_kind='reversal' then 'contre-écriture enregistrée de ' else 'versement confirmé de ' end||new.amount||' '||c.currency||'. Réf. '||new.reference||'. Reçu : https://gmfleet.georgemichaellogistics.cd/payer.html',a.id);return new;
end $$;
revoke all on function private.queue_payment_sms() from public,anon,authenticated;
create trigger z_queue_payment_sms after insert on public.payments for each row execute function private.queue_payment_sms();

create function private.queue_appointment_cancellation_sms() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.applications;
begin
 if new.status='cancelled' and old.status in('scheduled','confirmed') then
 select * into a from public.applications where id=new.application_id;
 perform private.queue_sms('appointment:'||new.id||':cancelled','appointment_cancelled',a.phone,'GM Fleet - '||a.case_reference||' : votre rendez-vous du '||to_char(new.starts_at at time zone 'Africa/Kinshasa','DD/MM/YYYY à HH24:MI')||' est annulé. Contactez GML pour convenir de la suite.',a.id);
 end if;return new;
end $$;
revoke all on function private.queue_appointment_cancellation_sms() from public,anon,authenticated;
create trigger queue_appointment_cancellation after update of status on public.appointments for each row execute function private.queue_appointment_cancellation_sms();

-- No historical drafts are queued by this migration: only future business events.
commit;
