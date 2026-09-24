-- Run against a migrated database. All fixtures, contracts, schedules and notifications roll back.
begin;
select set_config('request.jwt.claim.sub',(select user_id::text from public.staff_members where active and role in ('admin','super_admin') limit 1),true);
set local role authenticated;
do $$
#variable_conflict use_variable
declare dto bigint; owner_id bigint; driver_app bigint; yango bigint; vehicle_id bigint; contract_id uuid; driver_contract uuid; rev integer; blocked boolean; p jsonb; actor uuid:=auth.uid(); today date:=(now() at time zone 'Africa/Kinshasa')::date; marker text:='TEST-'||substr(gen_random_uuid()::text,1,8);
begin
 insert into public.applications(name,phone,vehicle,source) values('Lifecycle rollback DTO','+243000000000','Test vehicle','office') returning id into dto;
 assert (select review_status='pending' and lifecycle_version=2 from public.applications where id=dto),'new intake defaults';
 assert (select count(*)=1 from public.operations_notifications where application_id=dto and kind='intake' and status='unread'),'durable admin notification';
 blocked:=false;begin insert into public.appointments(application_id,starts_at,location,assigned_to,briefing_confirmed,purpose) values(dto,now()+interval '1 day','Test office',actor,true,'account');exception when others then blocked:=sqlerrm like '%Acceptez%';end;assert blocked,'unreviewed appointment rejected';
 blocked:=false;begin update public.applications set review_status='rejected' where id=dto;exception when others then blocked:=sqlerrm like '%motif%';end;assert blocked,'refusal needs reason';
 update public.applications set review_status='accepted' where id=dto;
 assert (select lolc_status='not_submitted' and process_step='appointment' from public.applications where id=dto),'GML acceptance does not approve LOLC';
 assert (select count(*)=1 from public.operations_notifications where application_id=dto and kind='accepted' and status='draft'),'acceptance SMS draft only';
 insert into public.appointments(application_id,starts_at,location,assigned_to,briefing_confirmed,purpose,instructions) values(dto,now()+interval '1 day','Test office',actor,true,'account','Apportez vos documents');
 assert (select count(*)=1 from public.operations_notifications where application_id=dto and kind='appointment' and body like '%Test office%'),'prefilled appointment SMS';
 blocked:=false;begin update public.applications set process_step='sourcing' where id=dto;exception when others then blocked:=sqlerrm like '%requis%';end;assert blocked,'cannot skip account/LOLC';
 update public.applications set lolc_status='approved',process_step='handover',preparation=jsonb_build_object('account_opened',true,'lolc_eligible',true,'vehicle_found',true,'gml_inspected',true,'lolc_inspected',true,'client_validated',true,'vehicle_received',true,'tracker',true,'paperwork',true,'yango',true,'handover_on',today-1) where id=dto;
 p:=jsonb_build_object('request_id',gen_random_uuid(),'application_id',dto,'signed_reference',marker||'-DTO','currency','USD','model','Test','plate',marker||'-DTO','vin',marker||'-DTO','tracker_id',marker,'start_date',today-1,'end_date',today+30,'first_payment_date',today-1,'daily_lolc',27,'daily_gml',2.5,'operating_days',jsonb_build_array(1,2,3,4,5,6,7),'excluded_dates','[]'::jsonb);
 blocked:=false;begin perform public.activate_contract(p);exception when others then blocked:=sqlerrm like '%lendemain%';end;assert blocked,'same-day first installment rejected';
 p:=p||jsonb_build_object('first_payment_date',today);contract_id:=public.activate_contract(p);
 assert (select min(due_on)=today from public.repayment_schedules where repayment_schedules.contract_id=contract_id),'first schedule on next day';
 assert public.activate_contract(p)=contract_id,'contract idempotency preserved';
 blocked:=false;begin update public.applications set process_step='appointment' where id=dto;exception when others then blocked:=sqlerrm like '%Dossier actif%';end;assert blocked,'cannot roll back a contracted dossier';

 insert into public.applications(name,phone,vehicle,service,source) values('Lifecycle rollback owner','+243000000000','Test','Gestion de flotte','office') returning id into owner_id;
 update public.applications set review_status='accepted' where id=owner_id;
 blocked:=false;begin update public.applications set process_step='ready' where id=owner_id;exception when others then blocked:=sqlerrm like '%requis%';end;assert blocked,'owner documents required';
 update public.applications set process_step='ready',preparation='{"roadworthy":true,"carte_rose":true,"insurance":true,"transport_authorization":true,"vignette":true,"technical_control":true,"tracker":true,"dashcam":true}' where id=owner_id returning revision into rev;
 p:=jsonb_build_object('application_id',owner_id,'revision',rev,'model','Test owner car','plate',marker||'-OWNER','vin',marker||'-OWNER','tracker_id',marker);
 blocked:=false;begin perform public.onboard_owner_vehicle(p);exception when others then blocked:=sqlerrm like '%70 USD%';end;assert blocked,'fuel receipt required';
 p:=p||jsonb_build_object('fuel_reference',marker||'-FUEL','fuel_paid_on',today);vehicle_id:=public.onboard_owner_vehicle(p);
 assert public.onboard_owner_vehicle(p)=vehicle_id,'owner onboarding retry is idempotent';
 assert (select status='Disponible' and owner_application_id=owner_id from public.vehicles where id=vehicle_id),'owner vehicle available';

 insert into public.applications(name,phone,vehicle,service,source) values('Lifecycle rollback driver','+243000000000','Test','Recrutement Chauffeur','office') returning id into driver_app;
 update public.applications set review_status='accepted' where id=driver_app;
 blocked:=false;begin update public.applications set process_step='allocation' where id=driver_app;exception when others then blocked:=sqlerrm like '%requis%';end;assert blocked,'driver test required';
 update public.applications set process_step='allocation',preparation='{"interview_passed":true,"driving_test_passed":true,"training_completed":true}' where id=driver_app;
 p:=jsonb_build_object('request_id',gen_random_uuid(),'application_id',driver_app,'signed_reference',marker||'-DRIVER','currency','USD','model','Test','plate',marker||'-NEW','vin',marker||'-NEW','tracker_id',marker,'start_date',today,'end_date',today+30,'first_payment_date',today,'daily_lolc',0,'daily_gml',20,'operating_days',jsonb_build_array(1,2,3,4,5,6,7),'excluded_dates','[]'::jsonb);
 blocked:=false;begin perform public.activate_contract(p);exception when others then blocked:=sqlerrm like '%déjà enregistré%';end;assert blocked,'driver allocation must use existing fleet';
 p:=p||jsonb_build_object('plate',marker||'-OWNER','vin',marker||'-OWNER');driver_contract:=public.activate_contract(p);
 assert (select c.vehicle_id=vehicle_id from public.contracts c where c.id=driver_contract),'selected car assigned';
 assert (select count(*)=1 from public.vehicle_assignments va where va.contract_id=driver_contract),'assignment record created';

 insert into public.applications(name,phone,vehicle,service,source) values('Lifecycle rollback Yango','+243000000000','Test','Chauffeur Yango','office') returning id into yango;
 update public.applications set review_status='accepted' where id=yango;
 blocked:=false;begin update public.applications set process_step='joined' where id=yango;exception when others then blocked:=sqlerrm like '%requis%';end;assert blocked,'cannot count an unconfirmed partner';
 update public.applications set process_step='joined',preparation='{"invitation_explained":true,"yango_joined":true}' where id=yango;
 assert (select process_step='joined' from public.applications where id=yango),'partner confirmed';
 assert not exists(select 1 from public.contracts where application_id=yango),'no fabricated partner contract or earnings';
 assert not has_table_privilege('anon','public.operations_notifications','SELECT'),'notification privacy';
 assert not has_table_privilege('authenticated','public.operations_notifications','INSERT'),'client cannot fake sent messages';
end $$;
reset role;
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
set local role authenticated;
do $$ begin
 assert (select count(*)=0 from public.operations_notifications),'nonstaff cannot read messages';
 begin perform public.onboard_owner_vehicle('{}');raise exception 'unexpected access';exception when others then assert sqlerrm like '%personnel%','nonstaff RPC denied';end;
end $$;
rollback;
