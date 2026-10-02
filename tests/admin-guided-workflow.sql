begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
do $$
declare app_id bigint; ap uuid; ref text;
begin
 insert into public.applications(name,phone,vehicle,source,assigned_to)
 values('Workflow guidé','+243810000001','Toyota Vitz','office',auth.uid())
 returning id,case_reference into app_id,ref;
 assert ref like 'CNG-%','Car na ngai reference';
 update public.applications set review_status='accepted' where id=app_id;

 insert into public.appointments(application_id,starts_at,location,assigned_to,briefing_confirmed,purpose)
 values(app_id,now(),'LOLC',auth.uid(),true,'account') returning id into ap;
 assert (select sequence_no=1 from public.appointments where id=ap),'first appointment numbered';
 perform public.record_guided_appointment(jsonb_build_object('appointment_id',ap,'outcome','lolc_approved','notes','Accord reçu','result',jsonb_build_object('lolc_reference','LOLC-TEST')));
 assert (select process_step='sourcing' and lolc_status='approved' from public.applications where id=app_id),'LOLC decision advances sourcing';

 insert into public.appointments(application_id,starts_at,location,assigned_to,briefing_confirmed,purpose)
 values(app_id,now(),'Concessionnaire',auth.uid(),true,'vehicle_purchase') returning id into ap;
 perform public.record_guided_appointment(jsonb_build_object('appointment_id',ap,'outcome','vehicle_bought','result',jsonb_build_object('model','Toyota Vitz','plate','1234 AB 01','vin','VIN-GUIDED-1','purchase_date',current_date)));
 assert (select process_step='equipment' and preparation @> '{"vehicle_received":true}' from public.applications where id=app_id),'purchase advances installation';

 insert into public.appointments(application_id,starts_at,location,assigned_to,briefing_confirmed,purpose)
 values(app_id,now(),'Atelier GML',auth.uid(),true,'installation') returning id into ap;
 perform public.record_guided_appointment(jsonb_build_object('appointment_id',ap,'outcome','installed','result',jsonb_build_object('tracker_id','TRK-GUIDED-1','dashcam_id','CAM-GUIDED-1','installation_date',current_date)));
 assert (select process_step='documents' and preparation @> '{"tracker":true}' from public.applications where id=app_id),'installation advances handover';

 insert into public.appointments(application_id,starts_at,location,assigned_to,briefing_confirmed,purpose)
 values(app_id,now(),'GM Fleet',auth.uid(),true,'handover') returning id into ap;
 perform public.record_guided_appointment(jsonb_build_object('appointment_id',ap,'outcome','handed_over','result',jsonb_build_object('handover_date',current_date)));
 assert (select process_step='handover' and workflow_stage='handed_over' from public.applications where id=app_id),'handover completes operations';
 assert (select count(*)=4 and min(sequence_no)=1 and max(sequence_no)=4 from public.appointments where application_id=app_id),'appointments stay ordered';
end $$;
rollback;
