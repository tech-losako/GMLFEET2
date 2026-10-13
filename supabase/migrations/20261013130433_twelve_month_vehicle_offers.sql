begin;
alter table public.vehicle_model_specs
 add column total_price_usd numeric(12,2),
 add column initial_deposit_usd numeric(12,2);
-- Preserve the current 12-month offer amounts; no existing dossiers or contracts change.
update public.vehicle_model_specs set
 total_price_usd=case model_key when 'IST' then 10536 when 'Blade' then 11160 else 9288 end,
 initial_deposit_usd=case model_key when 'IST' then 1300 when 'Blade' then 1400 else 1100 end;
alter table public.vehicle_model_specs
 alter column total_price_usd set not null,
 alter column initial_deposit_usd set not null,
 add constraint vehicle_total_price_valid check(total_price_usd>0 and total_price_usd<=1000000),
 add constraint vehicle_deposit_valid check(initial_deposit_usd>=0 and initial_deposit_usd<=1000000);
grant update(total_price_usd) on public.vehicle_model_specs to authenticated;
alter table public.vehicle_model_spec_history
 add column before_total_price_usd numeric(12,2),
 add column after_total_price_usd numeric(12,2);
create or replace function private.audit_vehicle_specs() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 insert into public.vehicle_model_spec_history(model_key,actor_id,before_specs,after_specs,before_total_price_usd,after_total_price_usd)
 values(new.model_key,auth.uid(),old.specs,new.specs,old.total_price_usd,new.total_price_usd);
 return new;
end $$;
create function private.snapshot_vehicle_offer() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare offer public.vehicle_model_specs;
begin
 if tg_op='UPDATE' then
  if new.plan_duration_months is distinct from old.plan_duration_months and new.service is null and new.plan_duration_months is distinct from 12 then
   raise exception 'Le seul plan proposé est de 12 mois';
  end if;
  return new;
 end if;
 if new.service is not null then return new;end if;
 if new.plan_duration_months is not null and new.plan_duration_months<>12 then raise exception 'Le seul plan proposé est de 12 mois';end if;
 select * into offer from public.vehicle_model_specs
 where lower(model_key)=lower(trim(new.vehicle)) or lower(specs->>'name')=lower(trim(new.vehicle));
 if not found then raise exception 'Choisissez un modèle du catalogue Car na ngai';end if;
 if new.service_details ? 'offerRevision' and new.service_details->>'offerRevision' is distinct from offer.revision::text then
  raise exception 'Le tarif a changé. Consultez le nouveau montant avant de renvoyer votre candidature';
 end if;
 new.plan_duration_months:=12;
 new.service_details:=coalesce(new.service_details,'{}'::jsonb)||jsonb_build_object(
  'offerRevision',offer.revision,'offerModelKey',offer.model_key,'offerTotalUsd',offer.total_price_usd,
  'planTotal',offer.total_price_usd::text||' USD','initialDeposit',offer.initial_deposit_usd::text||' USD',
  'weeklyPayment',round(offer.total_price_usd/52,2)::text||' USD',
  'dailyPayment',round(offer.total_price_usd/312,2)::text||' USD',
  'paymentWeeks',52,'paymentDays',312);
 return new;
end $$;
revoke all on function private.snapshot_vehicle_offer() from public,anon,authenticated;
create trigger b_snapshot_vehicle_offer before insert or update of plan_duration_months on public.applications
 for each row execute function private.snapshot_vehicle_offer();
notify pgrst,'reload schema';
commit;
