begin;
-- The invite pepper never leaves the private transport configuration.
alter table private.sms_transport_config add column mobile_invite_pepper text not null default
 (replace(gen_random_uuid()::text||gen_random_uuid()::text||gen_random_uuid()::text||gen_random_uuid()::text,'-',''));
create table public.mobile_owner_invites (
 id uuid primary key default gen_random_uuid(), owner_application_id bigint not null references public.applications(id),
 phone text not null, code_hash text not null unique, expires_at timestamptz not null,
 failed_attempts int not null default 0 check(failed_attempts between 0 and 5), redeemed_at timestamptz,
 redeemed_gml_user_id uuid, revoked_at timestamptz, created_by uuid not null references public.staff_members(user_id),
 created_at timestamptz not null default now()
);
create unique index mobile_owner_invite_open on public.mobile_owner_invites(owner_application_id) where redeemed_at is null and revoked_at is null;
create index mobile_invite_phone on public.mobile_owner_invites(phone);
create table public.mobile_owner_links (
 id uuid primary key default gen_random_uuid(),owner_application_id bigint not null references public.applications(id),
 gml_user_id uuid not null,gml_phone text not null,invite_id uuid not null references public.mobile_owner_invites(id),
 linked_at timestamptz not null default now(),revoked_at timestamptz,revoked_by uuid references public.staff_members(user_id),revoke_reason text
);
create unique index mobile_owner_link_active on public.mobile_owner_links(owner_application_id,gml_user_id) where revoked_at is null;
create index mobile_link_user on public.mobile_owner_links(gml_user_id) where revoked_at is null;
create table public.mobile_bridge_events (
 id bigint generated always as identity primary key,at timestamptz not null default now(),action text not null,
 gml_user_id uuid,owner_application_id bigint,vehicle_id bigint,outcome text not null
);
create index mobile_bridge_rate on public.mobile_bridge_events(gml_user_id,at);
alter table public.mobile_owner_invites enable row level security;
alter table public.mobile_owner_links enable row level security;
alter table public.mobile_bridge_events enable row level security;
revoke all on public.mobile_owner_invites,public.mobile_owner_links,public.mobile_bridge_events from public,anon,authenticated;
-- Staff must never retrieve the hash, even through a direct Data API call.
grant select(id,owner_application_id,phone,expires_at,failed_attempts,redeemed_at,redeemed_gml_user_id,revoked_at,created_by,created_at) on public.mobile_owner_invites to authenticated;
grant select on public.mobile_owner_links,public.mobile_bridge_events to authenticated;
create policy staff_read on public.mobile_owner_invites for select to authenticated using((select private.is_staff()));
create policy staff_read on public.mobile_owner_links for select to authenticated using((select private.is_staff()));
create policy admin_read on public.mobile_bridge_events for select to authenticated using(exists(select 1 from public.staff_members where user_id=(select auth.uid()) and active and deleted_at is null and role in('admin','super_admin')));
grant select,insert,update on public.mobile_owner_invites,public.mobile_owner_links to service_role;
grant select,insert on public.mobile_bridge_events to service_role;
grant usage,select on sequence public.mobile_bridge_events_id_seq to service_role;

create function private.mobile_phone(ph text) returns text language sql immutable set search_path='' as $$
 select case when d ~ '^0[0-9]{9}$' then '+243'||substr(d,2) when d ~ '^243[0-9]{9}$' then '+'||d when d ~ '^00243[0-9]{9}$' then '+'||substr(d,3) when ph ~ '^\+[1-9][0-9 ()-]{7,24}$' and length(d) between 8 and 15 then '+'||d end from (select regexp_replace(coalesce(ph,''),'[^0-9]','','g') d)x;
$$;
create function private.mobile_mask(ph text) returns text language sql immutable set search_path='' as $$select left(ph,6)||'••••'||right(ph,3)$$;
-- A pseudorandom 8-digit code can be regenerated only inside this private function.
create function private.mobile_invite_code(i uuid) returns text language sql stable security definer set search_path='' as $$
 select lpad(((('x'||substr(encode(sha256(convert_to(mobile_invite_pepper||':invite:'||i::text,'UTF8')),'hex'),1,15))::bit(60)::bigint)%100000000)::text,8,'0') from private.sms_transport_config where singleton;
