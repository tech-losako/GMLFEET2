begin;
create or replace function private.queue_case_notifications_sms() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.applications; message text;
begin
 if new.kind in('accepted','rejected','appointment') and new.channel='sms_draft' then
  perform private.queue_sms('notification:'||new.id,new.kind,new.recipient,new.body,new.application_id,new.appointment_id,new.quote_id,new.id);
 elsif new.kind='intake' and new.application_id is not null then
  select * into a from public.applications where id=new.application_id;
  message:='GM Fleet admin : Nouvelle candidature '||coalesce(nullif(a.case_reference,''),'DOSSIER-'||a.id)||' : '||a.name||' ('||coalesce(nullif(a.vehicle,''),nullif(a.service,''),'demande')||'). Ouvrez l''espace opérations.';
  perform private.queue_admin_sms('application:'||new.application_id,message,new.application_id);
 end if;
 return new;
end $$;
revoke all on function private.queue_case_notifications_sms() from public,anon,authenticated;
commit;
