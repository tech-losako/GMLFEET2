begin;
-- One financial calculation shared by the staff view and activation SMS.
create function private.owner_financial_recap(owner_id bigint,as_of date default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.fleet_mandates;period date;due_date date;remaining numeric;deduction numeric;items jsonb;
begin
 select * into m from public.fleet_mandates where owner_application_id=owner_id and status in('active','awaiting_driver') order by created_at desc limit 1;
 period:=date_trunc('month',coalesce(m.effective_start,as_of,(now() at time zone 'Africa/Kinshasa')::date))::date;
 while exists(select 1 from public.owner_settlements where mandate_id=m.id and period_start=period) loop period:=(period+interval '1 month')::date;end loop;
 due_date:=(period+interval '1 month'-interval '1 day')::date;
 select coalesce(sum(greatest(ai.amount-coalesce(x.paid,0),0)),0),coalesce(sum(case when ai.due_on<=due_date then greatest(ai.amount-coalesce(x.paid,0),0) else 0 end),0)
 into remaining,deduction from public.vehicle_advances va join public.advance_instalments ai on ai.advance_id=va.id left join lateral(select sum(amount) paid from public.advance_recoveries where instalment_id=ai.id)x on true where va.application_id=owner_id and va.debtor='owner';
 select coalesce(jsonb_agg(jsonb_build_object('id',va.id,'description',va.description,'principal',va.principal,'fee',va.fee,'total',va.total,'remaining',x.remaining,'months',va.months,'recovery_start',va.recovery_start,'recovery_deadline',va.recovery_deadline,'approval_reference',va.approval_reference,'next_deduction',x.next_deduction) order by va.funded_on,va.id),'[]'::jsonb) into items from public.vehicle_advances va cross join lateral(select coalesce(sum(greatest(ai.amount-coalesce(y.paid,0),0)),0) remaining,coalesce(sum(case when ai.due_on<=due_date then greatest(ai.amount-coalesce(y.paid,0),0) else 0 end),0) next_deduction from public.advance_instalments ai left join lateral(select sum(amount)paid from public.advance_recoveries where instalment_id=ai.id)y on true where ai.advance_id=va.id)x where va.application_id=owner_id and va.debtor='owner';
 deduction:=least(coalesce(m.owner_target,0),deduction);
 return jsonb_build_object('remaining',remaining,'next_period',period,'next_payout_date',due_date,'owner_target',m.owner_target,'next_deduction',deduction,'projected_net',greatest(coalesce(m.owner_target,0)-deduction,0),'mandate_started',m.effective_start is not null,'advances',items);
end $$;
create function private.get_owner_financial_recap(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.is_staff() then raise exception 'Accès personnel requis';end if;
 if not exists(select 1 from public.applications where id=(p->>'application_id')::bigint and program_type='FLEET_OWNER') then raise exception 'Dossier propriétaire requis';end if;
 return private.owner_financial_recap((p->>'application_id')::bigint);
end $$;
create function public.get_owner_financial_recap(p jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.get_owner_financial_recap(p)$$;
revoke all on function private.get_owner_financial_recap(jsonb),public.get_owner_financial_recap(jsonb) from public,anon;
grant execute on function private.get_owner_financial_recap(jsonb),public.get_owner_financial_recap(jsonb) to authenticated;
create or replace function private.queue_contract_sms() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.applications;v public.vehicles;o public.applications;r jsonb;item jsonb;
begin
 select * into a from public.applications where id=new.application_id;
 perform private.queue_sms('contract:'||new.id,'contract_activated',a.phone,'GM Fleet : contrat '||new.signed_reference||' activé. Début : '||to_char(new.start_date,'DD/MM/YYYY')||'. Premier versement : '||to_char(new.first_payment_date,'DD/MM/YYYY')||'.',a.id);
 select * into v from public.vehicles where id=new.vehicle_id;
 if v.owner_application_id is not null then
  select * into o from public.applications where id=v.owner_application_id;r:=private.owner_financial_recap(o.id,new.start_date);
  perform private.queue_sms('contract:'||new.id||':owner','owner_assignment',o.phone,'GM Fleet : '||v.model||' ('||v.plate||') en exploitation le '||to_char(new.start_date,'DD/MM/YYYY')||'. Contrat chauffeur '||new.signed_reference||'. Dette restante : '||(r->>'remaining')||' USD. Prochaine retenue prévue : '||(r->>'next_deduction')||' USD sur cible '||coalesce(r->>'owner_target','0')||' USD, net prévisionnel '||(r->>'projected_net')||' USD, période '||(r->>'next_period')||'. Sous réserve des encaissements et ajustements approuvés.',o.id);
  for item in select value from jsonb_array_elements(r->'advances') where (value->>'remaining')::numeric>0 loop
   perform private.queue_sms('contract:'||new.id||':advance:'||(item->>'id'),'owner_debt_recap',o.phone,'GM Fleet avance : '||(item->>'description')||'. Coût '||(item->>'principal')||' + frais uniques 15% '||(item->>'fee')||' = '||(item->>'total')||' USD. Solde '||(item->>'remaining')||' USD. Durée '||(item->>'months')||' mois, fin '||(item->>'recovery_deadline')||'. Accord '||(item->>'approval_reference')||'.',o.id);
  end loop;
 end if;return new;
end $$;
revoke all on function private.queue_boss_finance_sms(text,text,bigint),private.owner_financial_recap(bigint,date),private.queue_payment_sms(),private.queue_lolc_deposit_receipt_sms(),private.queue_contract_sms() from public,anon,authenticated;

commit;
