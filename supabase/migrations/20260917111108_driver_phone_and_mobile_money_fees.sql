begin;
-- Historical receipts and attempts retain the amount originally collected.
alter table public.araka_attempts add column transaction_fee numeric(14,2) not null default 0 check(transaction_fee>=0), add column total_charged numeric(14,2) generated always as (amount+transaction_fee) stored;
alter table public.payments add column transaction_fee numeric(14,2) not null default 0 check(transaction_fee>=0), add column total_charged numeric(14,2) generated always as (amount+transaction_fee) stored;
grant select(transaction_fee,total_charged) on public.araka_attempts to authenticated;
create function private.receipt_transaction_fee() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.entry_kind='reversal' then
  select transaction_fee into new.transaction_fee from public.payments where id=new.reverses_payment_id;
 elsif new.method like 'Araka %' then
  select transaction_fee into new.transaction_fee from public.araka_attempts where id=new.request_id and contract_id=new.contract_id and amount=new.amount;
  if not found then raise exception 'Paiement Araka introuvable';end if;
 elsif new.method in ('M-Pesa','Orange Money','Airtel Money','Afrimoney') then new.transaction_fee:=round(new.amount*0.03,2);
 else new.transaction_fee:=0;
 end if;
 return new;
end $$;
revoke all on function private.receipt_transaction_fee() from public,anon,authenticated,service_role;
create trigger receipt_transaction_fee before insert on public.payments for each row execute function private.receipt_transaction_fee();
-- Cashier must explicitly confirm the full Mobile Money amount actually received.
do $$declare definition text;begin
 definition:=pg_get_functiondef('private.confirm_cash_payment(jsonb)'::regprocedure);
 definition:=replace(definition,'remaining:=paid_amount;',E'if p->>''method'' in (''M-Pesa'',''Orange Money'',''Airtel Money'',''Afrimoney'') and (p->>''received_total'')::numeric is distinct from paid_amount+round(paid_amount*0.03,2) then raise exception ''Confirmez le total reçu, frais Mobile Money de 3 %% inclus'';end if;\n remaining:=paid_amount;');
 execute definition;
end $$;
create function private.normalize_driver_phone(value text) returns text language sql immutable set search_path='' as $$
 select case when digits ~ '^0[0-9]{9}$' then '243'||substr(digits,2) when digits ~ '^243[0-9]{9}$' then digits else null end from (select regexp_replace(value,'[^0-9]','','g') digits) p
$$;
revoke all on function private.normalize_driver_phone(text) from public,anon,authenticated;
create table private.driver_phone_access(token_hash text primary key check(token_hash ~ '^[a-f0-9]{64}$'),user_id uuid not null references auth.users(id) on delete cascade,contract_id uuid not null references public.contracts(id),expires_at timestamptz not null default now()+interval '1 hour');
alter table private.driver_phone_access enable row level security;
revoke all on private.driver_phone_access from public,anon,authenticated;
create index driver_phone_access_user on private.driver_phone_access(user_id);
create index driver_phone_access_contract on private.driver_phone_access(contract_id);
create function private.issue_driver_phone_access(p jsonb) returns void language plpgsql security definer set search_path='' as $$
declare verified_phone text;chosen uuid;matches integer;
begin
 select private.normalize_driver_phone(phone) into verified_phone from auth.users where id=(p->>'user_id')::uuid and phone_confirmed_at is not null;
 if verified_phone is null then raise exception 'Vérifiez votre numéro par SMS';end if;
 select count(*),(array_agg(c.id))[1] into matches,chosen from public.contracts c join public.drivers d on d.id=c.driver_id where c.status='active' and private.normalize_driver_phone(d.phone)=verified_phone;
 if matches<>1 then raise exception 'Aucun contrat unique disponible pour ce numéro. Contactez la caisse GM Fleet.';end if;
 delete from private.driver_phone_access where user_id=(p->>'user_id')::uuid or expires_at<now();
 insert into private.driver_phone_access(token_hash,user_id,contract_id) values(p->>'token_hash',(p->>'user_id')::uuid,chosen);