$$;
create function private.mobile_code_hash(code text) returns text language sql stable security definer set search_path='' as $$
 select encode(sha256(convert_to(mobile_invite_pepper||code,'UTF8')),'hex') from private.sms_transport_config where singleton;
$$;
create function private.create_mobile_owner_invite(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.applications;old public.audit_logs;i uuid:=gen_random_uuid();code text;ph text;result jsonb;expiry timestamptz:=now()+interval '72 hours';
begin
 if not exists(select 1 from public.staff_members where user_id=auth.uid() and active and deleted_at is null and role in('agent','cashier','admin','super_admin')) then raise exception 'Accès personnel requis';end if;
 if p->>'request_id' is null then raise exception 'Identifiant de requête requis';end if;
 perform (p->>'request_id')::uuid;perform pg_advisory_xact_lock(hashtextextended(p->>'request_id',0));
 select * into old from public.audit_logs where entity='mobile_owner_invites' and changes->>'request_id'=p->>'request_id';
 if found then if old.actor_id<>auth.uid() or old.changes->'command'<>p then raise exception 'Requête réutilisée avec des valeurs différentes';end if;return old.changes->'result';end if;
 if not coalesce((select enabled from private.sms_transport_config where singleton),false) then raise exception 'Le service SMS est désactivé. Activez-le avant d’inviter le propriétaire.';end if;
 select * into a from public.applications where id=(p->>'application_id')::bigint for update;
 ph:=private.mobile_phone(a.phone);
 if a.id is null or a.program_type<>'FLEET_OWNER' or ph is null then raise exception 'Dossier propriétaire et téléphone valide requis';end if;
 update public.mobile_owner_invites set revoked_at=now() where owner_application_id=a.id and redeemed_at is null and revoked_at is null;
 update public.sms_dispatches set status='cancelled',body=null where kind='mobile_owner_invite' and application_id=a.id and status='pending';
 code:=private.mobile_invite_code(i);
 while exists(select 1 from public.mobile_owner_invites where code_hash=private.mobile_code_hash(code)) loop i:=gen_random_uuid();code:=private.mobile_invite_code(i);end loop;
 insert into public.mobile_owner_invites(id,owner_application_id,phone,code_hash,expires_at,created_by) values(i,a.id,ph,private.mobile_code_hash(code),expiry,auth.uid());
 -- No plaintext code is persisted in the queue. The worker resolves it privately at send time.
 perform private.queue_sms('mobile_invite:'||i,'mobile_owner_invite',ph,null,a.id);
 result:=jsonb_build_object('invite_id',i,'expires_at',expiry,'phone_masked',private.mobile_mask(ph));
 insert into public.audit_logs(application_id,actor_id,entity,action,changes) values(a.id,auth.uid(),'mobile_owner_invites','create_mobile_owner_invite',jsonb_build_object('request_id',p->>'request_id','command',p,'result',result));
 return result;
end $$;
create function private.revoke_mobile_owner_link(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare l public.mobile_owner_links;old public.audit_logs;result jsonb;
begin
 if not exists(select 1 from public.staff_members where user_id=auth.uid() and active and deleted_at is null and role in('admin','super_admin')) then raise exception 'Administration requise';end if;
 if p->>'request_id' is null or coalesce(length(btrim(p->>'reason')),0)<5 then raise exception 'Identifiant et motif de cinq caractères requis';end if;
 perform (p->>'request_id')::uuid;perform pg_advisory_xact_lock(hashtextextended(p->>'request_id',0));
 select * into old from public.audit_logs where entity='mobile_owner_links' and changes->>'request_id'=p->>'request_id';
 if found then if old.actor_id<>auth.uid() or old.changes->'command'<>p then raise exception 'Requête réutilisée';end if;return old.changes->'result';end if;
 select * into l from public.mobile_owner_links where id=(p->>'link_id')::uuid for update;if not found then raise exception 'Accès introuvable';end if;
 update public.mobile_owner_links set revoked_at=coalesce(revoked_at,now()),revoked_by=coalesce(revoked_by,auth.uid()),revoke_reason=coalesce(revoke_reason,btrim(p->>'reason')) where id=l.id;
 result:=jsonb_build_object('revoked',true);
 insert into public.audit_logs(application_id,actor_id,entity,action,changes) values(l.owner_application_id,auth.uid(),'mobile_owner_links','revoke_mobile_owner_link',jsonb_build_object('request_id',p->>'request_id','command',p,'result',result));return result;
end $$;

create function private.mobile_owner_invite_sms(p jsonb) returns text language plpgsql security definer set search_path='' as $$
declare i public.mobile_owner_invites;code text;
begin
 select * into i from public.mobile_owner_invites where id=(p->>'invite_id')::uuid;
 if not found or i.revoked_at is not null or i.redeemed_at is not null or i.expires_at<=now() or i.failed_attempts>=5 then return null;end if;
 code:=private.mobile_invite_code(i.id);
 return 'GM Fleet : votre code d''accès GML Mobile est '||left(code,4)||'-'||right(code,4)||'. Ouvrez GML Mobile > Propriétaire > Voitures et saisissez-le. Valable 72 h. Ne le communiquez à personne.';
end $$;
create function private.mobile_error(code text) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('error',code,'message',case code when 'invalid_code' then 'Code invalide. Vérifiez le code reçu.' when 'expired' then 'Ce code a expiré. Demandez une nouvelle invitation à GM Fleet.' when 'phone_mismatch' then 'Utilisez le téléphone vérifié du propriétaire destinataire.' when 'too_many_attempts' then 'Code bloqué après cinq essais. Demandez une nouvelle invitation.' when 'not_linked' then 'Aucun accès propriétaire actif. Contactez GM Fleet.' when 'vehicle_not_found' then 'Véhicule introuvable.' when 'rate_limited' then 'Trop de demandes. Réessayez dans une minute.' else 'Demande invalide.' end);
$$;

-- Read the owner's base receipts with exactly the existing month-end collection rule.
create function private.mobile_vehicle_receipts(v bigint,period date) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('date',paid_on,'amount',amount,'method',method,'kind',entry_kind) order by paid_on,id),'[]'::jsonb) from (
 select p.id,p.paid_on,round((case when p.entry_kind='reversal' then -1 else 1 end)*(p.amount-p.lolc_amount)-coalesce(r.recovered,0),2) amount,
 case when lower(p.method) in('espèces','especes','cash') then 'cash' else 'mobile_money' end method,p.entry_kind
 from public.payments p join public.contracts c on c.id=p.contract_id left join lateral(select sum(amount) recovered from public.advance_recoveries where payment_id=p.id)r on true
 where c.vehicle_id=v and p.paid_on>=period and p.paid_on<(period+interval '1 month')::date
 )x;
