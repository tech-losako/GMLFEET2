begin;
alter table public.contracts drop constraint contracts_status_check;
alter table public.contracts add constraint contracts_status_check check(status in('active','void','ended'));
alter table public.contracts add column ended_on date,add column end_reason text,add column notifications_stopped boolean not null default false;
create table public.driver_assignment_endings(
 id uuid primary key default gen_random_uuid(),contract_id uuid not null unique references public.contracts(id),request_id uuid not null unique,
 actor_id uuid not null references public.staff_members(user_id),returned_on date not null,reason text not null,
 inspection_notes text not null,vehicle_status text not null check(vehicle_status in('Disponible','Maintenance')),
 command_payload jsonb not null,previous_schedule jsonb not null,remaining_debt numeric not null,created_at timestamptz not null default now()
);
create index driver_assignment_endings_actor on public.driver_assignment_endings(actor_id);
alter table public.driver_assignment_endings enable row level security;
revoke all on public.driver_assignment_endings from public,anon,authenticated;
grant select on public.driver_assignment_endings to authenticated;
create policy staff_read_driver_endings on public.driver_assignment_endings for select to authenticated using((select private.is_staff()));
create table private.notification_suppressions(
 phone text primary key,contract_id uuid not null references public.contracts(id),reason text not null,created_by uuid not null references public.staff_members(user_id),created_at timestamptz not null default now()
);
alter table private.notification_suppressions enable row level security;
revoke all on private.notification_suppressions from public,anon,authenticated;
create policy suppression_service_access on private.notification_suppressions for select to service_role using(true);
create function private.guard_suppressed_notification() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status in('pending','sending') and exists(select 1 from private.notification_suppressions s where s.phone=private.normalize_driver_phone(new.recipient)) then
  if new.status='sending' then raise exception 'Notifications suspendues pour ce destinataire';end if;
  new.status:='cancelled';new.error:='Notifications suspendues après fin d’affectation';
 end if;
 return new;
