begin;

create or replace function private.submit_equipment_quote(request_id uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare existing jsonb; k text;
begin
 if request_id is null or p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>6000 then raise exception 'Demande invalide'; end if;
 if (select count(*) from jsonb_object_keys(p))<>9 or p-array['name','email','phone','city','equipment','vehicle_type','model','quantity','message']<>'{}'::jsonb then raise exception 'Champs invalides'; end if;
 foreach k in array array['name','email','phone','city','equipment','vehicle_type','model','message'] loop
  if jsonb_typeof(p->k)<>'string' or length(p->>k)>(case when k='message' then 2000 else 254 end) or (k<>'message' and length(trim(p->>k))=0) then raise exception 'Champ invalide : %',k; end if;
 end loop;
 if p->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' or p->>'phone' !~ '^\+243[0-9]{9}$' then raise exception 'Vérifiez votre e-mail et votre téléphone'; end if;
 if p->>'equipment' not in ('gps','dashcam','both') or p->>'vehicle_type' not in ('Voiture','Jeep / SUV','Camion','Bus / minibus','Moto','Autre') or jsonb_typeof(p->'quantity')<>'number' or p->>'quantity' !~ '^[0-9]{1,4}$' or (p->>'quantity')::int not between 1 and 1000 then raise exception 'Équipement ou véhicule invalide'; end if;
 perform pg_advisory_xact_lock(hashtextextended(lower(p->>'email'),71));
 select payload into existing from public.equipment_quotes q where q.id=request_id;
 if found then
  if existing<>p then raise exception 'Demande modifiée : recommencez'; end if;
  return '{"success":true,"created":false}'::jsonb;
 end if;
 if (select count(*) from public.equipment_quotes where lower(payload->>'email')=lower(p->>'email') and created_at>now()-interval '1 hour')>=3 then raise exception 'Plusieurs demandes sont déjà reçues. Réessayez plus tard ou appelez GML.'; end if;
 insert into public.equipment_quotes(id,payload) values(request_id,p);
 return '{"success":true,"created":true}'::jsonb;
end $$;

notify pgrst,'reload schema';
commit;
