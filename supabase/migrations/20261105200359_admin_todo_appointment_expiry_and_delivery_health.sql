begin;
-- Keep provider acceptance and real handset delivery distinct; expose health only
-- through the existing service-only configuration endpoint.
create or replace function private.sms_transport_configuration() returns jsonb
language sql security invoker set search_path='' as $$
 select to_jsonb(c)||jsonb_build_object('delivery_health',jsonb_build_object(
  'last_report_at',(select max(received_at) from private.sms_delivery_reports),
  'unconfirmed',(select count(*) from public.sms_dispatches where status in('accepted','sent')),
  'older_than_day',(select count(*) from public.sms_dispatches where status in('accepted','sent') and created_at<now()-interval '24 hours')
 )) from private.sms_transport_config c where singleton;
$$;
revoke all on function private.sms_transport_configuration() from public,anon,authenticated;
grant execute on function private.sms_transport_configuration() to service_role;

-- Previous Kinshasa calendar days only. Never infer an appointment's business
-- decision, create money movements, or send missed-appointment messages.
create function private.expire_past_appointments() returns integer
language plpgsql security definer set search_path='' as $$
declare ap record;affected integer:=0;n integer;
begin
 for ap in select id,application_id from public.appointments
  where status='scheduled' and (starts_at at time zone 'Africa/Kinshasa')::date<(now() at time zone 'Africa/Kinshasa')::date
  and coalesce((result->>'auto_reopened_until')::timestamptz,'-infinity'::timestamptz)<now()
  order by application_id,id
 loop
  perform 1 from public.applications where id=ap.application_id for update;
  update public.appointments set status='missed',outcome='missed',completed_at=now(),
   outcome_notes='Clôture automatique : rendez-vous passé sans résultat enregistré. À corriger si effectué.',
   result=coalesce(result,'{}'::jsonb)||jsonb_build_object('auto_closed',true,'auto_closed_at',now())
  where id=ap.id and status='scheduled'
   and (starts_at at time zone 'Africa/Kinshasa')::date<(now() at time zone 'Africa/Kinshasa')::date
   and coalesce((result->>'auto_reopened_until')::timestamptz,'-infinity'::timestamptz)<now();
  get diagnostics n=row_count;affected:=affected+n;
 end loop;
 return affected;
end $$;
revoke all on function private.expire_past_appointments() from public,anon,authenticated;

-- Recover an auto-closed booking for the real workflow decision, not an invented
-- successful outcome. The ordinary appointment audit trigger records both changes.
create function private.reopen_auto_missed_appointment(p jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare ap public.appointments;rid uuid:=(p->>'request_id')::uuid;aid bigint;
begin
 if not coalesce(private.is_staff(),false) or auth.uid() is null or rid is null then raise exception 'Accès équipe requis';end if;
 if length(trim(coalesce(p->>'reason','')))<3 then raise exception 'Indiquez le motif de correction';end if;
 select application_id into aid from public.appointments where id=(p->>'appointment_id')::uuid;
 perform 1 from public.applications where id=aid for update;
 select * into ap from public.appointments where id=(p->>'appointment_id')::uuid for update;
 if ap.result->>'reopen_request_id'=rid::text then return ap.id;end if;
 if ap.id is null or ap.status<>'missed' or coalesce((ap.result->>'auto_closed')::boolean,false)=false then raise exception 'Seul un rendez-vous clôturé automatiquement peut être rétabli';end if;
 if exists(select 1 from public.appointments where application_id=ap.application_id and status in('scheduled','confirmed')) then raise exception 'Un autre rendez-vous est déjà en cours. Traitez-le d’abord';end if;
 update public.appointments set status='scheduled',outcome=null,completed_at=null,
  outcome_notes=null,result=ap.result||jsonb_build_object('auto_reopened_until',now()+interval '24 hours','reopen_request_id',rid,'reopen_reason',trim(p->>'reason'),'reopened_by',auth.uid()) where id=ap.id;
 return ap.id;
end $$;
revoke all on function private.reopen_auto_missed_appointment(jsonb) from public,anon;
grant execute on function private.reopen_auto_missed_appointment(jsonb) to authenticated;
create function public.reopen_auto_missed_appointment(p jsonb) returns uuid
language sql security invoker set search_path='' as $$select private.reopen_auto_missed_appointment(p);$$;
revoke all on function public.reopen_auto_missed_appointment(jsonb) from public,anon;
grant execute on function public.reopen_auto_missed_appointment(jsonb) to authenticated;

select cron.schedule('gmfleet-expire-appointments','5 * * * *',$job$select private.expire_past_appointments();$job$);
select private.expire_past_appointments();
notify pgrst,'reload schema';
commit;