end $$;
create trigger a_suppressed_notification before insert or update of status,recipient on public.sms_dispatches for each row execute function private.guard_suppressed_notification();
create function private.end_driver_assignment(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.contracts;d public.drivers;v public.vehicles;prev public.driver_assignment_endings;rdate date;reason text;notes text;vstatus text;before_rows jsonb;debt numeric;phone text;rid uuid;cancelled_count integer;
begin
 if not exists(select 1 from public.staff_members where user_id=auth.uid() and active and deleted_at is null and role in('admin','super_admin')) then raise exception 'Fin d’affectation réservée aux administrateurs';end if;
 rid:=(p->>'request_id')::uuid;if rid is null then raise exception 'Identifiant de requête requis';end if;
 perform pg_advisory_xact_lock(hashtextextended(rid::text,19));
 select * into prev from public.driver_assignment_endings where request_id=rid;
 if found then if prev.command_payload<>p or prev.actor_id<>auth.uid() then raise exception 'Requête réutilisée avec des valeurs différentes';end if;return jsonb_build_object('id',prev.id,'remaining_debt',prev.remaining_debt,'returned_on',prev.returned_on);end if;
 select * into c from public.contracts where id=(p->>'contract_id')::uuid for update;
 if not found or c.status<>'active' or c.contract_type<>'PARTNER_DRIVER' then raise exception 'Affectation chauffeur partenaire active requise';end if;
 rdate:=(p->>'returned_on')::date;reason:=btrim(p->>'reason');notes:=btrim(p->>'inspection_notes');vstatus:=p->>'vehicle_status';
 if rdate is null or rdate<c.start_date or rdate>least(c.end_date,(now() at time zone 'Africa/Kinshasa')::date) then raise exception 'Date réelle de restitution invalide';end if;
 if coalesce(length(reason),0) not between 3 and 1000 or coalesce(length(notes),0) not between 3 and 2000 or (p->>'inspection_confirmed')::boolean is distinct from true or vstatus is null or vstatus not in('Disponible','Maintenance') or (p->>'stop_notifications')::boolean is distinct from true then raise exception 'Motif, contrôle de restitution, disponibilité et arrêt des notifications requis';end if;
 select * into v from public.vehicles where id=c.vehicle_id for update;
 select * into d from public.drivers where id=c.driver_id for update;
 if exists(select 1 from public.contracts where id<>c.id and status='active' and (vehicle_id=c.vehicle_id or driver_id=c.driver_id)) then raise exception 'Autre affectation active : vérifier avant de clôturer';end if;
 if not exists(select 1 from public.vehicle_assignments where contract_id=c.id and end_date is null) then raise exception 'Affectation ouverte introuvable';end if;
 if exists(select 1 from public.payment_allocations pa join public.repayment_schedules s on s.id=pa.schedule_id where s.contract_id=c.id and s.due_on>rdate group by s.id having sum(pa.amount)<>0) then raise exception 'Échéances après restitution déjà réglées : rapprocher les paiements avant la clôture';end if;
 select coalesce(jsonb_agg(to_jsonb(s) order by due_on),'[]') into before_rows from public.repayment_schedules s where contract_id=c.id and due_on>rdate;
 -- Keep schedule IDs, original signed totals, all payments and repair advances. Only unearned service charges stop.
 update public.repayment_schedules set gml_due=additional_gml_due,lolc_due=0 where contract_id=c.id and due_on>rdate;
 select coalesce(sum(gml_due+lolc_due),0)-coalesce((select sum(pa.amount) from public.payment_allocations pa join public.repayment_schedules s on s.id=pa.schedule_id where s.contract_id=c.id),0) into debt from public.repayment_schedules where contract_id=c.id;
 update public.contracts set status='ended',ended_on=rdate,end_reason=reason,notifications_stopped=true where id=c.id;
 update public.vehicle_assignments set end_date=rdate,reason_ended=reason where contract_id=c.id and end_date is null;
 update public.vehicles set status=vstatus,driver=null where id=v.id;
 update public.drivers set status='suspended' where id=d.id;
 phone:=private.normalize_driver_phone(d.phone);if phone is null or phone='' then raise exception 'Téléphone du chauffeur invalide';end if;
 insert into private.notification_suppressions(phone,contract_id,reason,created_by) values(phone,c.id,reason,auth.uid()) on conflict on constraint notification_suppressions_pkey do nothing;
 update public.sms_dispatches set status='cancelled',error='Notifications suspendues après fin d’affectation' where private.normalize_driver_phone(recipient)=phone and status='pending';get diagnostics cancelled_count=row_count;
 insert into public.driver_assignment_endings(contract_id,request_id,actor_id,returned_on,reason,inspection_notes,vehicle_status,command_payload,previous_schedule,remaining_debt) values(c.id,rid,auth.uid(),rdate,reason,notes,vstatus,p,before_rows,debt) returning * into prev;
 insert into public.finance_events(actor_id,action,entity_id,details) values(auth.uid(),'driver_assignment_ended',c.id::text,p||jsonb_build_object('remaining_debt',debt,'cancelled_notifications',cancelled_count));
 insert into public.audit_logs(application_id,actor_id,entity,action,changes) values(c.application_id,auth.uid(),'driver_assignment','ended',jsonb_build_object('contract_id',c.id,'returned_on',rdate,'reason',reason,'remaining_debt',debt,'notifications_stopped',true));
 return jsonb_build_object('id',prev.id,'remaining_debt',debt,'returned_on',rdate);
end $$;
create function public.end_driver_assignment(p jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.end_driver_assignment(p)$$;
revoke all on function public.end_driver_assignment(jsonb),private.end_driver_assignment(jsonb) from public,anon;
grant execute on function public.end_driver_assignment(jsonb),private.end_driver_assignment(jsonb) to authenticated;
revoke all on function private.guard_suppressed_notification() from public,anon,authenticated;
-- A cashier can collect the preserved debt; ending service never waives money owed.
do $$declare def text;begin
 def:=pg_get_functiondef('private.confirm_cash_payment(jsonb)'::regprocedure);
 if position('c.status<>''active''' in def)=0 then raise exception 'Cashier guard changed: review migration';end if;
 def:=replace(def,'c.status<>''active''','c.status not in (''active'',''ended'')');execute def;
end $$;
create function private.guard_replacement_driver() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.vehicles where id=new.vehicle_id for update;
 if exists(select 1 from public.contracts where driver_id=new.driver_id and status='ended') or exists(select 1 from public.drivers where id=new.driver_id and status='suspended') or exists(select 1 from public.applications a join private.notification_suppressions s on s.phone=private.normalize_driver_phone(a.phone) where a.id=new.application_id) then raise exception 'Ce chauffeur a quitté la flotte : son dossier doit rester dans l’historique';end if;
 if exists(select 1 from public.vehicle_assignments where vehicle_id=new.vehicle_id and end_date>=new.start_date) then raise exception 'Le début doit suivre la restitution de l’ancien chauffeur';end if;
 return new;
end $$;
create trigger a_replacement_driver_guard before insert on public.contracts for each row execute function private.guard_replacement_driver();
revoke all on function private.guard_replacement_driver() from public,anon,authenticated;
commit;