$$;
create function private.mobile_vehicle_overview(v public.vehicles) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare m public.fleet_mandates;d public.applications;a public.applications;c public.contracts;r jsonb;eq jsonb;last_paid jsonb;today date:=(now() at time zone 'Africa/Kinshasa')::date;period date:=date_trunc('month',today);due int;paid int;outstanding numeric;collected numeric;
begin
 select * into a from public.applications where id=v.owner_application_id;
 select * into m from public.fleet_mandates where vehicle_id=v.id order by created_at desc limit 1;
 select * into c from public.contracts where vehicle_id=v.id and status='active' order by start_date desc limit 1;
 select * into d from public.applications where id=c.application_id;
 r:=private.owner_financial_recap(a.id);eq:=a.preparation->'equipment';
 select jsonb_build_object('period_start',period_start,'owner_net',owner_net,'paid_on',paid_on) into last_paid from public.owner_settlements where mandate_id in(select id from public.fleet_mandates where vehicle_id=v.id) order by period_start desc limit 1;
 select coalesce(sum((x->>'amount')::numeric),0) into collected from jsonb_array_elements(private.mobile_vehicle_receipts(v.id,period))x where (x->>'date')::date<=today;
 -- Schedules and allocations are the cashier's persisted calendar, including exclusions.
 select count(*) filter(where s.due_on<=today),count(*) filter(where s.due_on<=today and coalesce(x.base_paid,0)>=s.gml_due-s.additional_gml_due+s.lolc_due),
 coalesce(sum(greatest(s.gml_due-s.additional_gml_due+s.lolc_due-coalesce(x.base_paid,0),0)) filter(where s.due_on<=today),0)
 into due,paid,outstanding from public.repayment_schedules s join public.contracts ct on ct.id=s.contract_id
 left join lateral(select sum(pa.amount-pa.lolc_amount-coalesce(ar.recovered,0)) base_paid from public.payment_allocations pa left join lateral(select sum(rr.amount) recovered from public.advance_recoveries rr join public.advance_instalments ai on ai.id=rr.instalment_id where rr.payment_id=pa.payment_id and ai.schedule_id=pa.schedule_id)ar on true where pa.schedule_id=s.id)x on true
 where ct.vehicle_id=v.id and s.due_on>=period and s.due_on<(period+interval '1 month')::date;
 return jsonb_build_object('vehicle_id',v.id,'owner_application_id',a.id,'plate',v.plate,'model',v.model,'status',case when c.id is not null then 'active' when m.status='awaiting_driver' then 'awaiting_driver' else v.status end,
 'mandate',case when m.id is null then null else jsonb_build_object('reference',m.reference,'status',m.status,'category',m.category,'owner_target',m.owner_target,'management_fee',m.management_fee,'progression_reserve',m.progression_reserve,'effective_start',m.effective_start,'effective_end',m.effective_end) end,
 'driver',case when d.id is null then null else jsonb_build_object('name',split_part(btrim(d.name),' ',1)||case when position(' ' in btrim(d.name))>0 then ' '||left(split_part(btrim(d.name),' ',2),1)||'.' else '' end,'since',c.start_date) end,
 'equipment',case when nullif(v.tracker_id,'') is null and nullif(eq->>'dashcam_id','') is null then null else jsonb_build_object('package',eq->>'equipment_package','tracker_id',v.tracker_id,'dashcam_id',eq->>'dashcam_id') end,
 'current_month',jsonb_build_object('period_start',period,'collected_to_date',collected,'working_days_due_to_date',due,'days_paid',paid,'excused_days','[]'::jsonb,'outstanding_to_date',outstanding),
 'recap',jsonb_build_object('next_period',r->'next_period','next_payout_date',r->'next_payout_date','owner_target',r->'owner_target','next_deduction',r->'next_deduction','projected_net',r->'projected_net','debt_remaining',r->'remaining'),'last_settlement',last_paid);
