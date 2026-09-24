begin;
create table public.vehicle_model_specs (
 model_key text primary key check(model_key in ('Swift','IST','Vitz','Blade')),
 specs jsonb not null check(jsonb_typeof(specs)='object'),
 revision integer not null default 1,
 updated_at timestamptz not null default now()
);
alter table public.vehicle_model_specs enable row level security;
revoke all on public.vehicle_model_specs from anon,authenticated;
grant select on public.vehicle_model_specs to anon,authenticated;
grant update(specs) on public.vehicle_model_specs to authenticated;
create policy public_specs on public.vehicle_model_specs for select to anon,authenticated using(true);
create policy admin_specs on public.vehicle_model_specs for update to authenticated
 using((select exists(select 1 from public.staff_members where user_id=auth.uid() and active and role in ('admin','super_admin'))))
 with check((select exists(select 1 from public.staff_members where user_id=auth.uid() and active and role in ('admin','super_admin'))));
create table public.vehicle_model_spec_history (
 id bigint generated always as identity primary key,
 model_key text not null references public.vehicle_model_specs(model_key),
 actor_id uuid references auth.users(id),
 before_specs jsonb not null,
 after_specs jsonb not null,
 created_at timestamptz not null default now()
);
create index vehicle_spec_history_model_idx on public.vehicle_model_spec_history(model_key,created_at desc);
create index vehicle_spec_history_actor_idx on public.vehicle_model_spec_history(actor_id);
alter table public.vehicle_model_spec_history enable row level security;
revoke all on public.vehicle_model_spec_history from anon,authenticated;
grant select on public.vehicle_model_spec_history to authenticated;
create policy admin_history on public.vehicle_model_spec_history for select to authenticated using((select exists(select 1 from public.staff_members where user_id=auth.uid() and active and role in ('admin','super_admin'))));

create function private.validate_vehicle_specs() returns trigger language plpgsql set search_path='' as $$
declare k text; allowed text[]:=array['name','brand','year','engine','transmission','fuel','seats','doors','steering','color','mileage','mode'];
begin
 if (select count(*) from jsonb_object_keys(new.specs))<>cardinality(allowed) then raise exception 'Champs de fiche invalides';end if;
 foreach k in array allowed loop
  if not new.specs ? k or jsonb_typeof(new.specs->k)<>'string' or length(trim(new.specs->>k)) not between 1 and 120 then raise exception 'Caractéristique invalide : %',k;end if;
 end loop;
 if new.specs->>'name'<>(case new.model_key when 'Swift' then 'Suzuki Swift' when 'IST' then 'Toyota ist' when 'Vitz' then 'Toyota Vitz' else 'Toyota Blade' end) or new.specs->>'brand'<>(case when new.model_key='Swift' then 'Suzuki' else 'Toyota' end) then raise exception 'Le nom doit correspondre au modèle';end if;
 if new.specs->>'mode' not in ('general','confirmed') then raise exception 'Type de fiche invalide';end if;
 if new.specs->>'mode'='general' and (new.specs->>'year'<>'?' or new.specs->>'color'<>'Selon disponibilité' or new.specs->>'mileage'<>'Selon le véhicule') then raise exception 'Une fiche générale doit conserver année ?, couleur et kilométrage variables';end if;
 if new.specs->>'mode'='confirmed' and (new.specs->>'year' !~ '^[12][0-9]{3}$' or new.specs->>'color' in ('?','Selon disponibilité','À préciser') or new.specs->>'mileage' !~ '^[0-9][0-9 .,]* km$') then raise exception 'Renseignez l’année, la couleur et le kilométrage réel (ex. 85000 km)';end if;
 if new.specs->>'seats' !~ '^[1-9][0-9]?$' or (new.specs->>'doors'<>'À préciser' and new.specs->>'doors' !~ '^[1-9]$') then raise exception 'Nombre de places ou portes invalide';end if;
 if tg_op='UPDATE' then new.revision:=old.revision+1;end if;
 new.updated_at:=now();return new;
end $$;
revoke all on function private.validate_vehicle_specs() from public,anon,authenticated;
create trigger validate_vehicle_specs before insert or update on public.vehicle_model_specs for each row execute function private.validate_vehicle_specs();
create function private.audit_vehicle_specs() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.vehicle_model_spec_history(model_key,actor_id,before_specs,after_specs) values(new.model_key,auth.uid(),old.specs,new.specs);return new;
end $$;
revoke all on function private.audit_vehicle_specs() from public,anon,authenticated;
create trigger audit_vehicle_specs after update on public.vehicle_model_specs for each row execute function private.audit_vehicle_specs();
insert into public.vehicle_model_specs(model_key,specs) values
('Swift','{"name": "Suzuki Swift", "brand": "Suzuki", "year": "?", "engine": "1,2 L (1 240 cc)", "transmission": "Automatique", "fuel": "Essence", "seats": "5", "doors": "5", "steering": "À droite", "color": "Selon disponibilité", "mileage": "Selon le véhicule", "mode": "general"}'::jsonb),
('IST','{"name": "Toyota ist", "brand": "Toyota", "year": "?", "engine": "1,3 L (1 300 cc)", "transmission": "Automatique", "fuel": "Essence", "seats": "5", "doors": "4", "steering": "À droite", "color": "Selon disponibilité", "mileage": "Selon le véhicule", "mode": "general"}'::jsonb),
('Blade','{"name": "Toyota Blade", "brand": "Toyota", "year": "?", "engine": "3,5 L (3 500 cc)", "transmission": "Automatique", "fuel": "Essence", "seats": "5", "doors": "À préciser", "steering": "À préciser", "color": "Selon disponibilité", "mileage": "Selon le véhicule", "mode": "general"}'::jsonb),
('Vitz','{"name": "Toyota Vitz", "brand": "Toyota", "year": "?", "engine": "1,0 L (1 000 cc)", "transmission": "Automatique (CVT)", "fuel": "Essence", "seats": "5", "doors": "5", "steering": "À droite", "color": "Selon disponibilité", "mileage": "Selon le véhicule", "mode": "general"}'::jsonb);
notify pgrst,'reload schema';
commit;
