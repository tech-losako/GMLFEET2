begin;
create table public.fleet_mandates(
 id uuid primary key default gen_random_uuid(),vehicle_id bigint not null references public.vehicles(id),owner_application_id bigint not null references public.applications(id),
 reference text not null unique,category text not null check(category in ('A','B','C')),kinshasa_registered_on date not null,
 owner_target numeric(14,2) not null check(owner_target in (400,450,500)),management_fee numeric(14,2) not null default 64 check(management_fee=64),progression_reserve numeric(14,2) not null default 44 check(progression_reserve=44),
 signed_on date not null,acceptance_reference text not null check(length(trim(acceptance_reference))>=3),effective_start date,effective_end date,
 status text not null default 'awaiting_driver' check(status in ('awaiting_driver','active','ended')),created_by uuid not null references public.staff_members(user_id),created_at timestamptz not null default now(),request_id uuid not null unique,command_payload jsonb not null,
 check((effective_start is null and effective_end is null) or (effective_start is not null and effective_end= (effective_start+interval '12 months'-interval '1 day')::date))
);
create unique index fleet_mandate_current_vehicle on public.fleet_mandates(vehicle_id) where status in ('awaiting_driver','active');
create index fleet_mandate_owner on public.fleet_mandates(owner_application_id);
create index fleet_mandate_actor on public.fleet_mandates(created_by);
create table public.vehicle_inspections(
 id uuid primary key default gen_random_uuid(),vehicle_id bigint not null references public.vehicles(id),contract_id uuid references public.contracts(id),inspected_on date not null,inspection_sunday date not null,
 odometer integer not null check(odometer>=0),checks jsonb not null,notes text not null default '',roadworthy boolean not null,created_by uuid not null references public.staff_members(user_id),created_at timestamptz not null default now(),request_id uuid not null unique,command_payload jsonb not null,
 unique(vehicle_id,inspection_sunday)
);
create index vehicle_inspection_contract on public.vehicle_inspections(contract_id);
create index vehicle_inspection_actor on public.vehicle_inspections(created_by);
create table public.vehicle_issues(
 id uuid primary key default gen_random_uuid(),vehicle_id bigint references public.vehicles(id),application_id bigint references public.applications(id),inspection_id uuid references public.vehicle_inspections(id),driver_contract_id uuid references public.contracts(id),
 description text not null check(length(trim(description))>=3),responsibility text not null check(responsibility in ('owner','driver','undetermined')),evidence_reference text,reported_on date not null,
 status text not null default 'open' check(status in ('open','owner_repaired','gml_repaired','resolved')),created_by uuid not null references public.staff_members(user_id),created_at timestamptz not null default now(),request_id uuid not null unique,command_payload jsonb not null,
 check(vehicle_id is not null or application_id is not null)
);
create index vehicle_issues_vehicle on public.vehicle_issues(vehicle_id);
create index vehicle_issues_application on public.vehicle_issues(application_id);
create index vehicle_issues_inspection on public.vehicle_issues(inspection_id);
create index vehicle_issues_contract on public.vehicle_issues(driver_contract_id);
create index vehicle_issues_actor on public.vehicle_issues(created_by);
create table public.vehicle_advances(
 id uuid primary key default gen_random_uuid(),vehicle_id bigint references public.vehicles(id),application_id bigint references public.applications(id),driver_contract_id uuid references public.contracts(id),issue_id uuid references public.vehicle_issues(id),
 debtor text not null check(debtor in ('owner','driver')),kind text not null check(kind in ('fuel','repair','document')),description text not null check(length(trim(description))>=3),
 principal numeric(14,2) not null check(principal>0 and principal<=1000000 and principal<>'NaN'::numeric),fee numeric(14,2) not null,total numeric(14,2) not null,
 funded_on date not null,recovery_start date not null,recovery_deadline date not null,months integer not null check(months between 1 and 6),approval_reference text not null check(length(trim(approval_reference))>=3),expense_reference text not null check(length(trim(expense_reference))>=3),
 created_by uuid not null references public.staff_members(user_id),created_at timestamptz not null default now(),request_id uuid not null unique,command_payload jsonb not null,
 check(fee=round(principal*0.15,2) and total=principal+fee),check(recovery_deadline<=(funded_on+interval '6 months')::date),check((debtor='owner' and application_id is not null and driver_contract_id is null) or(debtor='driver' and driver_contract_id is not null and issue_id is not null))
);
create index advances_vehicle on public.vehicle_advances(vehicle_id);
create index advances_application on public.vehicle_advances(application_id);
create index advances_contract on public.vehicle_advances(driver_contract_id);
create index advances_issue on public.vehicle_advances(issue_id);
create index advances_actor on public.vehicle_advances(created_by);
alter table public.repayment_schedules add column additional_gml_due numeric(14,2) not null default 0 check(additional_gml_due>=0 and additional_gml_due<=gml_due);
alter table public.contracts add column supplemental_total numeric(14,2) not null default 0 check(supplemental_total>=0);
create table public.advance_instalments(
 id uuid primary key default gen_random_uuid(),advance_id uuid not null references public.vehicle_advances(id),due_on date not null,amount numeric(14,2) not null check(amount>0),schedule_id bigint references public.repayment_schedules(id),unique(advance_id,due_on)
);
create index advance_instalments_schedule on public.advance_instalments(schedule_id);
create table public.owner_settlements(
 id uuid primary key default gen_random_uuid(),mandate_id uuid not null references public.fleet_mandates(id),period_start date not null,period_end date not null,base_collected numeric(14,2) not null,owner_gross numeric(14,2) not null check(owner_gross>=0),management_fee numeric(14,2) not null,progression_reserve numeric(14,2) not null,cash_reserve numeric(14,2) not null check(cash_reserve>=0),recovered numeric(14,2) not null check(recovered>=0),owner_net numeric(14,2) not null check(owner_net>=0),
 adjustment_reason text,adjustment_approval text,payment_reference text not null check(length(trim(payment_reference))>=3),paid_on date not null,created_by uuid not null references public.staff_members(user_id),created_at timestamptz not null default now(),request_id uuid not null unique,command_payload jsonb not null,
 unique(mandate_id,period_start),check(period_start=date_trunc('month',period_start)::date and period_end=(period_start+interval '1 month'-interval '1 day')::date),check(owner_net=owner_gross-recovered),check(base_collected=owner_gross+management_fee+progression_reserve+cash_reserve)
);
create index owner_settlements_actor on public.owner_settlements(created_by);
create table public.advance_recoveries(
 id bigint generated always as identity primary key,instalment_id uuid not null references public.advance_instalments(id),payment_id bigint references public.payments(id),settlement_id uuid references public.owner_settlements(id),amount numeric(14,2) not null check(amount<>0),created_at timestamptz not null default now(),
 check((payment_id is null)<>(settlement_id is null)),unique(instalment_id,payment_id),unique(instalment_id,settlement_id)
);
create index advance_recoveries_payment on public.advance_recoveries(payment_id);
create index advance_recoveries_settlement on public.advance_recoveries(settlement_id);
do $$declare t text;begin foreach t in array array['fleet_mandates','vehicle_inspections','vehicle_issues','vehicle_advances','advance_instalments','owner_settlements','advance_recoveries'] loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);execute format('create policy staff_read on public.%I for select to authenticated using((select private.is_staff()))',t);end loop;end $$;