end $$;

create function private.mobile_bridge_action(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=(p->>'gml_user_id')::uuid;action text:=p->>'action';i public.mobile_owner_invites;ph text;code text;v public.vehicles;result jsonb;owner_id bigint;lim int;
begin
 if action='redeem_invite' then
  ph:=private.mobile_phone(p->>'gml_phone');code:=replace(p->>'code','-','');
  if ph is null or code is null or code !~ '^[0-9]{8}$' then return private.mobile_error('bad_request');end if;
  -- Serialize both phone-based failure counting and code redemption.
  perform pg_advisory_xact_lock(hashtextextended('mobile-phone:'||ph,0));
  select * into i from public.mobile_owner_invites where code_hash=private.mobile_code_hash(code) for update;
  if i.id is null then
   update public.mobile_owner_invites set failed_attempts=least(5,failed_attempts+1) where phone=ph and redeemed_at is null and revoked_at is null and expires_at>now();
   if exists(select 1 from public.mobile_owner_invites where phone=ph and redeemed_at is null and revoked_at is null and expires_at>now() and failed_attempts>=5) then return private.mobile_error('too_many_attempts');end if;
   return private.mobile_error('invalid_code');
  end if;
  if i.revoked_at is not null then return private.mobile_error('invalid_code');end if;
  if i.redeemed_at is not null then
   if i.redeemed_gml_user_id=u and i.phone=ph and exists(select 1 from public.mobile_owner_links where invite_id=i.id and gml_user_id=u and revoked_at is null) then
    return jsonb_build_object('linked',true,'owner_application_id',i.owner_application_id,'owner_name',(select name from public.applications where id=i.owner_application_id),'vehicles',(select count(*) from public.vehicles where owner_application_id=i.owner_application_id));
   end if;return private.mobile_error('invalid_code');
  end if;
  if i.expires_at<=now() then return private.mobile_error('expired');end if;
  if i.failed_attempts>=5 then return private.mobile_error('too_many_attempts');end if;
  if ph<>i.phone then update public.mobile_owner_invites set failed_attempts=failed_attempts+1 where id=i.id;return private.mobile_error(case when i.failed_attempts+1>=5 then 'too_many_attempts' else 'phone_mismatch' end);end if;
  update public.mobile_owner_invites set redeemed_at=now(),redeemed_gml_user_id=u where id=i.id;
  insert into public.mobile_owner_links(owner_application_id,gml_user_id,gml_phone,invite_id) values(i.owner_application_id,u,ph,i.id) on conflict(owner_application_id,gml_user_id) where revoked_at is null do nothing;
  perform private.queue_sms('mobile_link:'||i.id,'mobile_owner_linked',i.phone,'GM Fleet : votre accès GML Mobile est activé.',i.owner_application_id);
  insert into public.audit_logs(application_id,actor_id,entity,action,changes) values(i.owner_application_id,null,'mobile_owner_links','redeem_invite',jsonb_build_object('gml_user_id',u,'invite_id',i.id));
  return jsonb_build_object('linked',true,'owner_application_id',i.owner_application_id,'owner_name',(select name from public.applications where id=i.owner_application_id),'vehicles',(select count(*) from public.vehicles where owner_application_id=i.owner_application_id));
 end if;
 if not exists(select 1 from public.mobile_owner_links where gml_user_id=u and revoked_at is null) then return private.mobile_error('not_linked');end if;
 if action='owner_overview' then
  select jsonb_build_object('owner',jsonb_build_object('name',a.name,'phone_masked',private.mobile_mask(private.mobile_phone(a.phone)))) into result from public.applications a join public.mobile_owner_links l on l.owner_application_id=a.id where l.gml_user_id=u and l.revoked_at is null order by l.linked_at limit 1;
  return result||jsonb_build_object('vehicles',(select coalesce(jsonb_agg(private.mobile_vehicle_overview(x) order by x.id),'[]'::jsonb) from public.vehicles x where exists(select 1 from public.mobile_owner_links where gml_user_id=u and revoked_at is null and owner_application_id=x.owner_application_id)));
 end if;
 select * into v from public.vehicles where id=(p->>'vehicle_id')::bigint and owner_application_id in(select owner_application_id from public.mobile_owner_links where gml_user_id=u and revoked_at is null);
 if not found then return private.mobile_error('vehicle_not_found');end if;
 if action='vehicle_receipts' then return jsonb_build_object('receipts',private.mobile_vehicle_receipts(v.id,((p->>'month')||'-01')::date));end if;
 if action='vehicle_advances' then
  select coalesce(jsonb_agg(jsonb_build_object('description',x->'description','principal',x->'principal','fee',x->'fee','total',x->'total','remaining',x->'remaining','months',x->'months','recovery_start',x->'recovery_start','recovery_deadline',x->'recovery_deadline','next_deduction',x->'next_deduction')),'[]'::jsonb) into result from jsonb_array_elements(private.owner_financial_recap(v.owner_application_id)->'advances')x;
  return jsonb_build_object('advances',result);
 end if;
 if action='vehicle_settlements' then
  lim:=coalesce((p->>'limit')::int,24);if lim<1 or lim>120 then return private.mobile_error('bad_request');end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'period_start',s.period_start,'period_end',s.period_end,'base_collected',s.base_collected,'owner_gross',s.owner_gross,'management_fee',s.management_fee,'progression_reserve',s.progression_reserve,'cash_reserve',s.cash_reserve,'recovered',s.recovered,'owner_net',s.owner_net,'adjustment_reason',s.adjustment_reason,'payment_reference',s.payment_reference,'paid_on',s.paid_on) order by s.period_start desc),'[]'::jsonb) into result from (select os.* from public.owner_settlements os join public.fleet_mandates m on m.id=os.mandate_id where m.vehicle_id=v.id order by os.period_start desc limit lim)s;
  return jsonb_build_object('settlements',result);
 end if;
 return private.mobile_error('bad_request');
