begin;
-- Reminder configuration and capabilities are private. No repayment rows are changed.
create table private.driver_reminder_settings(programme text primary key check(programme in('FLEET_OWNER','DRIVE_TO_OWN')),enabled boolean not null default true,send_time time not null default '18:00',saturday_time time not null default '08:00',check(send_time<'21:00' and saturday_time<'12:00'));
insert into private.driver_reminder_settings(programme) values('FLEET_OWNER'),('DRIVE_TO_OWN');
create table private.driver_reminder_preferences(driver_id uuid primary key references public.drivers(id),paused boolean not null default false,reason text not null,updated_by uuid not null references auth.users(id),updated_at timestamptz not null default now());
create table private.driver_reminder_opt_outs(phone text primary key check(phone ~ '^243[0-9]{9}$'),reason text not null,updated_by uuid not null references auth.users(id),updated_at timestamptz not null default now());
create table private.driver_payment_reminders(id uuid primary key default gen_random_uuid(),contract_id uuid not null references public.contracts(id),driver_id uuid not null references public.drivers(id),programme text not null references private.driver_reminder_settings(programme),kind text not null check(kind in('daily','weekly','saturday')),planned_day date not null,due_on date not null,event_key text not null unique,current_amount numeric(14,2) not null,arrears numeric(14,2) not null,amount numeric(14,2) not null,skip_reason text,sms_id uuid unique references public.sms_dispatches(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index driver_reminder_history on private.driver_payment_reminders(created_at desc);
create unique index driver_reminder_once_per_driver on private.driver_payment_reminders(driver_id,due_on,kind) where sms_id is not null;
create table private.driver_reminder_commands(request_id uuid primary key,actor_id uuid not null references auth.users(id),payload jsonb not null);
do $$declare t text;begin foreach t in array array['driver_reminder_settings','driver_reminder_preferences','driver_reminder_opt_outs','driver_payment_reminders','driver_reminder_commands'] loop execute format('alter table private.%I enable row level security',t);execute format('revoke all on private.%I from public,anon,authenticated',t);end loop;end $$;
alter table private.driver_plate_access add column reminder_id uuid references private.driver_payment_reminders(id);

create function private.driver_reminder_candidate(cid uuid,reminder_kind text,target_day date) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c public.contracts;d public.drivers;v public.vehicles;pr text;reason text;cur numeric:=0;old numeric:=0;expected numeric:=0;ph text;
begin
 select * into c from public.contracts where id=cid;select * into d from public.drivers where id=c.driver_id;select * into v from public.vehicles where id=c.vehicle_id;
 pr:=case when c.contract_type='DRIVE_TO_OWN' then 'DRIVE_TO_OWN' when c.contract_type='PARTNER_DRIVER' and v.owner_application_id is not null then 'FLEET_OWNER' end;
 ph:=private.normalize_driver_phone(d.phone);
 if pr is null then reason:='programme_non_concerne';
 elsif c.status<>'active' then reason:='contrat_inactif';
 elsif c.end_date<(target_day-(case when reminder_kind='weekly' then 1 else 0 end)) then reason:='contrat_termine';
 elsif d.status<>'active' then reason:='chauffeur_suspendu';
 elsif not(select enabled from private.sms_transport_config where singleton) then reason:='sms_suspendus';
 elsif not(select enabled from private.driver_reminder_settings where programme=pr) then reason:='programme_suspendu';
 elsif exists(select 1 from private.driver_reminder_preferences where driver_id=d.id and paused) then reason:='rappels_suspendus';
 elsif ph is null then reason:='telephone_invalide';
 elsif private.normalize_driver_plate(v.plate) is null then reason:='plaque_invalide';
 elsif exists(select 1 from private.driver_reminder_opt_outs where phone=ph) then reason:='numero_desinscrit';
 elsif c.start_date>target_day then reason:='service_non_demarre';
 elsif pr='DRIVE_TO_OWN' and (c.payment_frequency<>'weekly' or reminder_kind<>'weekly') then reason:='cadence_non_hebdomadaire';
 elsif pr='FLEET_OWNER' and (c.payment_frequency<>'daily' or reminder_kind not in('daily','saturday')) then reason:='cadence_incompatible';
 elsif reminder_kind='daily' and (extract(isodow from target_day)::int not between 1 and 5 or not extract(isodow from target_day)::int=any(c.operating_days)) then reason:='jour_non_ouvre';
 elsif reminder_kind='daily' and target_day=any(c.excluded_dates) then reason:='jour_excuse';
 elsif reminder_kind='saturday' and extract(isodow from target_day)::int<>6 then reason:='hors_samedi';end if;
 select coalesce(sum(x.remaining) filter(where case when reminder_kind='saturday' then x.settlement>=date_trunc('week',target_day::timestamp)::date and x.settlement<target_day else x.settlement=target_day end),0),
  coalesce(sum(x.remaining) filter(where x.settlement<case when reminder_kind='saturday' then date_trunc('week',target_day::timestamp)::date else target_day end),0),
  coalesce(sum(x.expected) filter(where x.settlement=target_day),0)
 into cur,old,expected from (
  select case when c.payment_frequency='weekly' then r.due_on+(7-extract(isodow from r.due_on)::int) else r.due_on end settlement,
   r.lolc_due+r.gml_due expected,greatest(0,r.lolc_due+r.gml_due-coalesce(a.paid,0)) remaining
  from public.repayment_schedules r left join lateral(select sum(amount) paid from public.payment_allocations where schedule_id=r.id)a on true
  where r.contract_id=c.id and not r.due_on=any(c.excluded_dates)
 )x;
 if reason is null then
  if reminder_kind='daily' and cur<=0 then reason:=case when expected>0 then 'jour_regle' else 'aucune_echeance' end;
  elsif cur+old<=0 then reason:='solde_regle';
  elsif reminder_kind='weekly' and expected<=0 then reason:='pas_de_collecte_demain';end if;
 end if;
 return jsonb_build_object('contract_id',cid,'driver_id',d.id,'application_id',d.application_id,'programme',pr,'kind',reminder_kind,'due_on',target_day,'driver_name',d.full_name,'phone','+'||ph,'plate',v.plate,'currency',c.currency,'current_amount',cur,'arrears',old,'amount',cur+old,'skip_reason',reason,'eligible',reason is null);
end $$;
revoke all on function private.driver_reminder_candidate(uuid,text,date) from public,anon,authenticated;

create function private.driver_reminder_plan(cid uuid,at_time timestamptz) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c public.contracts;pr text;k text;local_day date:=(at_time at time zone 'Africa/Kinshasa')::date;due_day date;cfg private.driver_reminder_settings;send_at timestamptz;cutoff timestamptz;
begin
 select * into c from public.contracts where id=cid;
 pr:=case when c.contract_type='DRIVE_TO_OWN' then 'DRIVE_TO_OWN' else 'FLEET_OWNER' end;
 select * into cfg from private.driver_reminder_settings where programme=pr;
 k:=case when pr='DRIVE_TO_OWN' then 'weekly' when extract(isodow from local_day)=6 then 'saturday' else 'daily' end;
 due_day:=local_day+case when k='weekly' then 1 else 0 end;
 send_at:=(local_day+case when k='saturday' then cfg.saturday_time else cfg.send_time end) at time zone 'Africa/Kinshasa';
 cutoff:=(local_day+case when k='weekly' then time '23:59:59' when k='saturday' then time '12:00' else time '21:00' end) at time zone 'Africa/Kinshasa';
 return private.driver_reminder_candidate(cid,k,due_day)||jsonb_build_object('planned_day',local_day,'send_at',send_at,'cutoff',cutoff,'in_window',at_time>=send_at and at_time<cutoff);
end $$;
revoke all on function private.driver_reminder_plan(uuid,timestamptz) from public,anon,authenticated;

create function private.enqueue_driver_payment_reminders(at_time timestamptz default now()) returns integer
language plpgsql security definer set search_path='' as $$
declare c record;j jsonb;r private.driver_payment_reminders;key_value text;sid uuid;n int:=0;
begin
 if not(select enabled from private.sms_transport_config where singleton) then return 0;end if;
 for c in select ct.id from public.contracts ct join public.vehicles v on v.id=ct.vehicle_id where ct.status='active' and (ct.contract_type='DRIVE_TO_OWN' or ct.contract_type='PARTNER_DRIVER' and v.owner_application_id is not null) order by ct.id loop
  j:=private.driver_reminder_plan(c.id,at_time);if not (j->>'in_window')::boolean then continue;end if;
  key_value:='pay_reminder:'||c.id||':'||(j->>'due_on')||':'||(j->>'kind');
  insert into private.driver_payment_reminders(contract_id,driver_id,programme,kind,planned_day,due_on,event_key,current_amount,arrears,amount,skip_reason)
  values(c.id,(j->>'driver_id')::uuid,j->>'programme',j->>'kind',(j->>'planned_day')::date,(j->>'due_on')::date,key_value,(j->>'current_amount')::numeric,(j->>'arrears')::numeric,(j->>'amount')::numeric,j->>'skip_reason')
  on conflict(event_key) do update set current_amount=excluded.current_amount,arrears=excluded.arrears,amount=excluded.amount,skip_reason=excluded.skip_reason,updated_at=now() where private.driver_payment_reminders.sms_id is null;
  select * into r from private.driver_payment_reminders where event_key=key_value for update;
  if r.sms_id is not null or not(j->>'eligible')::boolean then continue;end if;
  if exists(select 1 from private.driver_payment_reminders where driver_id=r.driver_id and due_on=r.due_on and kind=r.kind and sms_id is not null) then
   update private.driver_payment_reminders set skip_reason='rappel_deja_prepare' where id=r.id;continue;
  end if;
  insert into public.sms_dispatches(event_key,kind,recipient,sensitive,application_id) values(key_value,'driver_payment_reminder',j->>'phone',true,(j->>'application_id')::bigint) on conflict(event_key) do nothing;
  select id into sid from public.sms_dispatches where event_key=key_value;
  update private.driver_payment_reminders set sms_id=sid where id=r.id;n:=n+1;
 end loop;return n;
end $$;
revoke all on function private.enqueue_driver_payment_reminders(timestamptz) from public,anon,authenticated;

-- Called after the normal atomic SMS claim, immediately before the provider call.
create function private.prepare_driver_payment_reminder(p jsonb,at_time timestamptz default now()) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r private.driver_payment_reminders;s public.sms_dispatches;j jsonb;reason text;
begin
 select * into s from public.sms_dispatches where id=(p->>'sms_id')::uuid for update;
 select * into r from private.driver_payment_reminders where sms_id=s.id for update;
 if r.id is null or s.kind<>'driver_payment_reminder' or s.status<>'sending' then return null;end if;
 j:=private.driver_reminder_plan(r.contract_id,at_time);reason:=j->>'skip_reason';
 if (j->>'planned_day')::date<>r.planned_day or (j->>'due_on')::date<>r.due_on or j->>'kind'<>r.kind or not(j->>'in_window')::boolean then reason:='creneau_depasse';end if;
 if j->>'phone' is distinct from s.recipient then reason:='telephone_modifie';end if;
 if reason is not null then update public.sms_dispatches set status='cancelled',error='Rappel annulé : '||reason where id=s.id;update private.driver_payment_reminders set skip_reason=reason,updated_at=now() where id=r.id;return null;end if;
 if p->>'token_hash' is null or p->>'token_hash' !~ '^[a-f0-9]{64}$' then raise exception 'Empreinte de lien invalide';end if;
 -- Reuse the existing contract + current phone + plate capability, without the
 -- public lookup rate limiter (this is a service-only, authenticated issuance).
 insert into private.driver_plate_access(token_hash,contract_id,phone,plate,expires_at,reminder_id)
 values(p->>'token_hash',r.contract_id,private.normalize_driver_phone(j->>'phone'),private.normalize_driver_plate(j->>'plate'),at_time+interval '48 hours',r.id);
 update private.driver_payment_reminders set current_amount=(j->>'current_amount')::numeric,arrears=(j->>'arrears')::numeric,amount=(j->>'amount')::numeric,skip_reason=null,updated_at=now() where id=r.id;
 return j;
end $$;
revoke all on function private.prepare_driver_payment_reminder(jsonb,timestamptz) from public,anon,authenticated;
create function public.prepare_driver_payment_reminder(p jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.prepare_driver_payment_reminder(p);$$;
revoke all on function public.prepare_driver_payment_reminder(jsonb) from public,anon,authenticated;
grant execute on function private.prepare_driver_payment_reminder(jsonb,timestamptz),public.prepare_driver_payment_reminder(jsonb) to service_role;

-- Only augment the existing context. Preserve all its authorization, receipt,
-- allocation, fee and payment behaviour, and derive the suggestion from live data.
do $patch$declare definition text;begin
 definition:=pg_get_functiondef('private.driver_payment_context(text)'::regprocedure);
 if position($old$'contract_id',c.id$old$ in definition)=0 then raise exception 'Payment context shape changed';end if;
 definition:=replace(definition,$old$'contract_id',c.id$old$,$new$'reminder_amount',(select least(total,(private.driver_reminder_candidate(c.id,r.kind,r.due_on)->>'amount')::numeric) from private.driver_plate_access l join private.driver_payment_reminders r on r.id=l.reminder_id where l.token_hash=token and l.expires_at>now()),'contract_id',c.id$new$);execute definition;
end $patch$;

create function private.manage_driver_payment_reminders(p jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();rid uuid:=(p->>'request_id')::uuid;prior private.driver_reminder_commands;ph text;aid bigint;setting record;
begin
 if actor is null or not exists(select 1 from public.staff_members where user_id=actor and active and deleted_at is null and role in('admin','super_admin')) then raise exception 'Accès administrateur requis';end if;
 if rid is null then raise exception 'Identifiant de commande requis';end if;
 insert into private.driver_reminder_commands(request_id,actor_id,payload) values(rid,actor,p) on conflict do nothing;
 select * into prior from private.driver_reminder_commands where request_id=rid for update;
 if prior.actor_id<>actor or prior.payload<>p then raise exception 'Commande déjà utilisée pour une autre opération';end if;
 if p->>'action'='settings' then
  if p->>'programme' not in('FLEET_OWNER','DRIVE_TO_OWN') then raise exception 'Programme invalide';end if;
  if exists(select 1 from public.finance_events where actor_id=actor and action='payment_reminder_settings' and details->>'request_id'=rid::text) then return true;end if;
  update private.driver_reminder_settings set enabled=(p->>'enabled')::boolean,send_time=(p->>'send_time')::time,saturday_time=(p->>'saturday_time')::time where programme=p->>'programme';
  insert into public.finance_events(actor_id,action,entity_id,details) values(actor,'payment_reminder_settings',p->>'programme',p);
 elsif p->>'action'='driver' then
  if length(trim(coalesce(p->>'reason',''))) not between 3 and 1000 then raise exception 'Motif obligatoire';end if;
  select private.normalize_driver_phone(phone),application_id into ph,aid from public.drivers where id=(p->>'driver_id')::uuid;
  if aid is null then raise exception 'Chauffeur introuvable';end if;
  if exists(select 1 from public.audit_logs where application_id=aid and action='payment_reminder_preference' and changes->>'request_id'=rid::text) then return true;end if;
  insert into private.driver_reminder_preferences(driver_id,paused,reason,updated_by) values((p->>'driver_id')::uuid,(p->>'paused')::boolean,trim(p->>'reason'),actor) on conflict(driver_id) do update set paused=excluded.paused,reason=excluded.reason,updated_by=actor,updated_at=now();
  if (p->>'opted_out')::boolean then
   if ph is null then raise exception 'Téléphone valide requis pour désinscrire ce numéro';end if;
   insert into private.driver_reminder_opt_outs values(ph,trim(p->>'reason'),actor,now()) on conflict(phone) do update set reason=excluded.reason,updated_by=actor,updated_at=now();
  else delete from private.driver_reminder_opt_outs where phone=ph;end if;
  insert into public.audit_logs(application_id,actor_id,entity,action,changes) values(aid,actor,'driver_payment_reminders','payment_reminder_preference',p);
 else raise exception 'Action inconnue';end if;return true;
end $$;
create function public.manage_driver_payment_reminders(p jsonb) returns boolean language sql security invoker set search_path='' as $$select private.manage_driver_payment_reminders(p);$$;
revoke all on function private.manage_driver_payment_reminders(jsonb),public.manage_driver_payment_reminders(jsonb) from public,anon;
grant execute on function private.manage_driver_payment_reminders(jsonb),public.manage_driver_payment_reminders(jsonb) to authenticated;

create function private.get_driver_payment_reminders() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.staff_members where user_id=auth.uid() and active and deleted_at is null and role in('admin','super_admin')) then raise exception 'Accès administrateur requis';end if;
 return jsonb_build_object('as_of',now(),'sms_enabled',(select enabled from private.sms_transport_config where singleton),'settings',(select jsonb_agg(to_jsonb(s)) from private.driver_reminder_settings s),'today',(
 select coalesce(jsonb_agg(private.driver_reminder_plan(c.id,now())||jsonb_build_object('paused',coalesce(p.paused,false),'reason',p.reason,'opted_out',o.phone is not null) order by d.full_name),'[]'::jsonb)
 from public.contracts c join public.drivers d on d.id=c.driver_id join public.vehicles v on v.id=c.vehicle_id left join private.driver_reminder_preferences p on p.driver_id=d.id left join private.driver_reminder_opt_outs o on o.phone=private.normalize_driver_phone(d.phone)
 where c.status='active' and (c.contract_type='DRIVE_TO_OWN' or c.contract_type='PARTNER_DRIVER' and v.owner_application_id is not null)),
 'history',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) from(select r.id,r.driver_id,d.full_name driver_name,r.programme,r.kind,r.due_on,r.current_amount,r.arrears,r.amount,c.currency,r.skip_reason,coalesce(s.status,'skipped') sms_status,s.error,r.created_at from private.driver_payment_reminders r join public.drivers d on d.id=r.driver_id join public.contracts c on c.id=r.contract_id left join public.sms_dispatches s on s.id=r.sms_id where r.created_at>=now()-interval '7 days' order by r.created_at desc)x));
end $$;
create function public.get_driver_payment_reminders() returns jsonb language sql security invoker set search_path='' as $$select private.get_driver_payment_reminders();$$;
revoke all on function private.get_driver_payment_reminders(),public.get_driver_payment_reminders() from public,anon;
grant execute on function private.get_driver_payment_reminders(),public.get_driver_payment_reminders() to authenticated;

-- Existing SMS cron/worker owns all external sends and the global pause switch.
do $patch$declare definition text;begin
 definition:=pg_get_functiondef('private.invoke_sms_worker()'::regprocedure);
 if position('status=''pending'' and not sensitive' in definition)=0 then raise exception 'SMS worker shape changed';end if;
 definition:=replace(definition,'status=''pending'' and not sensitive','status=''pending'' and (not sensitive or kind=''driver_payment_reminder'')');execute definition;
end $patch$;
select cron.schedule('gmfleet-driver-payment-reminders','* * * * *',$job$select private.enqueue_driver_payment_reminders();$job$);
notify pgrst,'reload schema';
commit;
