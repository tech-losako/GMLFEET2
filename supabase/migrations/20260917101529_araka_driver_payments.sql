begin;
alter table public.finance_events alter column actor_id drop not null;
create table private.driver_payment_links(contract_id uuid primary key references public.contracts(id),token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),created_by uuid not null references public.staff_members(user_id),created_at timestamptz not null default now());
alter table private.driver_payment_links enable row level security;
revoke all on private.driver_payment_links from public,anon,authenticated;
create index payment_links_creator on private.driver_payment_links(created_by);
create table public.araka_attempts(
 id uuid primary key,contract_id uuid not null references public.contracts(id),reference text not null unique check(length(reference)<=20),
 amount numeric(14,2) not null check(amount>0),currency text not null check(currency in ('USD','CDF')),
 provider text not null check(provider in ('MPESA','AIRTEL','ORANGE','AFRIMONEY')),wallet text not null,
 state text not null default 'pending' check(state in ('pending','approved','declined','review')),
 transaction_id text unique,receipt_id bigint unique references public.payments(id),callback_hash text not null unique,
 created_at timestamptz not null default now(),last_checked_at timestamptz,verified_at timestamptz,review_reason text
);
alter table public.araka_attempts enable row level security;
revoke all on public.araka_attempts from anon,authenticated;
grant select(id,contract_id,reference,amount,currency,provider,state,transaction_id,receipt_id,created_at,last_checked_at,verified_at,review_reason) on public.araka_attempts to authenticated;
create policy staff_read_araka on public.araka_attempts for select to authenticated using((select private.is_staff()));
create index araka_contract on public.araka_attempts(contract_id);
create unique index one_unresolved_araka on public.araka_attempts(contract_id) where state='pending';
create function private.set_driver_payment_link(p jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_cashier() then raise exception 'Accès réservé à la caisse';end if;
 if not exists(select 1 from public.contracts where id=(p->>'contract_id')::uuid and status='active') then raise exception 'Contrat actif requis';end if;
 insert into private.driver_payment_links(contract_id,token_hash,created_by) values((p->>'contract_id')::uuid,p->>'token_hash',auth.uid()) on conflict(contract_id) do update set token_hash=excluded.token_hash,created_by=excluded.created_by,created_at=now();
 insert into public.finance_events(actor_id,action,entity_id,details) values(auth.uid(),'payment_link_rotated',p->>'contract_id','{}');
end $$;
create function private.driver_payment_context(token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.contracts;name text;total numeric;due numeric;items jsonb;
begin
 select x.* into c from public.contracts x join private.driver_payment_links l on l.contract_id=x.id where l.token_hash=token and x.status='active';
 if not found then raise exception 'Lien invalide ou contrat inactif';end if;
 select full_name into name from public.drivers where id=c.driver_id;
 select coalesce(sum(r.lolc_due+r.gml_due-coalesce(a.paid,0)),0),coalesce(sum(r.lolc_due+r.gml_due-coalesce(a.paid,0)) filter(where r.due_on<=(now() at time zone 'Africa/Kinshasa')::date),0) into total,due from public.repayment_schedules r left join lateral(select sum(amount) paid from public.payment_allocations where schedule_id=r.id) a on true where r.contract_id=c.id;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc),'[]') into items from (select id,reference,amount,currency,provider,state,receipt_id,created_at from public.araka_attempts where contract_id=c.id order by created_at desc limit 10) t;
 return jsonb_build_object('contract_id',c.id,'driver_name',name,'currency',c.currency,'daily_amount',c.daily_lolc+c.daily_gml,'total_remaining',total,'due',due,'attempts',items);