end $$;
create function public.issue_driver_phone_access(p jsonb) returns void language sql security invoker set search_path='' as $$ select private.issue_driver_phone_access(p) $$;
revoke all on function private.issue_driver_phone_access(jsonb),public.issue_driver_phone_access(jsonb) from public,anon,authenticated;
grant execute on function private.issue_driver_phone_access(jsonb),public.issue_driver_phone_access(jsonb) to service_role;
create or replace function private.driver_payment_context(token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.contracts;name text;total numeric;due numeric;items jsonb;
begin
 select x.* into c from public.contracts x join private.driver_payment_links l on l.contract_id=x.id where l.token_hash=token and x.status='active';
 if not found then
  select x.* into c from private.driver_phone_access l join public.contracts x on x.id=l.contract_id join public.drivers d on d.id=x.driver_id join auth.users u on u.id=l.user_id
  where l.token_hash=token and l.expires_at>now() and x.status='active' and u.phone_confirmed_at is not null and private.normalize_driver_phone(u.phone)=private.normalize_driver_phone(d.phone);
 end if;
 if not found then raise exception 'Lien invalide ou contrat inactif';end if;
 select full_name into name from public.drivers where id=c.driver_id;
 select coalesce(sum(r.lolc_due+r.gml_due-coalesce(a.paid,0)),0),coalesce(sum(r.lolc_due+r.gml_due-coalesce(a.paid,0)) filter(where r.due_on<=(now() at time zone 'Africa/Kinshasa')::date),0) into total,due from public.repayment_schedules r left join lateral(select sum(amount) paid from public.payment_allocations where schedule_id=r.id) a on true where r.contract_id=c.id;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc),'[]') into items from (select id,reference,amount,transaction_fee,total_charged,currency,provider,state,receipt_id,created_at from public.araka_attempts where contract_id=c.id order by created_at desc limit 10) t;
 return jsonb_build_object('contract_id',c.id,'driver_name',name,'currency',c.currency,'daily_amount',c.daily_lolc+c.daily_gml,'total_remaining',total,'due',due,'attempts',items,'vehicle',(select jsonb_build_object('model',v.model,'plate',v.plate) from public.vehicles v where v.id=c.vehicle_id));
end $$;
create or replace function private.begin_araka_payment(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare context jsonb;c public.contracts;existing public.araka_attempts;value numeric;attempt_key uuid:=(p->>'id')::uuid;
begin
 context:=private.driver_payment_context(p->>'token_hash');
 select * into c from public.contracts where public.contracts.id=(context->>'contract_id')::uuid for update;
 select * into existing from public.araka_attempts where public.araka_attempts.id=attempt_key;
 if found then
  if existing.contract_id<>c.id or existing.amount is distinct from (p->>'amount')::numeric or existing.provider is distinct from p->>'provider' or existing.wallet is distinct from p->>'wallet' then raise exception 'Requête différente';end if;
  return to_jsonb(existing)||jsonb_build_object('dispatch',false);
 end if;
 context:=private.driver_payment_context(p->>'token_hash');value:=(p->>'amount')::numeric;
 if value is null or value::text in ('NaN','Infinity','-Infinity') or value<=0 or value<>round(value,2) or value>(context->>'total_remaining')::numeric or value+round(value*0.03,2)>999999.99 then raise exception 'Montant invalide ou supérieur au solde';end if;
 if p->>'wallet' is null or p->>'wallet' !~ '^\+243[0-9]{9}$' then raise exception 'Numéro Mobile Money : +243 suivi de 9 chiffres';end if;
 if exists(select 1 from public.araka_attempts where contract_id=c.id and state in ('pending','review')) then raise exception 'Un paiement attend déjà une vérification. Vérifiez son statut avant de recommencer';end if;
 insert into public.araka_attempts(id,contract_id,reference,amount,transaction_fee,currency,provider,wallet,callback_hash) values(attempt_key,c.id,'GM'||upper(substr(replace(attempt_key::text,'-',''),1,18)),value,round(value*0.03,2),c.currency,p->>'provider',p->>'wallet',p->>'callback_hash') returning * into existing;
 return to_jsonb(existing)||jsonb_build_object('dispatch',true,'driver_name',context->>'driver_name');
end $$;
notify pgrst,'reload schema';
commit;