create function private.case_sim_change_allowed(previous jsonb,updated jsonb) returns boolean language plpgsql set search_path='' as $body$
declare sim_keys text[]:=array['equipment_package','sim_number','sim_operator','sim_iccid','dashcam_sim_number','dashcam_sim_operator','dashcam_sim_iccid'];
begin
 if (previous-array['equipment','last_equipment_update']) is distinct from (updated-array['equipment','last_equipment_update']) or ((previous->'equipment')-sim_keys) is distinct from ((updated->'equipment')-sim_keys) or coalesce(previous->'equipment'->>'equipment_package',case when nullif(previous->'equipment'->>'dashcam_id','') is not null then 'tracker_camera' else 'tracker' end) is distinct from updated->'equipment'->>'equipment_package' then return false;end if;
 perform private.validate_case_equipment(updated->'equipment');return true;
end $body$;
revoke all on function private.case_sim_change_allowed(jsonb,jsonb) from public,anon,authenticated;
do $guard$
declare definition text;marker text:='or new.preparation<>old.preparation then';begin
 definition:=pg_get_functiondef('private.guard_case_lifecycle()'::regprocedure);if position(marker in definition)=0 then raise exception 'Unexpected active case guard';end if;
 definition:=replace(definition,marker,'or (new.preparation<>old.preparation and not private.case_sim_change_allowed(old.preparation,new.preparation)) then');execute definition;
