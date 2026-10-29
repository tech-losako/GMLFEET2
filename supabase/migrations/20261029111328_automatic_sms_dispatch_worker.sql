begin;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
revoke all on net.http_request_queue,net._http_response from public,anon,authenticated;
create function private.invoke_sms_worker() returns bigint language plpgsql security definer set search_path='' as $$
declare request_id bigint;
begin
 if not(select enabled from private.sms_transport_config where singleton) then return null;end if;
 update public.sms_dispatches set status='unknown',error='Envoi interrompu : vérifier avant tout nouvel envoi' where status='sending' and started_at<now()-interval '5 minutes';
 if not exists(select 1 from public.sms_dispatches where status='pending' and not sensitive) then return null;end if;
 select net.http_post(url:='https://poskrhgqwezjuexbwosc.supabase.co/functions/v1/sms-dispatch',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select worker_token from private.sms_transport_config where singleton)),body:='{"action":"dispatch"}'::jsonb,timeout_milliseconds:=5000) into request_id;
 return request_id;
end $$;
revoke all on function private.invoke_sms_worker() from public,anon,authenticated;
select cron.schedule('gmfleet-sms-dispatch','* * * * *',$job$select private.invoke_sms_worker();$job$);
commit;
