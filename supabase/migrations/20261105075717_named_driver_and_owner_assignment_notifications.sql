begin;
create or replace function private.queue_contract_sms() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.applications;v public.vehicles;o public.applications;r jsonb;item jsonb;driver_message text;
begin
 select * into a from public.applications where id=new.application_id;
 select * into v from public.vehicles where id=new.vehicle_id;
 if v.owner_application_id is not null then select * into o from public.applications where id=v.owner_application_id;end if;
 driver_message:='GM Fleet : Bonjour '||a.name||case when o.id is not null then ', vous êtes affecté au véhicule ' else ', votre contrat est activé. Véhicule : ' end||v.model||' ('||v.plate||').';
 if o.id is not null then driver_message:=driver_message||' Propriétaire : '||o.name||'.';end if;
 driver_message:=driver_message||' Début du service : '||to_char(new.start_date,'DD/MM/YYYY')||'. Premier versement : '||to_char(new.first_payment_date,'DD/MM/YYYY')||'. Contrat '||new.signed_reference||'.';
 perform private.queue_sms('contract:'||new.id,'contract_activated',a.phone,driver_message,a.id);
 if o.id is not null then
  r:=private.owner_financial_recap(o.id,new.start_date);
  perform private.queue_sms('contract:'||new.id||':owner','owner_assignment',o.phone,'GM Fleet : votre véhicule '||v.model||' ('||v.plate||') est confié au chauffeur '||a.name||'. Début du service : '||to_char(new.start_date,'DD/MM/YYYY')||'. Contrat chauffeur '||new.signed_reference||'. Dette restante : '||(r->>'remaining')||' USD. Prochaine retenue prévue : '||(r->>'next_deduction')||' USD sur cible '||coalesce(r->>'owner_target','0')||' USD, net prévisionnel '||(r->>'projected_net')||' USD, période '||(r->>'next_period')||'. Sous réserve des encaissements et ajustements approuvés.',o.id);
  for item in select value from jsonb_array_elements(r->'advances') where (value->>'remaining')::numeric>0 loop
   perform private.queue_sms('contract:'||new.id||':advance:'||(item->>'id'),'owner_debt_recap',o.phone,'GM Fleet avance : '||(item->>'description')||'. Coût '||(item->>'principal')||' + frais uniques 15% '||(item->>'fee')||' = '||(item->>'total')||' USD. Solde '||(item->>'remaining')||' USD. Durée '||(item->>'months')||' mois, fin '||(item->>'recovery_deadline')||'.'||case when nullif(item->>'approval_reference','') is not null then ' Accord '||(item->>'approval_reference')||'.' else '' end,o.id);
  end loop;
 end if;return new;
end $$;
revoke all on function private.queue_contract_sms() from public,anon,authenticated;
-- Stable event keys keep retries from creating duplicate assignment messages. No historical SMS replay.
commit;