end $guard$;
create function private.create_fleet_mandate(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare v public.vehicles;existing public.fleet_mandates;d date;cat text;result_id uuid:=gen_random_uuid();signed_date date;
begin
 if not private.is_cashier() then raise exception 'Contrat réservé à la caisse / administration';end if;
 if p->>'request_id' is null then raise exception 'Identifiant de requête requis';end if;
 perform pg_advisory_xact_lock(hashtextextended(p->>'request_id',0));select * into existing from public.fleet_mandates where request_id=(p->>'request_id')::uuid;
 if found then if existing.command_payload<>p then raise exception 'Requête réutilisée avec des valeurs différentes';end if;return existing.id;end if;
 select * into v from public.vehicles where id=(p->>'vehicle_id')::bigint for update;
 if not found or v.owner_application_id is null then raise exception 'Véhicule propriétaire intégré requis';end if;
 perform private.validate_case_equipment((select preparation->'equipment' from public.applications where id=v.owner_application_id));
 if exists(select 1 from public.contracts where vehicle_id=v.id and status='active') then raise exception 'Enregistrez le mandat avant l’affectation du chauffeur';end if;
 d:=(p->>'kinshasa_registered_on')::date;signed_date:=(p->>'signed_on')::date;
 if d is null or signed_date is null or d>signed_date or signed_date>(now() at time zone 'Africa/Kinshasa')::date then raise exception 'Dates d’immatriculation à Kinshasa et de signature valides requises';end if;
 cat:=case when signed_date<=d+interval '2 years' then 'A' when signed_date<=d+interval '4 years' then 'B' else 'C' end;
 insert into public.fleet_mandates(id,vehicle_id,owner_application_id,reference,category,kinshasa_registered_on,owner_target,signed_on,acceptance_reference,created_by,request_id,command_payload)
 values(result_id,v.id,v.owner_application_id,'GMF-MAN-'||to_char(signed_date,'YYYY')||'-'||upper(substr(replace(result_id::text,'-',''),1,12)),cat,d,case cat when 'A' then 500 when 'B' then 450 else 400 end,signed_date,btrim(p->>'acceptance_reference'),auth.uid(),(p->>'request_id')::uuid,p);
 insert into public.finance_events(actor_id,action,entity_id,details) values(auth.uid(),'fleet_mandate_signed',result_id::text,p||jsonb_build_object('category',cat));return result_id;
end $$;
create function private.guard_managed_assignment() returns trigger language plpgsql security definer set search_path='' as $$
declare v public.vehicles;m public.fleet_mandates;first_date date;end_date date;
begin
 select * into v from public.vehicles where id=new.vehicle_id;if v.owner_application_id is null then return new;end if;
 select * into m from public.fleet_mandates where vehicle_id=v.id and status in ('awaiting_driver','active') for update;
 if not found then raise exception 'Signez le mandat de gestion propriétaire avant d’affecter ce véhicule';end if;
 first_date:=new.start_date+1;while extract(isodow from first_date)>5 loop first_date:=first_date+1;end loop;
 if new.contract_type<>'PARTNER_DRIVER' or new.currency<>'USD' or new.daily_lolc<>0 or new.daily_gml<>31 or new.operating_days<>array[1,2,3,4,5] or new.first_payment_date<>first_date or new.start_date<m.signed_on then raise exception 'Gestion de flotte : chauffeur partenaire, 31 USD GML, lundi–vendredi, premier versement le prochain jour admissible après affectation';end if;
 end_date:=coalesce(m.effective_end,(new.start_date+interval '12 months'-interval '1 day')::date);
 if new.end_date>end_date then raise exception 'Le contrat chauffeur dépasse le mandat propriétaire';end if;
 update public.fleet_mandates set status='active',effective_start=coalesce(effective_start,new.start_date),effective_end=end_date where id=m.id;
 return new;
end $$;
create trigger managed_assignment_guard before insert on public.contracts for each row execute function private.guard_managed_assignment();

create function private.record_fleet_inspection(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare existing public.vehicle_inspections;v public.vehicles;d date;sun date;k text;ok boolean:=true;result_id uuid;cid uuid;
begin
 if not private.is_staff() then raise exception 'Accès personnel requis';end if;
 if p->>'request_id' is null then raise exception 'Identifiant de requête requis';end if;
 perform pg_advisory_xact_lock(hashtextextended(p->>'request_id',0));select * into existing from public.vehicle_inspections where request_id=(p->>'request_id')::uuid;
 if found then if existing.command_payload<>p then raise exception 'Requête réutilisée';end if;return existing.id;end if;
 select * into v from public.vehicles where id=(p->>'vehicle_id')::bigint for update;if not found then raise exception 'Véhicule introuvable';end if;
 d:=(p->>'inspected_on')::date;if d is null or d>(now() at time zone 'Africa/Kinshasa')::date then raise exception 'Date de contrôle réelle requise';end if;
 sun:=d+(7-extract(isodow from d)::integer);
 foreach k in array array['engine','brakes','tyres','lights','body','interior','documents','equipment'] loop
 if jsonb_typeof(p->'checks'->k) is distinct from 'boolean' then raise exception 'Chaque point du contrôle doit être renseigné';end if;ok:=ok and (p->'checks'->>k)::boolean;end loop;
 if not ok and coalesce(length(btrim(p->>'notes')),0)<3 then raise exception 'Décrivez les anomalies constatées';end if;
 select id into cid from public.contracts where vehicle_id=v.id and status='active';
 insert into public.vehicle_inspections(vehicle_id,contract_id,inspected_on,inspection_sunday,odometer,checks,notes,roadworthy,created_by,request_id,command_payload)
 values(v.id,cid,d,sun,(p->>'odometer')::integer,p->'checks',coalesce(btrim(p->>'notes'),''),ok,auth.uid(),(p->>'request_id')::uuid,p) returning id into result_id;
 insert into public.finance_events(actor_id,action,entity_id,details) values(auth.uid(),'vehicle_inspected',result_id::text,p);return result_id;
end $$;
create function private.report_vehicle_issue(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare existing public.vehicle_issues;v public.vehicles;result_id uuid;cid uuid;app bigint;
begin
 if not private.is_staff() then raise exception 'Accès personnel requis';end if;
 if p->>'request_id' is null then raise exception 'Identifiant de requête requis';end if;
 perform pg_advisory_xact_lock(hashtextextended(p->>'request_id',0));select * into existing from public.vehicle_issues where request_id=(p->>'request_id')::uuid;
 if found then if existing.command_payload<>p then raise exception 'Requête réutilisée';end if;return existing.id;end if;
 if nullif(p->>'vehicle_id','') is not null then select * into v from public.vehicles where id=(p->>'vehicle_id')::bigint for update;if not found then raise exception 'Véhicule introuvable';end if;app:=v.owner_application_id;select id into cid from public.contracts where vehicle_id=v.id and status='active';
 else app:=(p->>'application_id')::bigint;if not exists(select 1 from public.applications where id=app and program_type='FLEET_OWNER' and review_status='accepted') then raise exception 'Dossier propriétaire accepté requis';end if;end if;
 if p->>'responsibility'='driver' and (cid is null or coalesce(length(btrim(p->>'evidence_reference')),0)<3) then raise exception 'Affectation active et référence des preuves requises pour imputer au chauffeur';end if;
 if nullif(p->>'inspection_id','') is not null and not exists(select 1 from public.vehicle_inspections where id=(p->>'inspection_id')::uuid and vehicle_id=v.id) then raise exception 'Le contrôle doit concerner le même véhicule';end if;
 insert into public.vehicle_issues(vehicle_id,application_id,inspection_id,driver_contract_id,description,responsibility,evidence_reference,reported_on,created_by,request_id,command_payload)
 values(v.id,app,nullif(p->>'inspection_id','')::uuid,cid,btrim(p->>'description'),p->>'responsibility',nullif(btrim(p->>'evidence_reference'),''),(now() at time zone 'Africa/Kinshasa')::date,auth.uid(),(p->>'request_id')::uuid,p) returning id into result_id;
 insert into public.finance_events(actor_id,action,entity_id,details) values(auth.uid(),'vehicle_issue_reported',result_id::text,p);return result_id;
end $$;
create function private.record_vehicle_advance(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare existing public.vehicle_advances;v public.vehicles;a public.applications;c public.contracts;issue public.vehicle_issues;result_id uuid:=gen_random_uuid();principal numeric;fee numeric;total numeric;months_value integer;start_date date;deadline date;funded date;remaining numeric;part numeric;daily numeric;i integer;dt date;r record;due_date date;last_due date;
begin
 if not private.is_cashier() then raise exception 'Avance réservée à la caisse / administration';end if;
 if p->>'request_id' is null then raise exception 'Identifiant de requête requis';end if;
 perform pg_advisory_xact_lock(hashtextextended(p->>'request_id',0));select * into existing from public.vehicle_advances where request_id=(p->>'request_id')::uuid;
 if found then if existing.command_payload<>p then raise exception 'Requête réutilisée avec des valeurs différentes';end if;return existing.id;end if;
 if nullif(p->>'vehicle_id','') is not null then select * into v from public.vehicles where id=(p->>'vehicle_id')::bigint for update;if not found then raise exception 'Véhicule introuvable';end if;
 else select * into a from public.applications where id=(p->>'application_id')::bigint for update;if not found or a.program_type<>'FLEET_OWNER' or a.review_status<>'accepted' then raise exception 'Dossier propriétaire accepté requis';end if;select * into v from public.vehicles where owner_application_id=a.id;end if;
 if p->>'debtor'='owner' then
  if a.id is null then select * into a from public.applications where id=v.owner_application_id for update;end if;
  if a.id is null then raise exception 'Avance propriétaire réservée à un véhicule sous gestion';end if;
 elsif p->>'debtor'='driver' then
  select * into c from public.contracts where id=(p->>'driver_contract_id')::uuid and vehicle_id=v.id and status='active' for update;
  if not found or p->>'kind'<>'repair' then raise exception 'Affectation active et réparation imputable requises';end if;
 else raise exception 'Choisissez le débiteur propriétaire ou chauffeur';end if;
 if p->>'kind'='repair' then
  select * into issue from public.vehicle_issues where id=(p->>'issue_id')::uuid for update;
  if not found or (v.id is not null and issue.vehicle_id is distinct from v.id) or (v.id is null and issue.application_id is distinct from a.id) or issue.responsibility is distinct from p->>'debtor' or (p->>'debtor'='driver' and issue.driver_contract_id is distinct from c.id) then raise exception 'Incident documenté et responsabilité correspondante requis';end if;
  if exists(select 1 from public.vehicle_advances where issue_id=issue.id) then raise exception 'Cette réparation est déjà financée';end if;
 end if;
 principal:=(p->>'principal')::numeric;months_value:=(p->>'months')::integer;start_date:=(p->>'recovery_start')::date;funded:=(p->>'funded_on')::date;
 if principal is null or principal::text='NaN' or principal<=0 or principal>1000000 or principal<>round(principal,2) or months_value is null or months_value not between 1 and 6 then raise exception 'Montant positif à deux décimales et durée de 1 à 6 mois requis';end if;
 if funded is null or start_date is null or funded>(now() at time zone 'Africa/Kinshasa')::date or start_date<funded or start_date>funded+31 then raise exception 'Date réelle de décaissement et début de remboursement dans les 31 jours requis';end if;
 fee:=round(principal*0.15,2);total:=principal+fee;remaining:=total;deadline:=least((start_date+(months_value||' months')::interval)::date,(funded+interval '6 months')::date);
 insert into public.vehicle_advances(id,vehicle_id,application_id,driver_contract_id,issue_id,debtor,kind,description,principal,fee,total,funded_on,recovery_start,recovery_deadline,months,approval_reference,expense_reference,created_by,request_id,command_payload)
 values(result_id,v.id,case when p->>'debtor'='owner' then a.id else null end,c.id,issue.id,p->>'debtor',p->>'kind',btrim(p->>'description'),principal,fee,total,funded,start_date,deadline,months_value,btrim(p->>'approval_reference'),btrim(p->>'expense_reference'),auth.uid(),(p->>'request_id')::uuid,p);
 if p->>'debtor'='owner' then
  for i in 0..months_value-1 loop
   due_date:=(date_trunc('month',start_date)+(i||' months')::interval+interval '1 month'-interval '1 day')::date;
   part:=case when i=months_value-1 then remaining else round(total/months_value,2) end;
   if part>0 then insert into public.advance_instalments(advance_id,due_on,amount) values(result_id,due_date,part);end if;remaining:=remaining-part;last_due:=due_date;
  end loop;
 else
  daily:=(p->>'daily_recovery')::numeric;if daily is null or daily::text='NaN' or daily<=0 or daily<>round(daily,2) then raise exception 'Supplément journalier positif requis';end if;
  for r in select s.* from public.repayment_schedules s where s.contract_id=c.id and s.due_on>=greatest(start_date,(now() at time zone 'Africa/Kinshasa')::date) and s.due_on<=least(deadline,c.end_date) and (case when c.payment_frequency='weekly' then s.due_on+(7-extract(isodow from s.due_on)::integer) else s.due_on end)<=deadline and not exists(select 1 from public.payment_allocations pa where pa.schedule_id=s.id group by pa.schedule_id having sum(pa.amount)>0) order by s.due_on for update loop
   part:=least(remaining,daily);insert into public.advance_instalments(advance_id,due_on,amount,schedule_id) values(result_id,r.due_on,part,r.id);
   update public.repayment_schedules set gml_due=gml_due+part,additional_gml_due=additional_gml_due+part where id=r.id;
   remaining:=remaining-part;last_due:=case when c.payment_frequency='weekly' then r.due_on+(7-extract(isodow from r.due_on)::integer) else r.due_on end;exit when remaining=0;
  end loop;
  if remaining<>0 then raise exception 'Le supplément choisi ne solde pas la dette avant six mois et la fin du contrat. Augmentez le supplément ou réduisez le montant financé';end if;
  update public.contracts set supplemental_total=supplemental_total+total where id=c.id;
 end if;
 if last_due>(funded+interval '6 months')::date then raise exception 'L’échéancier doit solder la dette dans les six mois du décaissement';end if;
 update public.vehicle_advances set recovery_deadline=last_due where id=result_id;

 insert into public.finance_events(actor_id,action,entity_id,details) values(auth.uid(),'vehicle_advance_funded',result_id::text,p||jsonb_build_object('fee_once',fee,'total',total));return result_id;
end $$;
create function private.allocate_advance_recovery() returns trigger language plpgsql security definer set search_path='' as $$
declare paid_before numeric;scheduled numeric;repair_remaining numeric;budget numeric;left_budget numeric;part numeric;r record;original bigint;remaining_components numeric;
begin
 if new.amount<0 then
  select reverses_payment_id into original from public.payments where id=new.payment_id;
  if original is null then raise exception 'Contre-écriture identifiée requise';end if;
  insert into public.advance_recoveries(instalment_id,payment_id,amount) select ar.instalment_id,new.payment_id,-ar.amount from public.advance_recoveries ar join public.advance_instalments ai on ai.id=ar.instalment_id where ar.payment_id=original and ai.schedule_id=new.schedule_id;
  return new;
 end if;
 select coalesce(sum(amount),0) into paid_before from public.payment_allocations where schedule_id=new.schedule_id and payment_id<>new.payment_id;
 select lolc_due+gml_due-paid_before into scheduled from public.repayment_schedules where id=new.schedule_id;
 select coalesce(sum(ai.amount-coalesce(paid_totals.paid,0)),0) into repair_remaining from public.advance_instalments ai left join lateral(select sum(amount) paid from public.advance_recoveries where instalment_id=ai.id) paid_totals on true where ai.schedule_id=new.schedule_id;
 if repair_remaining<=0 then return new;end if;
 budget:=least(new.amount-new.lolc_amount,repair_remaining,round(new.amount*repair_remaining/scheduled,2));left_budget:=budget;remaining_components:=repair_remaining;
 for r in select ai.*,ai.amount-coalesce(x.paid,0) remaining from public.advance_instalments ai left join lateral(select sum(amount) paid from public.advance_recoveries where instalment_id=ai.id) x on true where ai.schedule_id=new.schedule_id and ai.amount>coalesce(x.paid,0) order by ai.id loop
  part:=least(r.remaining,left_budget,case when remaining_components=r.remaining then left_budget else round(left_budget*r.remaining/remaining_components,2) end);
  if part>0 then insert into public.advance_recoveries(instalment_id,payment_id,amount) values(r.id,new.payment_id,part);end if;
  left_budget:=left_budget-part;remaining_components:=remaining_components-r.remaining;
 end loop;
 if left_budget<>0 then raise exception 'Rapprochement des remboursements incomplet';end if;return new;
end $$;
create trigger allocate_driver_advance after insert on public.payment_allocations for each row execute function private.allocate_advance_recovery();

create function private.owner_period_collections(mandate uuid,period date) returns numeric language sql stable security definer set search_path='' as $$
 select coalesce(sum((case when p.entry_kind='reversal' then -1 else 1 end)*(p.amount-p.lolc_amount)-coalesce(paid_totals.recovered,0)),0) from public.payments p join public.contracts c on c.id=p.contract_id join public.fleet_mandates m on m.vehicle_id=c.vehicle_id left join lateral(select sum(amount) recovered from public.advance_recoveries where payment_id=p.id) paid_totals on true where m.id=mandate and p.paid_on>=period and p.paid_on<(period+interval '1 month')::date;
$$;
create function private.record_owner_settlement(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare m public.fleet_mandates;existing public.owner_settlements;period date;last_date date;paid_date date;base numeric;gross numeric;reserve numeric;recovery numeric;result_id uuid;left_recovery numeric;part numeric;r record;
begin
 if not private.is_cashier() then raise exception 'Règlement réservé à la caisse / administration';end if;
 if p->>'request_id' is null then raise exception 'Identifiant de requête requis';end if;
 perform pg_advisory_xact_lock(hashtextextended(p->>'request_id',0));select * into existing from public.owner_settlements where request_id=(p->>'request_id')::uuid;
 if found then if existing.command_payload<>p then raise exception 'Requête réutilisée';end if;return existing.id;end if;
 select * into m from public.fleet_mandates where id=(p->>'mandate_id')::uuid for update;if not found or m.effective_start is null then raise exception 'Mandat effectivement démarré requis';end if;
 -- The same contract locks serialize cash/digital receipts and the month-end snapshot.
 perform 1 from public.contracts where vehicle_id=m.vehicle_id order by id for update;
 period:=(p->>'period_start')::date;last_date:=(period+interval '1 month'-interval '1 day')::date;paid_date:=(p->>'paid_on')::date;
 if period is null or period<>date_trunc('month',period)::date or last_date<(date_trunc('month',m.effective_start))::date or period>m.effective_end or paid_date is null or paid_date<last_date or paid_date>(now() at time zone 'Africa/Kinshasa')::date then raise exception 'Clôture mensuelle : période du mandat terminée et date réelle de paiement requises';end if;
 gross:=(p->>'owner_gross')::numeric;if gross is null or gross::text='NaN' or gross<0 or gross>m.owner_target or gross<>round(gross,2) then raise exception 'Règlement propriétaire entre zéro et le montant de sa catégorie';end if;
 if gross<>m.owner_target and (coalesce(length(btrim(p->>'adjustment_reason')),0)<3 or coalesce(length(btrim(p->>'adjustment_approval')),0)<3) then raise exception 'Motif et accord propriétaire requis pour ajuster le règlement cible';end if;
 base:=private.owner_period_collections(m.id,period);reserve:=base-gross-m.management_fee-m.progression_reserve;
 if reserve<0 then raise exception 'Encaissements insuffisants : ne confirmez pas un règlement non financé. Vérifiez les encaissements et les ajustements convenus';end if;
 select least(gross,coalesce(sum(ai.amount-coalesce(paid_totals.paid,0)),0)) into recovery from public.advance_instalments ai join public.vehicle_advances a on a.id=ai.advance_id left join lateral(select sum(amount) paid from public.advance_recoveries where instalment_id=ai.id) paid_totals on true where a.debtor='owner' and a.application_id=m.owner_application_id and ai.due_on<=last_date;
 insert into public.owner_settlements(mandate_id,period_start,period_end,base_collected,owner_gross,management_fee,progression_reserve,cash_reserve,recovered,owner_net,adjustment_reason,adjustment_approval,payment_reference,paid_on,created_by,request_id,command_payload)
 values(m.id,period,last_date,base,gross,m.management_fee,m.progression_reserve,reserve,recovery,gross-recovery,nullif(btrim(p->>'adjustment_reason'),''),nullif(btrim(p->>'adjustment_approval'),''),btrim(p->>'payment_reference'),paid_date,auth.uid(),(p->>'request_id')::uuid,p) returning id into result_id;
 left_recovery:=recovery;
 for r in select ai.*,ai.amount-coalesce(x.paid,0) remaining from public.advance_instalments ai join public.vehicle_advances a on a.id=ai.advance_id left join lateral(select sum(amount) paid from public.advance_recoveries where instalment_id=ai.id) x on true where a.debtor='owner' and a.application_id=m.owner_application_id and ai.due_on<=last_date and ai.amount>coalesce(x.paid,0) order by ai.due_on,ai.id for update of ai loop
  part:=least(left_recovery,r.remaining);if part<=0 then exit;end if;insert into public.advance_recoveries(instalment_id,settlement_id,amount) values(r.id,result_id,part);left_recovery:=left_recovery-part;
 end loop;
 if left_recovery<>0 then raise exception 'Remboursement propriétaire incomplet';end if;
 insert into public.finance_events(actor_id,action,entity_id,details) values(auth.uid(),'owner_month_settled',result_id::text,p||jsonb_build_object('gross',gross,'recovered',recovery,'net',gross-recovery,'reserve',reserve));return result_id;
end $$;
create function private.prevent_closed_month_reversal() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.entry_kind='payment' and exists(select 1 from public.contracts c join public.fleet_mandates m on m.vehicle_id=c.vehicle_id join public.owner_settlements os on os.mandate_id=m.id where c.id=new.contract_id and new.paid_on between os.period_start and os.period_end) then raise exception 'Mois propriétaire clôturé : utilisez la période réelle d’encaissement ouverte et un ajustement documenté si nécessaire';end if;
 if new.entry_kind='reversal' and exists(select 1 from public.payments p join public.contracts c on c.id=p.contract_id join public.fleet_mandates m on m.vehicle_id=c.vehicle_id join public.owner_settlements os on os.mandate_id=m.id where p.id=new.reverses_payment_id and p.paid_on between os.period_start and os.period_end) then raise exception 'Le mois propriétaire est clôturé. Enregistrez un ajustement documenté dans la période suivante';end if;return new;
end $$;
create trigger closed_owner_month_guard before insert on public.payments for each row execute function private.prevent_closed_month_reversal();

-- Initial fuel is owner-funded or an explicit approved GML advance.
do $patch$
declare definition text;marker text;
begin
 definition:=replace(pg_get_functiondef('private.onboard_owner_vehicle(jsonb)'::regprocedure),chr(13),'');
 marker:=' return v;'||chr(10)||'end';
 if position(marker in definition)=0 then raise exception 'Unexpected owner onboarding definition';end if;
 definition:=replace(definition,$old$ plate_value:=upper(trim(p->>'plate'));$old$,$new$ perform private.validate_case_equipment(a.preparation->'equipment');
 if btrim(p->>'tracker_id') is distinct from btrim(a.preparation->'equipment'->>'tracker_id') then raise exception 'Le tracker doit correspondre à l’installation du dossier';end if;
 plate_value:=upper(trim(p->>'plate'));$new$);
 definition:=replace(definition,$old$'fuel_amount',70$old$,$new$'fuel_funding',coalesce(p->>'fuel_funding','owner'),'fuel_amount',70$new$);
 definition:=replace(definition,marker,$new$ update public.vehicle_advances set vehicle_id=v where application_id=a.id and vehicle_id is null;
 update public.vehicle_issues set vehicle_id=v where application_id=a.id and vehicle_id is null;
 if coalesce(p->>'fuel_funding','owner')='gml' then
  perform private.record_vehicle_advance(jsonb_build_object('application_id',a.id,'vehicle_id',v,'debtor','owner','kind','fuel','description','Plein initial préfinancé par GML','principal',70,'months',(p->>'fuel_months')::integer,'funded_on',p->>'fuel_paid_on','recovery_start',p->>'fuel_paid_on','approval_reference',p->>'fuel_approval_reference','expense_reference',p->>'fuel_reference','request_id',p->>'fuel_request_id'));
 elsif coalesce(p->>'fuel_funding','owner')<>'owner' then raise exception 'Choisissez propriétaire ou avance GML pour le plein';end if;
 return v;
end$new$);
 execute definition;
end $patch$;
alter table public.vehicle_issues add column revision integer not null default 1;
create unique index vehicle_advance_one_issue on public.vehicle_advances(issue_id) where issue_id is not null;
create function private.update_vehicle_issue(p jsonb) returns uuid language plpgsql security definer set search_path='' as $body$
declare issue public.vehicle_issues;existing public.finance_events;cid uuid;
begin
 if not private.is_staff() then raise exception 'Accès personnel requis';end if;
 if p->>'request_id' is null then raise exception 'Identifiant de requête requis';end if;
 perform pg_advisory_xact_lock(hashtextextended(p->>'request_id',0));
 select * into existing from public.finance_events where action='vehicle_issue_updated' and details->>'request_id'=p->>'request_id';
 if found then if existing.details<>p then raise exception 'Requête réutilisée';end if;return existing.entity_id::uuid;end if;
 select * into issue from public.vehicle_issues where id=(p->>'issue_id')::uuid for update;if not found or issue.revision is distinct from (p->>'revision')::integer then raise exception 'Actualisez cet incident avant modification';end if;
 if exists(select 1 from public.vehicle_advances where issue_id=issue.id) and p->>'responsibility' is distinct from issue.responsibility then raise exception 'La responsabilité ne peut changer après financement';end if;
 select id into cid from public.contracts where vehicle_id=issue.vehicle_id and status='active';
 if p->>'responsibility'='driver' and (coalesce(issue.driver_contract_id,cid) is null or coalesce(length(btrim(p->>'evidence_reference')),0)<3) then raise exception 'Chauffeur affecté et preuve requis';end if;
 if coalesce(length(btrim(p->>'notes')),0)<3 then raise exception 'Décrivez la décision ou la résolution';end if;
 update public.vehicle_issues set responsibility=p->>'responsibility',status=p->>'status',driver_contract_id=coalesce(driver_contract_id,cid),evidence_reference=nullif(btrim(p->>'evidence_reference'),''),revision=revision+1 where id=issue.id;
 insert into public.finance_events(actor_id,action,entity_id,details) values(auth.uid(),'vehicle_issue_updated',issue.id::text,p);return issue.id;
end $body$;
do $snapshot$
declare definition text;begin
 definition:=pg_get_functiondef('private.activate_contract(jsonb)'::regprocedure);
 definition:=replace(definition,$old$'equipment',coalesce(a.preparation->'equipment','{}'::jsonb)$old$,$new$'equipment',case when v.owner_application_id is not null then coalesce((select preparation->'equipment' from public.applications where id=v.owner_application_id),'{}'::jsonb) else coalesce(a.preparation->'equipment','{}'::jsonb) end$new$);execute definition;
 definition:=pg_get_functiondef('private.driver_payment_context(text)'::regprocedure);
 definition:=replace(definition,$old$'expected',r.lolc_due+r.gml_due$old$,$new$'additional_gml_due',r.additional_gml_due,'expected',r.lolc_due+r.gml_due$new$);execute definition;
end $snapshot$;
do $$declare f text;begin
 foreach f in array array['create_fleet_mandate','record_fleet_inspection','report_vehicle_issue','record_vehicle_advance','record_owner_settlement','update_vehicle_issue'] loop
 execute format('create function public.%I(p jsonb) returns uuid language sql security invoker set search_path='''' as %L',f,'select private.'||f||'(p)');
 execute format('revoke all on function private.%I(jsonb),public.%I(jsonb) from public,anon',f,f);execute format('grant execute on function private.%I(jsonb),public.%I(jsonb) to authenticated',f,f);
 end loop;
end $$;
revoke all on function private.guard_managed_assignment(),private.allocate_advance_recovery(),private.prevent_closed_month_reversal(),private.owner_period_collections(uuid,date) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;

