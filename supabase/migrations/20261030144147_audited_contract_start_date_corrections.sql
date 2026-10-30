begin;
alter table public.contracts add column date_revision integer not null default 1;
create table public.contract_date_corrections(
 id uuid primary key default gen_random_uuid(),contract_id uuid not null references public.contracts(id),request_id uuid not null unique,actor_id uuid not null references public.staff_members(user_id),
 reason text not null check(length(trim(reason)) between 3 and 1000),before_dates jsonb not null,after_dates jsonb not null,schedule_dates jsonb not null,command_payload jsonb not null,created_at timestamptz not null default now()
);
create index contract_date_correction_contract on public.contract_date_corrections(contract_id);
create index contract_date_correction_actor on public.contract_date_corrections(actor_id);
alter table public.contract_date_corrections enable row level security;
revoke all on public.contract_date_corrections from anon,authenticated;
grant select on public.contract_date_corrections to authenticated;
create policy staff_date_correction_read on public.contract_date_corrections for select to authenticated using((select private.is_staff()));
create function private.correct_contract_start_date(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.contracts;prev public.contract_date_corrections;new_start date;new_first date;new_end date;cursor_day date;ids bigint[];old_dates date[];new_dates date[]:='{}';i integer;n integer;mapping jsonb;before_value jsonb;after_value jsonb;result_value jsonb;m public.fleet_mandates;managed boolean;new_mandate_end date;
begin
 if not exists(select 1 from public.staff_members where user_id=auth.uid() and active and deleted_at is null and role='super_admin') then raise exception 'Correction réservée au super administrateur';end if;
 if not coalesce((p->>'preview')::boolean,false) then
  if p->>'request_id' is null or length(btrim(coalesce(p->>'reason',''))) not between 3 and 1000 then raise exception 'Motif et identifiant de correction requis';end if;
  perform pg_advisory_xact_lock(hashtextextended(p->>'request_id',5));select * into prev from public.contract_date_corrections where request_id=(p->>'request_id')::uuid;
  if found then if prev.command_payload<>p or prev.actor_id<>auth.uid() then raise exception 'Requête de correction réutilisée';end if;return prev.after_dates;end if;
 end if;
 select * into c from public.contracts where id=(p->>'contract_id')::uuid for update;
 if not found or c.status<>'active' then raise exception 'Contrat actif introuvable';end if;
 if c.date_revision is distinct from (p->>'date_revision')::integer then raise exception 'Les dates du contrat ont changé. Actualisez le contrat.';end if;
 new_start:=(p->>'start_date')::date;
 if new_start is null or new_start<'1900-01-01'::date or new_start>(now() at time zone 'Africa/Kinshasa')::date then raise exception 'Date réelle de démarrage requise, non future';end if;
 if new_start=c.start_date then raise exception 'La date de démarrage est inchangée';end if;
 select exists(select 1 from public.vehicles where id=c.vehicle_id and owner_application_id is not null) into managed;
 new_first:=new_start+case when managed then 1 else c.first_payment_date-c.start_date end;
 select array_agg(id order by due_on,id),array_agg(due_on order by due_on,id) into ids,old_dates from public.repayment_schedules where contract_id=c.id;
 n:=cardinality(ids);if coalesce(n,0)=0 then raise exception 'Aucun échéancier à corriger';end if;
 cursor_day:=new_first;
 for i in 1..n loop
  while not extract(isodow from cursor_day)::integer=any(c.operating_days) or cursor_day=any(c.excluded_dates) loop cursor_day:=cursor_day+1;if cursor_day-new_start>4000 then raise exception 'Échéancier trop long';end if;end loop;
  new_dates:=array_append(new_dates,cursor_day);cursor_day:=cursor_day+1;
 end loop;
 new_first:=new_dates[1];new_end:=greatest(new_start+(c.end_date-c.start_date),new_dates[n]);
 if new_end-new_start>3653 then raise exception 'Durée maximale du contrat dépassée';end if;
 if exists(select 1 from public.vehicle_assignments a join public.contracts other on other.id=a.contract_id where a.contract_id<>c.id and other.status='active' and(a.driver_id=c.driver_id or a.vehicle_id=c.vehicle_id) and a.start_date<=new_end and coalesce(a.end_date,other.end_date)>=new_start) then raise exception 'La période chevauche une autre affectation';end if;
 if exists(select 1 from public.advance_instalments ai join public.vehicle_advances va on va.id=ai.advance_id join unnest(ids,new_dates) x(id,day) on x.id=ai.schedule_id where x.day<greatest(va.funded_on,va.recovery_start) or (case when c.payment_frequency='weekly' then x.day+(7-extract(isodow from x.day)::integer) else x.day end)>(va.funded_on+interval '6 months')::date) then raise exception 'La correction sortirait une réparation ou avance de sa période de remboursement convenue (six mois maximum)';end if;
 select * into m from public.fleet_mandates where vehicle_id=c.vehicle_id and status='active';
 if found then
  if m.effective_start=c.start_date then
   if exists(select 1 from public.owner_settlements where mandate_id=m.id) then raise exception 'Un règlement propriétaire est déjà clôturé : corrigez les dates avec son rapprochement avant de déplacer le début du mandat';end if;
   new_mandate_end:=(new_start+interval '12 months'-interval '1 day')::date;
  else new_mandate_end:=m.effective_end;if new_start<m.effective_start then raise exception 'La date précède le début du mandat propriétaire';end if;end if;
  if new_end>new_mandate_end then raise exception 'Les nouvelles échéances dépassent la fin du mandat propriétaire';end if;
 end if;
 before_value:=jsonb_build_object('start_date',c.start_date,'first_payment_date',c.first_payment_date,'end_date',c.end_date,'date_revision',c.date_revision);
 after_value:=jsonb_build_object('start_date',new_start,'first_payment_date',new_first,'end_date',new_end,'date_revision',c.date_revision+1,'repayment_count',n,'repayment_total',c.repayment_total,'supplemental_total',c.supplemental_total);
 select jsonb_agg(jsonb_build_object('id',x.id,'before',x.old_day,'after',x.new_day) order by x.ordinality) into mapping from unnest(ids,old_dates,new_dates) with ordinality x(id,old_day,new_day,ordinality);
 result_value:=jsonb_build_object('before',before_value,'after',after_value,'first_due_dates',to_jsonb(new_dates[1:least(n,7)]),'installments',n,'payments_preserved',true);
 if coalesce((p->>'preview')::boolean,false) then return result_value;end if;
 -- Keep every installment ID, amount, payment allocation and advance recovery intact.
 update public.repayment_schedules s set due_on='0001-01-01'::date+x.ordinality::integer from unnest(ids) with ordinality x(id,ordinality) where s.id=x.id;
 update public.repayment_schedules s set due_on=x.day from unnest(ids,new_dates) x(id,day) where s.id=x.id;
 update public.advance_instalments ai set due_on=x.day from unnest(ids,new_dates) x(id,day) where ai.schedule_id=x.id;
 update public.vehicle_advances va set recovery_deadline=(select max(case when c.payment_frequency='weekly' then ai.due_on+(7-extract(isodow from ai.due_on)::integer) else ai.due_on end) from public.advance_instalments ai where ai.advance_id=va.id)
 where va.driver_contract_id=c.id and exists(select 1 from public.advance_instalments ai where ai.advance_id=va.id);
 update public.contracts set start_date=new_start,first_payment_date=new_first,end_date=new_end,date_revision=date_revision+1 where id=c.id;
 update public.vehicle_assignments set start_date=new_start where contract_id=c.id;
 if m.id is not null and m.effective_start=c.start_date then update public.fleet_mandates set effective_start=new_start,effective_end=new_mandate_end where id=m.id;end if;
 insert into public.contract_date_corrections(contract_id,request_id,actor_id,reason,before_dates,after_dates,schedule_dates,command_payload) values(c.id,(p->>'request_id')::uuid,auth.uid(),btrim(p->>'reason'),before_value,after_value,mapping,p);
 insert into public.finance_events(actor_id,action,entity_id,details) values(auth.uid(),'contract_dates_corrected',c.id::text,result_value||jsonb_build_object('reason',btrim(p->>'reason'),'schedule_dates',mapping));
 insert into public.admin_notes(application_id,body,created_by) values(c.application_id,'Correction du démarrage du contrat '||c.signed_reference||' : '||c.start_date||' → '||new_start||'. Motif : '||btrim(p->>'reason'),auth.uid());
 return after_value;
end $$;
create function public.correct_contract_start_date(p jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.correct_contract_start_date(p);$$;
revoke all on function private.correct_contract_start_date(jsonb),public.correct_contract_start_date(jsonb) from public,anon;
grant execute on function private.correct_contract_start_date(jsonb),public.correct_contract_start_date(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