end $$;
create function private.begin_araka_payment(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
 if value is null or value::text in ('NaN','Infinity','-Infinity') or value<=0 or value<>round(value,2) or value>(context->>'total_remaining')::numeric or value>999999.99 then raise exception 'Montant invalide ou supérieur au solde';end if;
 if p->>'wallet' is null or p->>'wallet' !~ '^\+243[0-9]{9}$' then raise exception 'Numéro Mobile Money : +243 suivi de 9 chiffres';end if;
 if exists(select 1 from public.araka_attempts where contract_id=c.id and state in ('pending','review')) then raise exception 'Un paiement attend déjà une vérification. Vérifiez son statut avant de recommencer';end if;
 insert into public.araka_attempts(id,contract_id,reference,amount,currency,provider,wallet,callback_hash) values(attempt_key,c.id,'GM'||upper(substr(replace(attempt_key::text,'-',''),1,18)),value,c.currency,p->>'provider',p->>'wallet',p->>'callback_hash') returning * into existing;
 return to_jsonb(existing)||jsonb_build_object('dispatch',true,'driver_name',context->>'driver_name');
end $$;
-- Reuse the tested allocation algorithm behind a private, server-only entry point.
do $$ declare definition text;begin
 definition:=pg_get_functiondef('private.confirm_cash_payment(jsonb)'::regprocedure);
 definition:=replace(definition,'private.confirm_cash_payment','private.post_araka_receipt');
 definition:=replace(definition,'if not private.is_cashier() then raise exception ''Confirmation réservée à la caisse'';end if;','');
 definition:=replace(definition,'''Espèces'',''M-Pesa'',''Orange Money'',''Airtel Money'',''Afrimoney'',''Virement''','''Araka MPESA'',''Araka AIRTEL'',''Araka ORANGE'',''Araka AFRIMONEY''');
 execute definition;
end $$;
revoke all on function private.post_araka_receipt(jsonb) from public,anon,authenticated,service_role;
create function private.record_araka_status(p jsonb) returns text language plpgsql security definer set search_path='' as $$
declare a public.araka_attempts;result bigint;
begin
 select * into a from public.araka_attempts where id=(p->>'id')::uuid;
 if not found then raise exception 'Paiement introuvable';end if;
 perform 1 from public.contracts where id=a.contract_id for update;
 select * into a from public.araka_attempts where id=a.id for update;
 if a.state='approved' then return a.state;end if;
 if coalesce(p->>'transaction_id','')<>'' and a.transaction_id is not null and a.transaction_id<>p->>'transaction_id' then raise exception 'Identifiant Araka différent';end if;
 update public.araka_attempts set transaction_id=coalesce(nullif(p->>'transaction_id',''),transaction_id),last_checked_at=now() where id=a.id;
 if p->>'status'='APPROVED' then
  if coalesce(p->>'transaction_id',a.transaction_id,'')='' then raise exception 'Identifiant de transaction requis';end if;
  begin
   result:=private.post_araka_receipt(jsonb_build_object('request_id',a.id,'contract_id',a.contract_id,'amount',a.amount,'paid_on',(now() at time zone 'Africa/Kinshasa')::date,'method','Araka '||a.provider,'reference',a.reference,'reason','Paiement vérifié auprès de Araka'));
   update public.araka_attempts set state='approved',receipt_id=result,verified_at=now(),review_reason=null where id=a.id;
  exception when others then
   update public.araka_attempts set state='review',verified_at=now(),review_reason=left(sqlerrm,500) where id=a.id;
  end;
 elsif p->>'status'='DECLINED' and a.verified_at is null then
  update public.araka_attempts set state='declined' where id=a.id;
 end if;
 return (select state from public.araka_attempts where id=a.id);
end $$;
-- An accounting reversal is not an actual provider refund.
do $$declare definition text;begin
 definition:=pg_get_functiondef('private.reverse_cash_payment(jsonb)'::regprocedure);
 definition:=replace(definition,'perform 1 from public.contracts where id=original.contract_id for update;',E'if original.method like ''Araka %'' then raise exception ''Paiement Araka : remboursement et régularisation requis, annulation manuelle bloquée'';end if;\n perform 1 from public.contracts where id=original.contract_id for update;');execute definition;
 definition:=pg_get_functiondef('private.void_contract(jsonb)'::regprocedure);
 definition:=replace(definition,'if c.status=''void'' then return c.id;end if;',E'if c.status=''void'' then return c.id;end if;\n if exists(select 1 from public.araka_attempts where contract_id=c.id and state in (''pending'',''review'')) then raise exception ''Paiement Araka en cours : annulation bloquée'';end if;');execute definition;
end $$;
create function public.set_driver_payment_link(p jsonb) returns void language sql security invoker set search_path='' as $$select private.set_driver_payment_link(p)$$;
create function public.driver_payment_context(token text) returns jsonb language sql security invoker set search_path='' as $$select private.driver_payment_context(token)$$;
create function public.begin_araka_payment(p jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.begin_araka_payment(p)$$;
create function public.record_araka_status(p jsonb) returns text language sql security invoker set search_path='' as $$select private.record_araka_status(p)$$;
revoke all on function private.set_driver_payment_link(jsonb),public.set_driver_payment_link(jsonb),private.driver_payment_context(text),public.driver_payment_context(text),private.begin_araka_payment(jsonb),public.begin_araka_payment(jsonb),private.record_araka_status(jsonb),public.record_araka_status(jsonb) from public,anon,authenticated;
grant execute on function private.set_driver_payment_link(jsonb),public.set_driver_payment_link(jsonb) to authenticated;
grant execute on function private.driver_payment_context(text),public.driver_payment_context(text),private.begin_araka_payment(jsonb),public.begin_araka_payment(jsonb),private.record_araka_status(jsonb),public.record_araka_status(jsonb) to service_role;
notify pgrst,'reload schema';
commit;
