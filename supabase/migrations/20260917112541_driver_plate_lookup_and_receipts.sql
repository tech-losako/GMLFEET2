begin;
create function private.normalize_driver_plate(value text) returns text language sql immutable set search_path='' as $$ select nullif(regexp_replace(upper(value),'[^A-Z0-9]','','g'),'') $$;
revoke all on function private.normalize_driver_plate(text) from public,anon,authenticated;
create table private.driver_plate_access(token_hash text primary key check(token_hash ~ '^[a-f0-9]{64}$'),contract_id uuid not null references public.contracts(id),phone text not null,plate text not null,expires_at timestamptz not null default now()+interval '1 hour');
alter table private.driver_plate_access enable row level security;
revoke all on private.driver_plate_access from public,anon,authenticated;
create index driver_plate_access_contract on private.driver_plate_access(contract_id);
create table private.driver_lookup_limits(key text primary key,started_at timestamptz not null,attempts integer not null);
alter table private.driver_lookup_limits enable row level security;
revoke all on private.driver_lookup_limits from public,anon,authenticated;
-- A mismatch returns normally so the rate-limit counter commits, including failed guesses.
create function private.issue_driver_plate_access(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare phone_value text:=private.normalize_driver_phone(p->>'phone');plate_value text:=private.normalize_driver_plate(p->>'plate');n integer;chosen uuid;matches integer;key_value text;limited boolean:=false;
begin
 if phone_value is null or plate_value is null or length(plate_value)<3 or length(plate_value)>30 or p->>'token_hash' is null or p->>'token_hash' !~ '^[a-f0-9]{64}$' or p->>'ip_hash' is null or p->>'ip_hash' !~ '^[a-f0-9]{64}$' then return jsonb_build_object('error','Téléphone et plaque requis.');end if;
 delete from private.driver_lookup_limits where started_at<now()-interval '1 day';
 -- Phone key cannot be bypassed by changing source address. Both counters are atomic.
 foreach key_value in array array['phone:'||phone_value,'ip:'||(p->>'ip_hash')] loop
  insert into private.driver_lookup_limits(key,started_at,attempts) values(key_value,now(),1)
  on conflict(key) do update set attempts=case when private.driver_lookup_limits.started_at<now()-interval '15 minutes' then 1 else private.driver_lookup_limits.attempts+1 end,started_at=case when private.driver_lookup_limits.started_at<now()-interval '15 minutes' then now() else private.driver_lookup_limits.started_at end returning attempts into n;
  if n>(case when key_value like 'phone:%' then 10 else 60 end) then limited:=true;end if;
 end loop;
 if limited then return jsonb_build_object('error','Trop de tentatives. Réessayez dans 15 minutes.','limited',true);end if;
 select count(*),(array_agg(c.id))[1] into matches,chosen from public.contracts c join public.drivers d on d.id=c.driver_id join public.vehicles v on v.id=c.vehicle_id where c.status='active' and private.normalize_driver_phone(d.phone)=phone_value and private.normalize_driver_plate(v.plate)=plate_value;
 if matches<>1 then return jsonb_build_object('error','Téléphone ou plaque incorrects, ou contrat indisponible. Vérifiez les deux informations ou contactez la caisse GM Fleet.');end if;
 delete from private.driver_plate_access where expires_at<now();
 insert into private.driver_plate_access(token_hash,contract_id,phone,plate) values(p->>'token_hash',chosen,phone_value,plate_value);
 return jsonb_build_object('ok',true);
end $$;
create function public.issue_driver_plate_access(p jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.issue_driver_plate_access(p) $$;
revoke all on function private.issue_driver_plate_access(jsonb),public.issue_driver_plate_access(jsonb) from public,anon,authenticated;
grant execute on function private.issue_driver_plate_access(jsonb),public.issue_driver_plate_access(jsonb) to service_role;
-- Disable the replaced SMS entry point; keep its historical schema for migration compatibility.
revoke all on function private.issue_driver_phone_access(jsonb),public.issue_driver_phone_access(jsonb) from service_role;
create or replace function private.driver_payment_context(token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.contracts;name text;total numeric;due numeric;items jsonb;
begin
 select x.* into c from public.contracts x join private.driver_payment_links l on l.contract_id=x.id where l.token_hash=token and x.status='active';
 if not found then
  select x.* into c from private.driver_plate_access l join public.contracts x on x.id=l.contract_id join public.drivers d on d.id=x.driver_id join public.vehicles v on v.id=x.vehicle_id
  where l.token_hash=token and l.expires_at>now() and x.status='active' and l.phone=private.normalize_driver_phone(d.phone) and l.plate=private.normalize_driver_plate(v.plate);
 end if;
 if not found then raise exception 'Lien invalide ou contrat inactif';end if;
 select full_name into name from public.drivers where id=c.driver_id;
 select coalesce(sum(r.lolc_due+r.gml_due-coalesce(a.paid,0)),0),coalesce(sum(r.lolc_due+r.gml_due-coalesce(a.paid,0)) filter(where r.due_on<=(now() at time zone 'Africa/Kinshasa')::date),0) into total,due from public.repayment_schedules r left join lateral(select sum(amount) paid from public.payment_allocations where schedule_id=r.id) a on true where r.contract_id=c.id;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc),'[]') into items from (select id,reference,amount,transaction_fee,total_charged,currency,provider,state,receipt_id,created_at from public.araka_attempts where contract_id=c.id order by created_at desc limit 10) t;
 return jsonb_build_object('contract_id',c.id,'driver_name',name,'currency',c.currency,'daily_amount',c.daily_lolc+c.daily_gml,'total_remaining',total,'due',due,'attempts',items,'receipts',(select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc),'[]'::jsonb) from (select p.id,p.reference,p.amount,p.transaction_fee,p.total_charged,p.paid_on,p.created_at,p.method from public.payments p where p.contract_id=c.id and p.entry_kind='payment' and not exists(select 1 from public.payments rev where rev.reverses_payment_id=p.id) order by p.created_at desc limit 100) r),'vehicle',(select jsonb_build_object('model',v.model,'plate',v.plate) from public.vehicles v where v.id=c.vehicle_id));
end $$;
create function private.driver_payment_receipt(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare context jsonb;receipt public.payments;c public.contracts;
begin
 context:=private.driver_payment_context(p->>'token_hash');
 select * into receipt from public.payments x where x.id=(p->>'receipt_id')::bigint and x.contract_id=(context->>'contract_id')::uuid and x.entry_kind='payment' and not exists(select 1 from public.payments rev where rev.reverses_payment_id=x.id);
 if not found then raise exception 'Reçu confirmé introuvable pour ce contrat';end if;
 select * into c from public.contracts where id=receipt.contract_id;
 return jsonb_build_object('id',receipt.id,'reference',receipt.reference,'driver_name',receipt.driver_name,'vehicle',context->'vehicle','contract_reference',c.signed_reference,'currency',c.currency,'amount',receipt.amount,'transaction_fee',receipt.transaction_fee,'total_charged',receipt.total_charged,'paid_on',receipt.paid_on,'confirmed_at',receipt.created_at,'method',receipt.method,'status','confirmed');
end $$;
create function public.driver_payment_receipt(p jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.driver_payment_receipt(p) $$;
revoke all on function private.driver_payment_receipt(jsonb),public.driver_payment_receipt(jsonb) from public,anon,authenticated;
grant execute on function private.driver_payment_receipt(jsonb),public.driver_payment_receipt(jsonb) to service_role;
notify pgrst,'reload schema';
commit;
