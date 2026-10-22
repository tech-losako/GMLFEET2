begin;
create table public.lolc_case_payments (
 id uuid primary key default gen_random_uuid(),
 application_id bigint not null references public.applications(id),
 kind text not null check(kind in ('client_deposit_lolc','equipment_received')),
 amount numeric(14,2) not null check(amount>0 and amount<='1000000'::numeric and amount<>'NaN'::numeric),
 purchase_price numeric(14,2),
 paid_on date not null,
 reference text not null check(length(btrim(reference)) between 2 and 150),
 notes text not null default '' check(length(notes)<=2000),
 recorded_by uuid not null references public.staff_members(user_id),
 created_at timestamptz not null default now(),
 request_id uuid not null unique,
 command_payload jsonb not null,
 check((kind='client_deposit_lolc' and purchase_price is not null and purchase_price>0 and purchase_price<=1000000 and purchase_price<>'NaN'::numeric and amount=round(purchase_price*0.20,2)) or (kind='equipment_received' and purchase_price is null and amount<=240)),
 unique(kind,reference)
);
create unique index lolc_one_client_deposit on public.lolc_case_payments(application_id) where kind='client_deposit_lolc';
create index lolc_case_payments_actor on public.lolc_case_payments(recorded_by);
alter table public.lolc_case_payments enable row level security;
revoke all on public.lolc_case_payments from public,anon,authenticated;
grant select on public.lolc_case_payments to authenticated;
create policy staff_read on public.lolc_case_payments for select to authenticated using((select private.is_staff()));

create function private.record_lolc_case_payment(p jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare a public.applications; existing public.lolc_case_payments; result_id uuid;
 amount_value numeric; price numeric; received_date date; kind_value text; received numeric; deposit_date date;
begin
 if not private.is_cashier() then raise exception 'Confirmation réservée à la caisse';end if;
 if p->>'request_id' is null then raise exception 'Identifiant de requête requis';end if;
 perform pg_advisory_xact_lock(hashtextextended(p->>'request_id',0));
 select * into existing from public.lolc_case_payments where request_id=(p->>'request_id')::uuid;
 if found then if existing.command_payload<>p then raise exception 'Requête réutilisée avec des valeurs différentes';end if;return existing.id;end if;
 select * into a from public.applications where id=(p->>'application_id')::bigint for update;
 if not found or a.program_type<>'DRIVE_TO_OWN' or a.review_status<>'accepted' then raise exception 'Dossier Car na ngai retenu requis';end if;
 amount_value:=(p->>'amount')::numeric;price:=nullif(p->>'purchase_price','')::numeric;received_date:=(p->>'paid_on')::date;kind_value:=p->>'kind';
 if amount_value is null or amount_value::text='NaN' or amount_value<=0 or amount_value>1000000 or amount_value<>round(amount_value,2) then raise exception 'Montant USD positif avec deux décimales maximum requis';end if;
 if received_date is null or received_date>(now() at time zone 'Africa/Kinshasa')::date then raise exception 'Date réelle non future requise';end if;
 if coalesce(length(btrim(p->>'reference')),0)<2 or length(p->>'reference')>150 or length(coalesce(p->>'notes',''))>2000 then raise exception 'Référence du justificatif requise';end if;
 if kind_value='client_deposit_lolc' then
  if price is null or price::text='NaN' or price<=0 or price>1000000 or price<>round(price,2) or amount_value<>round(price*0.20,2) then raise exception 'Le dépôt LOLC doit correspondre à 20 %% du prix d’achat du véhicule';end if;
  if exists(select 1 from public.lolc_case_payments where application_id=a.id and kind='client_deposit_lolc') then raise exception 'Dépôt de 20 %% déjà confirmé';end if;
 elsif kind_value='equipment_received' then
  if not exists(select 1 from public.lolc_case_payments where application_id=a.id and kind='client_deposit_lolc') then raise exception 'Confirmez d’abord le dépôt client de 20 %% chez LOLC';end if;
  select paid_on into deposit_date from public.lolc_case_payments where application_id=a.id and kind='client_deposit_lolc';
  if received_date<deposit_date then raise exception 'Le versement LOLC doit être reçu après le dépôt client';end if;
  select coalesce(sum(amount),0) into received from public.lolc_case_payments where application_id=a.id and kind='equipment_received';
  if amount_value+received>240 then raise exception 'Le total reçu de LOLC ne peut pas dépasser 240 USD';end if;
  price:=null;
 else raise exception 'Type de règlement invalide';end if;
 insert into public.lolc_case_payments(application_id,kind,amount,purchase_price,paid_on,reference,notes,recorded_by,request_id,command_payload)
 values(a.id,kind_value,amount_value,price,received_date,btrim(p->>'reference'),coalesce(p->>'notes',''),auth.uid(),(p->>'request_id')::uuid,p) returning id into result_id;
 insert into public.finance_events(actor_id,action,entity_id,details)
 values(auth.uid(),'lolc_case_payment_recorded',result_id::text,p||jsonb_build_object('currency','USD','equipment_expected',130,'installation_expected',20,'service_monthly',7.5,'service_months',12,'service_expected',90,'package_expected',240));
 return result_id;
end $$;
create function public.record_lolc_case_payment(p jsonb) returns uuid language sql security invoker set search_path='' as $$select private.record_lolc_case_payment(p)$$;
revoke all on function private.record_lolc_case_payment(jsonb),public.record_lolc_case_payment(jsonb) from public,anon;
grant execute on function private.record_lolc_case_payment(jsonb),public.record_lolc_case_payment(jsonb) to authenticated;

create function private.guard_lolc_deposit_approval() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if coalesce(new.service,'') not in ('Chauffeur Yango','Gestion de flotte','Recrutement','Recrutement Chauffeur') and new.lolc_status='approved' and old.lolc_status is distinct from 'approved'
 and not exists(select 1 from public.lolc_case_payments where application_id=new.id and kind='client_deposit_lolc') then
  raise exception 'Confirmez le dépôt client de 20 %% chez LOLC dans Financement LOLC avant l’approbation';
 end if;
 return new;
end $$;
revoke all on function private.guard_lolc_deposit_approval() from public,anon,authenticated;
create trigger require_lolc_client_deposit before insert or update on public.applications for each row execute function private.guard_lolc_deposit_approval();
notify pgrst,'reload schema';
commit;
