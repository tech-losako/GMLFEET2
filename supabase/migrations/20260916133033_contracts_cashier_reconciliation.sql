begin;
create function private.is_cashier() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.staff_members where user_id=auth.uid() and active and role in ('admin','cashier'));
$$;
revoke all on function private.is_cashier() from public,anon;
grant execute on function private.is_cashier() to authenticated;

create table public.drivers (
 id uuid primary key default gen_random_uuid(), application_id bigint not null unique references public.applications(id),
 full_name text not null, phone text not null, status text not null check(status in ('active','available','suspended')),created_at timestamptz not null default now()
);
alter table public.vehicles add column vin text, add column tracker_id text;
create unique index vehicles_plate_normalized on public.vehicles(upper(trim(plate)));
create table public.contracts (
 id uuid primary key default gen_random_uuid(), request_id uuid not null unique, command_payload jsonb not null,
 application_id bigint not null references public.applications(id),driver_id uuid not null references public.drivers(id),vehicle_id bigint not null references public.vehicles(id),
 contract_type text not null check(contract_type in ('DRIVE_TO_OWN','PARTNER_DRIVER')),
 status text not null default 'active' check(status in ('active','void')),
 currency text not null check(currency in ('USD','CDF')),
 start_date date not null,end_date date not null,first_payment_date date not null,
 daily_lolc numeric(14,2) not null check(daily_lolc>=0),daily_gml numeric(14,2) not null check(daily_gml>=0),
 operating_days integer[] not null, excluded_dates date[] not null default '{}',
 signed_reference text not null check(length(trim(signed_reference))>0),
 created_by uuid not null references public.staff_members(user_id),created_at timestamptz not null default now(),
 void_reason text,voided_by uuid references public.staff_members(user_id),voided_at timestamptz,
 check(end_date>=start_date and first_payment_date>=start_date and first_payment_date<=end_date),
 check(daily_lolc+daily_gml>0),check(contract_type='DRIVE_TO_OWN' or daily_lolc=0),
 check(cardinality(operating_days)>0 and operating_days<@array[1,2,3,4,5,6,7])
);
create unique index contracts_active_driver on public.contracts(driver_id) where status='active';
create unique index contracts_active_vehicle on public.contracts(vehicle_id) where status='active';
create unique index contracts_active_application on public.contracts(application_id) where status='active';
create index contracts_application_idx on public.contracts(application_id);
create index contracts_vehicle_idx on public.contracts(vehicle_id);
create index contracts_driver_idx on public.contracts(driver_id);
create index contracts_creator_idx on public.contracts(created_by);
create index contracts_void_actor_idx on public.contracts(voided_by);
create table public.vehicle_assignments (
 id uuid primary key default gen_random_uuid(), contract_id uuid not null unique references public.contracts(id),
 driver_id uuid not null references public.drivers(id),vehicle_id bigint not null references public.vehicles(id),
 start_date date not null,end_date date,reason_ended text,assigned_by uuid not null references public.staff_members(user_id)
);
create index assignments_driver_idx on public.vehicle_assignments(driver_id);
create index assignments_vehicle_idx on public.vehicle_assignments(vehicle_id);
create index assignments_actor_idx on public.vehicle_assignments(assigned_by);
create table public.repayment_schedules (
 id bigint generated always as identity primary key,contract_id uuid not null references public.contracts(id),due_on date not null,
 lolc_due numeric(14,2) not null check(lolc_due>=0),gml_due numeric(14,2) not null check(gml_due>=0),unique(contract_id,due_on)
);
alter table public.payments add column contract_id uuid references public.contracts(id),
 add column entry_kind text not null default 'payment' check(entry_kind in ('payment','reversal')),
 add column reverses_payment_id bigint unique references public.payments(id),
 add column request_id uuid unique,add column command_payload jsonb,
 add column recorded_by uuid references public.staff_members(user_id),add column reason text,
 add column proof_path text,add column lolc_amount numeric(14,2) not null default 0;
