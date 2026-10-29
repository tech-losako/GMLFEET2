begin;
-- A vehicle-change loop must not repeat an already-issued lender approval SMS.
do $$declare definition text;begin
 select pg_get_functiondef('private.queue_case_milestone_sms()'::regprocedure) into definition;
 definition:=replace(definition,'new.program_type=''DRIVE_TO_OWN'' and new.process_step=''sourcing'' then','new.program_type=''DRIVE_TO_OWN'' and new.process_step=''sourcing'' and new.lolc_status is distinct from old.lolc_status then');
 execute definition;
end $$;
-- Existing attempted messages are audit entries only; never queue old drafts for sending.
insert into public.sms_dispatches(event_key,kind,recipient,body,application_id,appointment_id,quote_id,notification_id,status,attempts,provider_message_id,error,created_at,submitted_at)
select 'notification:'||n.id,n.kind,n.recipient,null,n.application_id,n.appointment_id,n.quote_id,n.id,
 case when n.delivery_status='unknown' and n.delivery_error like 'SMS accepté par le service (100)%' then 'accepted' else n.delivery_status end,
 n.delivery_attempts,n.provider_message_id,n.delivery_error,n.created_at,n.sent_at
from public.operations_notifications n where n.delivery_attempts>0 and n.recipient is not null and n.delivery_status in('unknown','sent','failed','accepted','delivered') on conflict do nothing;
commit;