end $$;

create function private.mobile_bridge_call(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;u uuid;v bigint;oid bigint;action text:=left(coalesce(p->>'action','unknown'),60);
begin
 begin
  u:=(p->>'gml_user_id')::uuid;v:=(p->>'vehicle_id')::bigint;
  if u is null or action not in('redeem_invite','owner_overview','vehicle_receipts','vehicle_advances','vehicle_settlements') or (action like 'vehicle_%' and (v is null or v<=0)) or (action='vehicle_receipts' and coalesce(p->>'month','') !~ '^[0-9]{4}-(0[1-9]|1[0-2])$') then result:=private.mobile_error('bad_request');
  else
   perform pg_advisory_xact_lock(hashtextextended('mobile-rate:'||u,0));
   if (select count(*) from public.mobile_bridge_events where gml_user_id=u and at>clock_timestamp()-interval '1 minute')>=120 then result:=private.mobile_error('rate_limited');else result:=private.mobile_bridge_action(p);end if;
  end if;
 exception when invalid_text_representation or datetime_field_overflow or numeric_value_out_of_range then result:=private.mobile_error('bad_request');end;
 oid:=case when result ? 'error' then null else (result->>'owner_application_id')::bigint end;
 if oid is null and v is not null and not(result ? 'error') then select owner_application_id into oid from public.vehicles where id=v;end if;
 insert into public.mobile_bridge_events(action,gml_user_id,owner_application_id,vehicle_id,outcome) values(action,u,oid,v,coalesce(result->>'error','ok'));
 return result;
end $$;
create function private.log_mobile_bridge_event(p jsonb) returns void language sql security definer set search_path='' as $$insert into public.mobile_bridge_events(action,outcome) values('authentication',case when p->>'outcome'='bad_signature' then 'bad_signature' else 'bad_request' end)$$;
create function private.mobile_bridge_append_only() returns trigger language plpgsql set search_path='' as $$begin raise exception 'Journal immuable';end$$;
create trigger mobile_bridge_append_only before update or delete on public.mobile_bridge_events for each row execute function private.mobile_bridge_append_only();

do $$declare f text;begin
 foreach f in array array['create_mobile_owner_invite','revoke_mobile_owner_link'] loop
 execute format('create function public.%I(p jsonb) returns jsonb language sql security invoker set search_path='''' as %L',f,'select private.'||f||'(p)');
 execute format('revoke all on function private.%I(jsonb),public.%I(jsonb) from public,anon',f,f);
 execute format('grant execute on function private.%I(jsonb),public.%I(jsonb) to authenticated',f,f);end loop;
 foreach f in array array['mobile_bridge_call','log_mobile_bridge_event','mobile_owner_invite_sms'] loop
 execute format('create function public.%I(p jsonb) returns %s language sql security invoker set search_path='''' as %L',f,case when f='log_mobile_bridge_event' then 'void' when f='mobile_owner_invite_sms' then 'text' else 'jsonb' end,'select private.'||f||'(p)');
 execute format('revoke all on function private.%I(jsonb),public.%I(jsonb) from public,anon,authenticated',f,f);
 execute format('grant execute on function private.%I(jsonb),public.%I(jsonb) to service_role',f,f);end loop;
end $$;
revoke all on function private.mobile_phone(text),private.mobile_mask(text),private.mobile_invite_code(uuid),private.mobile_code_hash(text),private.mobile_error(text),private.mobile_vehicle_receipts(bigint,date),private.mobile_vehicle_overview(public.vehicles),private.mobile_bridge_action(jsonb),private.mobile_bridge_append_only() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