create index payments_contract_idx on public.payments(contract_id);
create index payments_recorder_idx on public.payments(recorded_by);
create unique index payments_receipt_reference on public.payments(method,reference) where contract_id is not null and entry_kind='payment';
create table public.payment_allocations (
 payment_id bigint not null references public.payments(id),schedule_id bigint not null references public.repayment_schedules(id),
 amount numeric(14,2) not null check(amount<>0),lolc_amount numeric(14,2) not null,
 primary key(payment_id,schedule_id)
);
create index allocations_schedule_idx on public.payment_allocations(schedule_id);
create table public.lolc_deposits (
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,command_payload jsonb not null,
 currency text not null check(currency in ('USD','CDF')),period_start date not null,period_end date not null,
 deposited_on date not null,amount numeric(14,2) not null check(amount>0),bank_reference text not null unique,
 proof_path text not null,recorded_by uuid not null references public.staff_members(user_id),created_at timestamptz not null default now(),
 check(period_end>=period_start)
);
create index deposits_recorder_idx on public.lolc_deposits(recorded_by);
create table public.lolc_deposit_items (
 deposit_id uuid not null references public.lolc_deposits(id),payment_id bigint not null unique references public.payments(id),amount numeric(14,2) not null check(amount>0),primary key(deposit_id,payment_id)
);
create table public.finance_events (
 id bigint generated always as identity primary key,actor_id uuid not null references public.staff_members(user_id),
 action text not null,entity_id text not null,details jsonb not null,created_at timestamptz not null default now()
);
create index finance_events_actor_idx on public.finance_events(actor_id);
do $$declare t text;begin
 foreach t in array array['drivers','contracts','vehicle_assignments','repayment_schedules','payment_allocations','lolc_deposits','lolc_deposit_items','finance_events'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy staff_read on public.%I for select to authenticated using ((select private.is_staff()))',t);
 end loop;
end $$;
grant select on public.payments,public.vehicles to authenticated;
revoke insert,update,delete,truncate,references,trigger on public.payments from anon,authenticated;
revoke insert,update,delete,truncate,references,trigger on public.vehicles from anon,authenticated;

create function private.activate_contract(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare a public.applications; c public.contracts; v public.vehicles; d uuid; result_id uuid; days integer[]; exclusions date[]; first_day date; last_day date; start_day date; l numeric; g numeric; row_count integer;
begin
 if not private.is_staff() then raise exception 'Accès réservé au personnel'; end if;
 if p->>'request_id' is null then raise exception 'Identifiant de requête requis'; end if;
 if p->>'request_id' is null then raise exception 'Identifiant de requête requis';end if;
 perform pg_advisory_xact_lock(hashtextextended(p->>'request_id',0));
 select * into c from public.contracts where request_id=(p->>'request_id')::uuid;
 if found then if c.command_payload<>p then raise exception 'Requête réutilisée avec des valeurs différentes'; end if;return c.id;end if;
 select * into a from public.applications where id=(p->>'application_id')::bigint for update;
 if not found or a.program_type not in ('DRIVE_TO_OWN','PARTNER_DRIVER') then raise exception 'Choisir un dossier chauffeur éligible'; end if;
 if a.program_type='DRIVE_TO_OWN' and (a.lolc_status<>'approved' or a.workflow_stage<>'handed_over') then raise exception 'Approbation LOLC et remise du véhicule requises'; end if;
 if a.program_type='PARTNER_DRIVER' and a.workflow_stage not in ('approved','available') then raise exception 'Le chauffeur doit être approuvé ou disponible'; end if;
 start_day:=(p->>'start_date')::date;first_day:=(p->>'first_payment_date')::date;last_day:=(p->>'end_date')::date;
 if start_day>(now() at time zone 'Africa/Kinshasa')::date then raise exception 'Activer le contrat à partir de sa date réelle de démarrage'; end if;
 if last_day-start_day>3653 then raise exception 'Durée maximale : 10 ans'; end if;
 l:=(p->>'daily_lolc')::numeric;g:=(p->>'daily_gml')::numeric;
 if l is null or g is null or l::text='NaN' or g::text='NaN' or l<>round(l,2) or g<>round(g,2) then raise exception 'Deux décimales maximum'; end if;
 if a.program_type='PARTNER_DRIVER' and l<>0 then raise exception 'Pas de part LOLC pour ce programme'; end if;
 if coalesce(trim(p->>'plate'),'')='' or coalesce(trim(p->>'model'),'')='' or coalesce(trim(p->>'vin'),'')='' or coalesce(trim(p->>'tracker_id'),'')='' then raise exception 'Modèle, plaque, châssis et tracker requis';end if;
 select array_agg(distinct value::integer) into days from jsonb_array_elements_text(p->'operating_days');
 select coalesce(array_agg(value::date),'{}'::date[]) into exclusions from jsonb_array_elements_text(coalesce(p->'excluded_dates','[]'::jsonb));
 perform pg_advisory_xact_lock(hashtextextended(upper(trim(p->>'plate')),1));
 select * into v from public.vehicles where upper(trim(plate))=upper(trim(p->>'plate')) for update;
 if found then
  if exists(select 1 from public.contracts where vehicle_id=v.id and status='active') or v.status<>'Disponible' then raise exception 'Ce véhicule est déjà affecté ou indisponible';end if;
  if v.vin is not null and v.vin<>trim(p->>'vin') then raise exception 'Le châssis ne correspond pas au véhicule enregistré';end if;
  update public.vehicles set vin=trim(p->>'vin'),tracker_id=trim(p->>'tracker_id'),status='En location',driver=a.name where id=v.id;
 else
  insert into public.vehicles(model,plate,status,driver,vin,tracker_id) values(trim(p->>'model'),upper(trim(p->>'plate')),'En location',a.name,trim(p->>'vin'),trim(p->>'tracker_id')) returning * into v;
 end if;
 insert into public.drivers(application_id,full_name,phone,status) values(a.id,a.name,a.phone,'active') on conflict(application_id) do update set status='active' returning id into d;
 insert into public.contracts(request_id,command_payload,application_id,driver_id,vehicle_id,contract_type,currency,start_date,end_date,first_payment_date,daily_lolc,daily_gml,operating_days,excluded_dates,signed_reference,created_by)
 values((p->>'request_id')::uuid,p,a.id,d,v.id,a.program_type,p->>'currency',start_day,last_day,first_day,l,g,days,exclusions,trim(p->>'signed_reference'),auth.uid()) returning id into result_id;
 insert into public.repayment_schedules(contract_id,due_on,lolc_due,gml_due)
 select result_id,dt::date,l,g from generate_series(first_day,last_day,interval '1 day') dt where extract(isodow from dt)::integer=any(days) and not dt::date=any(exclusions);
 get diagnostics row_count=row_count;if row_count=0 then raise exception 'Aucune échéance pour ces dates et jours';end if;
 insert into public.vehicle_assignments(contract_id,driver_id,vehicle_id,start_date,assigned_by) values(result_id,d,v.id,start_day,auth.uid());
 insert into public.finance_events(actor_id,action,entity_id,details) values(auth.uid(),'contract_activated',result_id::text,p);
 return result_id;
end $$;

create function private.confirm_cash_payment(p jsonb) returns bigint language plpgsql security definer set search_path='' as $$
declare c public.contracts; existing public.payments; receipt_id bigint; s record; remaining numeric; part numeric; lolc_part numeric; total_lolc numeric:=0; outstanding numeric; paid_date date; paid_amount numeric;
begin
 if not private.is_cashier() then raise exception 'Confirmation réservée à la caisse';end if;
 if p->>'request_id' is null then raise exception 'Identifiant de requête requis';end if;
 perform pg_advisory_xact_lock(hashtextextended(p->>'request_id',0));
 select * into existing from public.payments where request_id=(p->>'request_id')::uuid;
 if found then if existing.command_payload<>p then raise exception 'Requête réutilisée avec des valeurs différentes';end if;return existing.id;end if;
 select * into c from public.contracts where id=(p->>'contract_id')::uuid for update;
 if not found or c.status<>'active' then raise exception 'Contrat actif requis';end if;
 paid_amount:=(p->>'amount')::numeric;paid_date:=(p->>'paid_on')::date;
 if paid_amount is null or paid_amount::text='NaN' or paid_amount<=0 or paid_amount<>round(paid_amount,2) then raise exception 'Montant positif avec deux décimales maximum';end if;
 if paid_date is null or paid_date<c.start_date or paid_date>(now() at time zone 'Africa/Kinshasa')::date then raise exception 'Date de paiement invalide';end if;
 if coalesce(trim(p->>'reference'),'')='' or coalesce(trim(p->>'reason'),'')='' or p->>'method' not in ('Espèces','M-Pesa','Orange Money','Airtel Money','Afrimoney','Virement') then raise exception 'Méthode, référence et motif requis';end if;
 if coalesce(p->>'proof_path','')<>'' and not exists(select 1 from storage.objects where bucket_id='finance-proofs' and name=p->>'proof_path') then raise exception 'Justificatif introuvable';end if;
 select sum(sch.lolc_due+sch.gml_due)-coalesce((select sum(x.amount) from public.payment_allocations x join public.repayment_schedules y on y.id=x.schedule_id where y.contract_id=c.id),0) into outstanding from public.repayment_schedules sch where sch.contract_id=c.id;
 if paid_amount>outstanding then raise exception 'Montant supérieur au solde du contrat (%)',outstanding;end if;
 insert into public.payments(driver_name,amount,paid_on,method,reference,contract_id,request_id,command_payload,recorded_by,reason,proof_path)
 select full_name,paid_amount,paid_date,p->>'method',trim(p->>'reference'),c.id,(p->>'request_id')::uuid,p,auth.uid(),trim(p->>'reason'),nullif(p->>'proof_path','') from public.drivers where id=c.driver_id returning id into receipt_id;
 remaining:=paid_amount;
 for s in select r.*,coalesce(sum(x.amount),0) paid,coalesce(sum(x.lolc_amount),0) lolc_paid from public.repayment_schedules r left join public.payment_allocations x on x.schedule_id=r.id where r.contract_id=c.id group by r.id order by r.due_on loop
  part:=least(remaining,s.lolc_due+s.gml_due-s.paid);if part<=0 then continue;end if;
  lolc_part:=round(part*(s.lolc_due-s.lolc_paid)/(s.lolc_due+s.gml_due-s.paid),2);
  -- Split the outstanding components, including after reversals; the final payment clears them exactly.
  insert into public.payment_allocations(payment_id,schedule_id,amount,lolc_amount) values(receipt_id,s.id,part,lolc_part);
  total_lolc:=total_lolc+lolc_part;remaining:=remaining-part;exit when remaining=0;
 end loop;
 if remaining<>0 then raise exception 'Allocation incomplète';end if;
 update public.payments set lolc_amount=total_lolc where id=receipt_id;
 insert into public.finance_events(actor_id,action,entity_id,details) values(auth.uid(),'payment_confirmed',receipt_id::text,p||jsonb_build_object('lolc_amount',total_lolc));
 return receipt_id;
end $$;

create function private.reverse_cash_payment(p jsonb) returns bigint language plpgsql security definer set search_path='' as $$
declare original public.payments;existing public.payments;result_id bigint;
begin
 if not private.is_cashier() then raise exception 'Action réservée à la caisse';end if;
 if p->>'request_id' is null then raise exception 'Identifiant de requête requis';end if;
 perform pg_advisory_xact_lock(hashtextextended(p->>'request_id',0));
 select * into existing from public.payments where request_id=(p->>'request_id')::uuid;
 if found then if existing.command_payload<>p then raise exception 'Requête différente';end if;return existing.id;end if;
 select * into original from public.payments where id=(p->>'payment_id')::bigint;
 if not found or original.contract_id is null or original.entry_kind<>'payment' then raise exception 'Versement introuvable';end if;
 perform 1 from public.contracts where id=original.contract_id for update;
 if coalesce(trim(p->>'reason'),'')='' then raise exception 'Motif obligatoire';end if;
 if exists(select 1 from public.lolc_deposit_items where payment_id=original.id) then raise exception 'Déjà déposé à LOLC : régularisation comptable requise, annulation bloquée';end if;
 insert into public.payments(driver_name,amount,paid_on,method,reference,contract_id,entry_kind,reverses_payment_id,request_id,command_payload,recorded_by,reason,lolc_amount)
 values(original.driver_name,original.amount,(now() at time zone 'Africa/Kinshasa')::date,original.method,'ANN-'||original.id::text,original.contract_id,'reversal',original.id,(p->>'request_id')::uuid,p,auth.uid(),trim(p->>'reason'),original.lolc_amount) returning id into result_id;
 insert into public.payment_allocations(payment_id,schedule_id,amount,lolc_amount) select result_id,schedule_id,-amount,-lolc_amount from public.payment_allocations where payment_id=original.id;
 insert into public.finance_events(actor_id,action,entity_id,details) values(auth.uid(),'payment_reversed',result_id::text,p);
 return result_id;
end $$;

create function private.record_lolc_deposit(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare existing public.lolc_deposits;result_id uuid;ids bigint[];expected numeric;valid_count integer;start_day date;end_day date;deposit_day date;
begin
 if not private.is_cashier() then raise exception 'Action réservée à la caisse';end if;
 if p->>'request_id' is null then raise exception 'Identifiant de requête requis';end if;
 perform pg_advisory_xact_lock(hashtextextended(p->>'request_id',0));
 select * into existing from public.lolc_deposits where request_id=(p->>'request_id')::uuid;
 if found then if existing.command_payload<>p then raise exception 'Requête différente';end if;return existing.id;end if;
 select array_agg(distinct value::bigint) into ids from jsonb_array_elements_text(p->'payment_ids');
 if coalesce(cardinality(ids),0)=0 then raise exception 'Sélectionnez les versements à rapprocher';end if;
 start_day:=(p->>'period_start')::date;end_day:=(p->>'period_end')::date;deposit_day:=(p->>'deposited_on')::date;
 if deposit_day>(now() at time zone 'Africa/Kinshasa')::date or end_day<start_day or deposit_day<start_day then raise exception 'Dates du dépôt invalides';end if;
 if coalesce(trim(p->>'bank_reference'),'')='' then raise exception 'Référence bancaire requise';end if;
 if not exists(select 1 from storage.objects where bucket_id='finance-proofs' and name=p->>'proof_path') then raise exception 'Téléversez le justificatif de dépôt';end if;
 perform 1 from public.contracts where id in (select contract_id from public.payments where id=any(ids)) order by id for update;
 perform 1 from public.payments where id=any(ids) order by id for update;
 select count(*),sum(r.lolc_amount) into valid_count,expected from public.payments r join public.contracts c on c.id=r.contract_id
 where r.id=any(ids) and r.entry_kind='payment' and r.lolc_amount>0 and c.currency=p->>'currency' and c.contract_type='DRIVE_TO_OWN'
 and r.paid_on between start_day and end_day and r.paid_on<=deposit_day
 and not exists(select 1 from public.payments v where v.reverses_payment_id=r.id)
 and not exists(select 1 from public.lolc_deposit_items i where i.payment_id=r.id);
 if valid_count<>cardinality(ids) then raise exception 'Un versement est annulé, déjà rapproché, hors période ou dans une autre devise';end if;
 if p->>'amount' is null or (p->>'amount')::numeric<>expected then raise exception 'Le dépôt doit correspondre à la part LOLC sélectionnée : %',expected;end if;
 insert into public.lolc_deposits(request_id,command_payload,currency,period_start,period_end,deposited_on,amount,bank_reference,proof_path,recorded_by)
 values((p->>'request_id')::uuid,p,p->>'currency',start_day,end_day,deposit_day,expected,trim(p->>'bank_reference'),p->>'proof_path',auth.uid()) returning id into result_id;
 insert into public.lolc_deposit_items(deposit_id,payment_id,amount) select result_id,id,lolc_amount from public.payments where id=any(ids);
 insert into public.finance_events(actor_id,action,entity_id,details) values(auth.uid(),'lolc_deposit_recorded',result_id::text,p);
 return result_id;
end $$;

create function private.void_contract(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.contracts;net numeric;
begin
 if not exists(select 1 from public.staff_members where user_id=auth.uid() and active and role='admin') then raise exception 'Action réservée à l’administration';end if;
 select * into c from public.contracts where id=(p->>'contract_id')::uuid for update;
 if not found then raise exception 'Contrat introuvable';end if;
 if c.status='void' then return c.id;end if;
 if coalesce(trim(p->>'reason'),'')='' then raise exception 'Motif requis';end if;
 select coalesce(sum(case when entry_kind='reversal' then -amount else amount end),0) into net from public.payments where contract_id=c.id;
 if net<>0 then raise exception 'Annulez les encaissements avant d’annuler le contrat';end if;
 update public.contracts set status='void',void_reason=p->>'reason',voided_by=auth.uid(),voided_at=now() where id=c.id;
 update public.vehicle_assignments set end_date=(now() at time zone 'Africa/Kinshasa')::date,reason_ended=p->>'reason' where contract_id=c.id;
 update public.vehicles set status='Disponible',driver=null where id=c.vehicle_id;
 update public.drivers set status='available' where id=c.driver_id;
 insert into public.finance_events(actor_id,action,entity_id,details) values(auth.uid(),'contract_voided',c.id::text,p);
 return c.id;
end $$;

-- Public invoker wrappers expose only the guarded, transactional operations.
create function public.activate_contract(p jsonb) returns uuid language sql security invoker set search_path='' as $$select private.activate_contract(p)$$;
create function public.confirm_cash_payment(p jsonb) returns bigint language sql security invoker set search_path='' as $$select private.confirm_cash_payment(p)$$;
create function public.reverse_cash_payment(p jsonb) returns bigint language sql security invoker set search_path='' as $$select private.reverse_cash_payment(p)$$;
create function public.record_lolc_deposit(p jsonb) returns uuid language sql security invoker set search_path='' as $$select private.record_lolc_deposit(p)$$;
create function public.void_contract(p jsonb) returns uuid language sql security invoker set search_path='' as $$select private.void_contract(p)$$;
do $$declare f text;begin
 foreach f in array array['activate_contract','confirm_cash_payment','reverse_cash_payment','record_lolc_deposit','void_contract'] loop
 execute format('revoke all on function private.%I(jsonb) from public,anon,authenticated',f);
 execute format('revoke all on function public.%I(jsonb) from public,anon,authenticated',f);
 execute format('grant execute on function private.%I(jsonb) to authenticated',f);
 execute format('grant execute on function public.%I(jsonb) to authenticated',f);
 end loop;
end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('finance-proofs','finance-proofs',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp']);
create policy finance_proof_read on storage.objects for select to authenticated using(bucket_id='finance-proofs' and (select private.is_staff()));
create policy finance_proof_upload on storage.objects for insert to authenticated with check(bucket_id='finance-proofs' and (select private.is_cashier()));
-- No client deletion: proofs referenced by confirmed entries must remain available.
notify pgrst,'reload schema';
commit;
