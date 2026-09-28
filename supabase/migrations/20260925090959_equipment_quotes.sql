begin;
create table public.equipment_quotes (
 id uuid primary key, payload jsonb not null,
 status text not null default 'new' check(status in ('new','contacted','quoted','closed')),
 created_at timestamptz not null default now()
);
create index equipment_quotes_queue_idx on public.equipment_quotes(status,created_at desc);
alter table public.equipment_quotes enable row level security;
revoke all on public.equipment_quotes from anon,authenticated;
grant select on public.equipment_quotes to authenticated;
grant update(status) on public.equipment_quotes to authenticated;
create policy staff_read on public.equipment_quotes for select to authenticated using ((select private.is_staff()));
create policy staff_update on public.equipment_quotes for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
create function private.submit_equipment_quote(request_id uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare existing jsonb; k text;
begin
 if request_id is null or p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>6000 then raise exception 'Demande invalide'; end if;
 if (select count(*) from jsonb_object_keys(p))<>9 or p-array['name','email','phone','city','equipment','vehicle_type','model','quantity','message']<>'{}'::jsonb then raise exception 'Champs invalides'; end if;
 foreach k in array array['name','email','phone','city','equipment','vehicle_type','model','message'] loop
  if jsonb_typeof(p->k)<>'string' or length(p->>k)>(case when k='message' then 2000 else 254 end) or (k<>'message' and length(trim(p->>k))=0) then raise exception 'Champ invalide : %',k; end if;
 end loop;
 if p->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' or p->>'phone' !~ '^[+0-9 ()-]{7,40}$' then raise exception 'Vérifiez votre e-mail et votre téléphone'; end if;
 if p->>'equipment' not in ('gps','dashcam','both') or p->>'vehicle_type' not in ('Voiture','Jeep / SUV','Camion','Bus / minibus','Moto','Autre') or jsonb_typeof(p->'quantity')<>'number' or p->>'quantity' !~ '^[0-9]{1,4}$' or (p->>'quantity')::int not between 1 and 1000 then raise exception 'Équipement ou véhicule invalide'; end if;
 perform pg_advisory_xact_lock(hashtextextended(lower(p->>'email'),71));
 select payload into existing from public.equipment_quotes q where q.id=request_id;
 if found then
  if existing<>p then raise exception 'Demande modifiée : recommencez'; end if;
  return '{"success":true}'::jsonb;
 end if;
 if (select count(*) from public.equipment_quotes where lower(payload->>'email')=lower(p->>'email') and created_at>now()-interval '1 hour')>=3 then raise exception 'Plusieurs demandes sont déjà reçues. Réessayez plus tard ou appelez GML.'; end if;
 insert into public.equipment_quotes(id,payload) values(request_id,p);
 return '{"success":true}'::jsonb;
end $$;
create function public.submit_equipment_quote(request_id uuid,p jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.submit_equipment_quote(request_id,p)$$;
revoke all on function private.submit_equipment_quote(uuid,jsonb),public.submit_equipment_quote(uuid,jsonb) from public;
grant usage on schema private to anon,authenticated;
grant execute on function private.submit_equipment_quote(uuid,jsonb),public.submit_equipment_quote(uuid,jsonb) to anon,authenticated;
notify pgrst,'reload schema';
commit;
