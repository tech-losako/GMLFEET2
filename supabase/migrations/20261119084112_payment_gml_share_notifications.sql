begin;
-- Notification wording only: never change amounts, allocations or due dates.
create or replace function private.queue_payment_sms() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.applications;c public.contracts;description text;gml numeric;ph text;client_message text;
begin
 select * into c from public.contracts where id=new.contract_id;if not found then return new;end if;
 select * into a from public.applications where id=c.application_id;
 gml:=new.amount-coalesce(new.lolc_amount,0);
 description:=case when new.entry_kind='reversal' then 'annulation de versement : ' else 'versement confirmé : ' end||to_char(new.amount,'FM999999999990.00')||' '||c.currency||' le '||to_char(new.paid_on,'DD/MM/YYYY')||'. Réf. '||new.reference||'.';
 ph:='+'||private.normalize_driver_phone(a.phone);
 if a.id is not null and ph is not null and gml>0 then
  client_message:=case when new.entry_kind='reversal' then 'GM Fleet : annulation de la part GML de ' else 'GM Fleet : nous avons recu ' end||to_char(gml,'FM999999999990.00')||' '||c.currency||case when new.entry_kind='reversal' then '' else ' pour la part GML de votre versement' end||' du '||to_char(new.paid_on,'DD/MM/YYYY')||'. Ref. '||new.reference||'.';
  perform private.queue_sms('payment:'||new.id,'payment_receipt',ph,client_message,a.id);
 end if;
 perform private.queue_boss_finance_sms('payment:'||new.id,'GM Fleet caisse - '||coalesce(a.name,new.driver_name,'Chauffeur')||' : '||description||' GML : '||to_char(gml,'FM999999999990.00')||' '||c.currency||'. LOLC : '||to_char(new.lolc_amount,'FM999999999990.00')||' '||c.currency||'. Mode : '||case when new.method ilike 'Araka%' then 'Paiement digital' else new.method end||'.',a.id);
 return new;
end $$;
do $patch$declare definition text;original text;begin
 definition:=pg_get_functiondef('private.whatsapp_snapshot(public.sms_dispatches)'::regprocedure);original:=definition;
 -- Existing approved template says "votre versement GM Fleet" and contains no LOLC wording.
 definition:=replace(definition,$old$else t:='gml_versement_confirme_fr';p:=jsonb_build_array(coalesce(a.name,pay.driver_name),pay.amount::text,$old$,$new$else t:='gml_versement_confirme_fr';p:=jsonb_build_array(coalesce(a.name,pay.driver_name),(pay.amount-coalesce(pay.lolc_amount,0))::text,$new$);
 if definition=original then raise exception 'Expected client receipt parameter mapping not found';end if;
 definition:=replace(definition,$old$if pay.id is null or c.id is null then return null;end if;$old$,$new$if pay.id is null or c.id is null then return null;end if;
  -- The old cancellation template mentions LOLC; retain GML-only SMS until a dedicated template exists.
  if n.kind='payment_receipt' and (pay.entry_kind='reversal' or pay.amount-coalesce(pay.lolc_amount,0)<=0) then return null;end if;$new$);
 execute definition;
 definition:=pg_get_functiondef('private.whatsapp_health()'::regprocedure);
 definition:=replace(definition,$old$'contacts',$old$,$new$'staff_recipients',(select coalesce(jsonb_agg(jsonb_build_object('name',s.display_name,'phone',s.phone,'whatsapp',coalesce(w.opted_in,false)) order by s.display_name),'[]'::jsonb) from public.staff_members s left join private.whatsapp_contacts w on w.phone=private.normalize_driver_phone(s.phone) where s.active and s.deleted_at is null and s.receives_finance_sms),'contacts',$new$);execute definition;
end $patch$;
notify pgrst,'reload schema';
commit;
