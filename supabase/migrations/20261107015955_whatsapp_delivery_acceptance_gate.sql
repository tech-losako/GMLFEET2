begin;
-- Delivery proves transport readiness. A recipient's optional read receipt
-- is informational and cannot block the channel.
do $patch$declare definition text;begin
 definition:=pg_get_functiondef('private.claim_sms_dispatch(jsonb)'::regprocedure);
 if position('x.read_at is not null' in definition)=0 then raise exception 'Expected WhatsApp readiness gate not found';end if;
 definition:=replace(definition,'x.read_at is not null','(x.delivered_at is not null or x.read_at is not null)');execute definition;
 definition:=pg_get_functiondef('private.whatsapp_health()'::regprocedure);
 definition:=replace(definition,'''test_read_at'',', $replacement$'test_delivered_at',(select max(coalesce(n.delivered_at,n.read_at)) from private.whatsapp_tests t join public.sms_dispatches n on n.id=t.sms_id where not t.force_failure),'test_read_at',$replacement$);execute definition;
end $patch$;
notify pgrst,'reload schema';
commit;
