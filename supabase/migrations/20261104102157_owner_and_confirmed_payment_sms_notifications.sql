begin;
-- Future committed events only. Preserve existing event keys and never replay history.
create or replace function private.queue_contract_sms() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.applications;v public.vehicles;o public.applications;
begin
 select * into a from public.applications where id=new.application_id;
 perform private.queue_sms('contract:'||new.id,'contract_activated',a.phone,'GM Fleet : contrat '||new.signed_reference||' activé. Début : '||to_char(new.start_date,'DD/MM/YYYY')||'. Premier versement : '||to_char(new.first_payment_date,'DD/MM/YYYY')||'.',a.id);
 select * into v from public.vehicles where id=new.vehicle_id;
 if v.owner_application_id is not null then
  select * into o from public.applications where id=v.owner_application_id;
  perform private.queue_sms('contract:'||new.id||':owner','owner_assignment',o.phone,'GM Fleet : votre véhicule '||v.model||' ('||v.plate||') est affecté à un chauffeur. Début d’exploitation : '||to_char(new.start_date,'DD/MM/YYYY')||'. Contrat chauffeur : '||new.signed_reference||'.',o.id);
 end if;
 return new;
end $$;

create or replace function private.queue_payment_sms() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.applications;c public.contracts;v public.vehicles;o public.applications;description text;
begin
 select * into c from public.contracts where id=new.contract_id;
 if not found then return new;end if;
 select * into a from public.applications where id=c.application_id;
 description:=case when new.entry_kind='reversal' then 'annulation de versement enregistrée : ' else 'versement confirmé : ' end||to_char(new.amount,'FM999999999990.00')||' '||c.currency||' le '||to_char(new.paid_on,'DD/MM/YYYY')||'. Réf. '||new.reference||'.';
 if a.id is not null then
  perform private.queue_sms('payment:'||new.id,'payment_receipt',a.phone,'GM Fleet : '||description,a.id);
 end if;
 select * into v from public.vehicles where id=c.vehicle_id;
 if v.owner_application_id is not null then
  select * into o from public.applications where id=v.owner_application_id;
  perform private.queue_sms('payment:'||new.id||':owner','owner_collection',o.phone,'GM Fleet - '||v.model||' ('||v.plate||') : '||description||' Encaissement chauffeur. Votre règlement propriétaire suit le bilan mensuel.',o.id);
 end if;
 return new;
end $$;

create function private.queue_owner_settlement_sms() returns trigger language plpgsql security definer set search_path='' as $$
declare m public.fleet_mandates;o public.applications;v public.vehicles;
begin
 select * into m from public.fleet_mandates where id=new.mandate_id;
 select * into o from public.applications where id=m.owner_application_id;
 select * into v from public.vehicles where id=m.vehicle_id;
 perform private.queue_sms('owner-settlement:'||new.id,'owner_settlement',o.phone,'GM Fleet - '||v.model||' ('||v.plate||') : règlement propriétaire confirmé, période '||to_char(new.period_start,'DD/MM/YYYY')||' au '||to_char(new.period_end,'DD/MM/YYYY')||'. Net versé : '||to_char(new.owner_net,'FM999999999990.00')||' USD. Retenue avances : '||to_char(new.recovered,'FM999999999990.00')||' USD. Date : '||to_char(new.paid_on,'DD/MM/YYYY')||'. Réf. '||coalesce(nullif(new.payment_reference,''),new.id::text)||'.',o.id);
 return new;
end $$;
create trigger z_queue_owner_settlement_sms after insert on public.owner_settlements for each row execute function private.queue_owner_settlement_sms();

create function private.queue_lolc_deposit_receipt_sms() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.applications;
begin
 -- Equipment payments belong to GML, not to the applicant's deposit receipt.
 if new.kind<>'client_deposit_lolc' then return new;end if;
 select * into a from public.applications where id=new.application_id;
 perform private.queue_sms('lolc-deposit:'||new.id,'lolc_deposit_receipt',a.phone,'GM Fleet : dépôt client LOLC enregistré : '||to_char(new.amount,'FM999999999990.00')||' USD le '||to_char(new.paid_on,'DD/MM/YYYY')||'. Réf. '||new.reference||'. Dossier '||a.case_reference||'.',a.id);
 return new;
end $$;
create trigger z_queue_lolc_deposit_receipt_sms after insert on public.lolc_case_payments for each row execute function private.queue_lolc_deposit_receipt_sms();
revoke all on function private.queue_contract_sms(),private.queue_payment_sms(),private.queue_owner_settlement_sms(),private.queue_lolc_deposit_receipt_sms() from public,anon,authenticated;
commit;
