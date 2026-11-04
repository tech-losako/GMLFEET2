begin;
update public.sms_dispatches set status='cancelled',error='Suivi des encaissements réservé à la direction ; propriétaire notifié au règlement mensuel' where kind='owner_collection' and status='pending';
alter table public.staff_members add column receives_finance_sms boolean not null default false;
-- The recipient was explicitly selected by the user; never infer it from a test number.
do $$begin
 if (select count(*) from public.staff_members where lower(btrim(display_name))='eric ebabi' and active and deleted_at is null)<>1 then raise exception 'Unique active Eric Ebabi account required';end if;
 update public.staff_members set receives_finance_sms=true where lower(btrim(display_name))='eric ebabi' and active and deleted_at is null;
end $$;
create function private.set_finance_sms_recipients(p jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.staff_members where user_id=auth.uid() and active and deleted_at is null and role='super_admin') then raise exception 'Super Admin requis';end if;
 if jsonb_typeof(p->'user_ids')<>'array' then raise exception 'Destinataires requis';end if;
 if exists(select 1 from jsonb_array_elements_text(p->'user_ids') x where not exists(select 1 from public.staff_members s where s.user_id=x.value::uuid and s.active and s.deleted_at is null and s.phone is not null and s.role in('super_admin','admin'))) then raise exception 'Administrateur actif avec téléphone requis';end if;
 update public.staff_members set receives_finance_sms=(user_id in(select value::uuid from jsonb_array_elements_text(p->'user_ids')));
end $$;
create function public.set_finance_sms_recipients(p jsonb) returns void language sql security invoker set search_path='' as $$select private.set_finance_sms_recipients(p)$$;
revoke all on function private.set_finance_sms_recipients(jsonb),public.set_finance_sms_recipients(jsonb) from public,anon;
grant execute on function private.set_finance_sms_recipients(jsonb),public.set_finance_sms_recipients(jsonb) to authenticated;
create function private.queue_boss_finance_sms(k text,msg text,a bigint default null) returns void language plpgsql security definer set search_path='' as $$
declare ph text;
begin
 for ph in select distinct phone from public.staff_members where active and deleted_at is null and receives_finance_sms and phone is not null and role in('super_admin','admin') loop
  perform private.queue_sms(k||':boss:'||ph,'boss_payment',ph,msg,a);
 end loop;
end $$;
create or replace function private.queue_payment_sms() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.applications;c public.contracts;description text;
begin
 select * into c from public.contracts where id=new.contract_id;if not found then return new;end if;
 select * into a from public.applications where id=c.application_id;
 description:=case when new.entry_kind='reversal' then 'annulation de versement : ' else 'versement confirmé : ' end||to_char(new.amount,'FM999999999990.00')||' '||c.currency||' le '||to_char(new.paid_on,'DD/MM/YYYY')||'. Réf. '||new.reference||'.';
 if a.id is not null then perform private.queue_sms('payment:'||new.id,'payment_receipt',a.phone,'GM Fleet : '||description,a.id);end if;
 perform private.queue_boss_finance_sms('payment:'||new.id,'GM Fleet caisse - '||coalesce(a.name,new.driver_name,'Chauffeur')||' : '||description||' GML : '||to_char(new.amount-new.lolc_amount,'FM999999999990.00')||' '||c.currency||'. LOLC : '||to_char(new.lolc_amount,'FM999999999990.00')||' '||c.currency||'. Mode : '||case when new.method ilike 'Araka%' then 'Paiement digital' else new.method end||'.',a.id);
 return new;
end $$;
create or replace function private.queue_lolc_deposit_receipt_sms() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.applications;msg text;
begin
 select * into a from public.applications where id=new.application_id;
 if new.kind='client_deposit_lolc' then
  msg:='GM Fleet : dépôt client LOLC enregistré : '||to_char(new.amount,'FM999999999990.00')||' USD le '||to_char(new.paid_on,'DD/MM/YYYY')||'. Réf. '||new.reference||'. Dossier '||a.case_reference||'.';
  perform private.queue_sms('lolc-deposit:'||new.id,'lolc_deposit_receipt',a.phone,msg,a.id);
  perform private.queue_boss_finance_sms('lolc-deposit:'||new.id,msg||' Part GML sur ce dépôt : 0 USD. Le règlement équipements GML est suivi séparément.',a.id);
 elsif new.kind='equipment_received' then
  perform private.queue_boss_finance_sms('lolc-equipment:'||new.id,'GM Fleet - '||a.name||' : équipement GML encaissé '||to_char(new.amount,'FM999999999990.00')||' USD le '||to_char(new.paid_on,'DD/MM/YYYY')||'. Forfait prévu 240 USD = tracker 130 + installation 20 + service 7.50/mois x 12 = 90. Réf. '||new.reference||'.',a.id);
 end if;
 return new;
end $$;

commit;
