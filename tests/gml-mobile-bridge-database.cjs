const {PGlite}=require('../work/dbtest/node_modules/@electric-sql/pglite'),fs=require('fs'),assert=require('assert/strict'),{randomUUID}=require('crypto');
(async()=>{const db=new PGlite();try{
 const source=fs.readFileSync('tests/sms-delivery-database.cjs','utf8'),schema=source.match(/await db\.exec\(`([\s\S]*?)`\);/)[1];await db.exec(schema);
 await db.exec(fs.readFileSync('supabase/migrations/20261029110923_tracked_transactional_sms_and_delivery_reports.sql','utf8'));
 await db.exec(`alter table staff_members add primary key(user_id);
 alter table applications add name text,add preparation jsonb default '{}';alter table vehicles add model text,add plate text,add status text,add tracker_id text;
 alter table contracts add status text,add start_date date;alter table payments add paid_on date,add lolc_amount numeric default 0,add method text default 'Espèces',add proof_path text,add recorded_by uuid;
 create table fleet_mandates(id uuid primary key,vehicle_id bigint,owner_application_id bigint,reference text,status text,category text,owner_target numeric,management_fee numeric,progression_reserve numeric,effective_start date,effective_end date,created_at timestamptz default now());
 create table owner_settlements(id uuid primary key,mandate_id uuid,period_start date,period_end date,base_collected numeric,owner_gross numeric,management_fee numeric,progression_reserve numeric,cash_reserve numeric,recovered numeric,owner_net numeric,adjustment_reason text,payment_reference text,paid_on date);
 create table vehicle_advances(id uuid primary key,application_id bigint,debtor text,description text,principal numeric,fee numeric,total numeric,months int,recovery_start date,recovery_deadline date,approval_reference text,funded_on date);
 create table repayment_schedules(id bigint primary key,contract_id uuid,due_on date,lolc_due numeric,gml_due numeric,additional_gml_due numeric default 0);
 create table payment_allocations(payment_id bigint,schedule_id bigint,amount numeric,lolc_amount numeric default 0);
 create table advance_instalments(id int primary key,advance_id uuid,due_on date,amount numeric,schedule_id bigint);
 create table advance_recoveries(instalment_id int,payment_id bigint,amount numeric);
 create table audit_logs(id bigint generated always as identity primary key,application_id bigint,actor_id uuid,entity text,action text,changes jsonb,created_at timestamptz default now());
 create function private.is_staff() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.staff_members where user_id=auth.uid() and active and deleted_at is null)$$;
 grant usage on schema private to authenticated;grant select on applications,vehicles to authenticated;
 update private.sms_transport_config set enabled=true;
 insert into applications(id,phone,program_type,name) values(1,'0810000001','FLEET_OWNER','Owner Alpha'),(2,'+243810000002','FLEET_OWNER','Owner Beta'),(3,'+243810000003','PARTNER_DRIVER','Jean Kabeya');
 insert into vehicles values(1,1,'Toyota Vitz','ALPHA','Disponible','TRACK-A'),(2,2,'Toyota IST','BETA','Disponible','TRACK-B');
 insert into contracts values('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',3,1,'CTR-A','2026-11-06','USD','active','2026-11-05');
 insert into fleet_mandates values('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',1,1,'MANDATE-A','active','A',500,64,44,'2026-11-05','2027-11-04',now());`);
 const recap=fs.readFileSync('supabase/migrations/20261104113843_owner_debt_recap_on_vehicle_activation.sql','utf8').split('create function private.get_owner_financial_recap')[0];await db.exec(recap+'commit;');
 await db.exec(fs.readFileSync(process.env.MOBILE_BRIDGE_MIGRATION||'supabase/migrations/20261105125140_gml_mobile_owner_bridge.sql','utf8'));
 const admin='11111111-1111-1111-1111-111111111111',agent='22222222-2222-2222-2222-222222222222',u=randomUUID(),other=randomUUID();
 async function staff(name,p,actor=admin){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[actor]);await db.exec('set role authenticated');return (await db.query('select '+name+'($1::jsonb) result',[JSON.stringify(p)])).rows[0].result;}
 async function root(sql,args=[]){await db.exec('reset role');return db.query(sql,args);}
 async function bridge(p){await db.exec('reset role;set role service_role');return (await db.query('select mobile_bridge_call($1::jsonb) result',[JSON.stringify({gml_user_id:u,...p})])).rows[0].result;}
 async function invite(id=1){const p={application_id:id,request_id:randomUUID()},r=await staff('create_mobile_owner_invite',p,agent);const code=(await root('select private.mobile_invite_code($1) c',[r.invite_id])).rows[0].c;return {...r,code,p};}
 let i=await invite();assert.ok(!JSON.stringify(i).includes('code_hash'));assert.equal((await staff('create_mobile_owner_invite',i.p,agent)).invite_id,i.invite_id);assert.equal((await root('select count(*)::int n from sms_dispatches where kind=\'mobile_owner_invite\'')).rows[0].n,1);
 // 1. Two proofs, one owner, idempotent redemption and no duplicate SMS.
 const redeem={action:'redeem_invite',code:i.code,gml_phone:'+243810000001'};
 assert.equal((await bridge(redeem)).linked,true);assert.equal((await bridge(redeem)).linked,true);assert.equal((await bridge({...redeem,gml_user_id:other})).error,'invalid_code');
 let overview=await bridge({action:'owner_overview'});assert.deepEqual(overview.vehicles.map(v=>v.vehicle_id),[1]);assert.equal(overview.vehicles[0].driver.name,'Jean K.');
 assert.equal((await root("select count(*)::int n from sms_dispatches where kind='mobile_owner_linked'")).rows[0].n,1);
 // 2. Five wrong codes lock the verified phone's open invite; staff can replace it.
 i=await invite(2);for(let n=1;n<=5;n++)assert.equal((await bridge({action:'redeem_invite',code:'xxxxxxxx',gml_phone:'+243810000002'})).error,'bad_request');
 let wrong=i.code==='00000000'?'99999999':'00000000';for(let n=1;n<=5;n++)assert.equal((await bridge({action:'redeem_invite',code:wrong,gml_phone:'+243810000002'})).error,n===5?'too_many_attempts':'invalid_code');
 assert.equal((await bridge({action:'redeem_invite',code:i.code,gml_phone:'+243810000002'})).error,'too_many_attempts');
 i=await invite(2);assert.equal((await bridge({action:'redeem_invite',code:i.code,gml_phone:'+243810000002',gml_user_id:other})).linked,true);
 // 3. Correct code with another verified phone never creates an access link.
 i=await invite(2);const before=(await root('select count(*)::int n from mobile_owner_links')).rows[0].n;
 assert.equal((await bridge({action:'redeem_invite',code:i.code,gml_phone:'+243810000099'})).error,'phone_mismatch');assert.equal((await root('select count(*)::int n from mobile_owner_links')).rows[0].n,before);
 // 4. Expired at 72h.
 await root("update mobile_owner_invites set expires_at=now()-interval '1 second' where id=$1",[i.invite_id]);assert.equal((await bridge({action:'redeem_invite',code:i.code,gml_phone:'+243810000002'})).error,'expired');
 // 5. Foreign vehicle is invisible in all three detail actions.
 for(const action of ['vehicle_settlements','vehicle_receipts','vehicle_advances'])assert.equal((await bridge({action,vehicle_id:2,month:'2026-11'})).error,'vehicle_not_found');
 // 8. Expose exactly the posted settlement, not a projection.
 await root("insert into owner_settlements values($1,'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','2026-10-01','2026-10-31',682,500,64,44,74,40,460,null,'PAY-OWNER','2026-11-03')",[randomUUID()]);
 let s=(await bridge({action:'vehicle_settlements',vehicle_id:1})).settlements[0];assert.equal(s.owner_net,460);assert.equal(s.owner_net,s.owner_gross-s.recovered);assert.equal(s.base_collected,682);
 // 9. Saturday receipt and reversal, with driver repair recoveries excluded.
 const month=(await root("select date_trunc('month',now() at time zone 'Africa/Kinshasa')::date::text d")).rows[0].d;
 await root("insert into payments(id,contract_id,entry_kind,amount,reference,paid_on,lolc_amount,proof_path,recorded_by) values(1,'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','payment',36,'PRIVATE-RECEIPT',$1,0,'secret/proof.pdf',$2),(2,'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','reversal',36,'PRIVATE-REVERSAL',$1,0,'secret/proof.pdf',$2)",[month,admin]);
 await root("insert into advance_recoveries values(null,1,5),(null,2,-5)");
 const rec=(await bridge({action:'vehicle_receipts',vehicle_id:1,month:month.slice(0,7)})).receipts;assert.deepEqual(rec.map(x=>x.amount).sort((a,b)=>a-b),[-31,31]);
 overview=await bridge({action:'owner_overview'});assert.equal(overview.vehicles[0].current_month.collected_to_date,0);
 await root("insert into payments(id,contract_id,entry_kind,amount,reference,paid_on,lolc_amount) values(3,'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','payment',36,'THIRD',$1,0)",[month]);await root('insert into advance_recoveries values(null,3,5)');
 await root("insert into repayment_schedules values(1,'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',$1,0,36,5)",[month]);await root('insert into payment_allocations values(3,1,36,0)');
 // Attribute this driver's recovery to the schedule, as the finance trigger does.
 await root("insert into advance_instalments values(99,null,$1,5,1)",[month]);await root('update advance_recoveries set instalment_id=99 where payment_id=3');
 overview=await bridge({action:'owner_overview'});assert.equal(overview.vehicles[0].current_month.collected_to_date,31);assert.equal(overview.vehicles[0].current_month.days_paid,1);assert.equal(overview.vehicles[0].current_month.outstanding_to_date,0);
 const saturday=(await root("select d::date::text d from generate_series(date_trunc('month',current_date)-interval '1 month',date_trunc('month',current_date)-interval '1 day',interval '1 day')d where extract(isodow from d)=6 limit 1")).rows[0].d;
 await root("insert into payments(id,contract_id,entry_kind,amount,reference,paid_on,lolc_amount) values(4,'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','payment',31,'SATURDAY',$1,0)",[saturday]);assert.equal((await bridge({action:'vehicle_receipts',vehicle_id:1,month:saturday.slice(0,7)})).receipts[0].amount,31);
 // 10. Explicit response allowlists omit codes, hashes, documents and staff.
 const all=JSON.stringify([overview,s,rec,await bridge({action:'vehicle_advances',vehicle_id:1})]);for(const forbidden of ['proof_path','recorded_by','code_hash','created_by','approval_reference','secret/proof',admin,i.code])assert.ok(!all.includes(forbidden),forbidden);
 assert.ok((await root("select body from sms_dispatches where kind='mobile_owner_invite'")).rows.every(r=>r.body===null));
 // 6. Revocation applies on the next request; replaying a redeemed code cannot restore it.
 const link=(await root('select id from mobile_owner_links where gml_user_id=$1',[u])).rows[0].id;
 await assert.rejects(()=>staff('revoke_mobile_owner_link',{link_id:link,reason:'Retrait demandé',request_id:randomUUID()},agent),/Administration/);
 const revoke={link_id:link,reason:'Retrait demandé',request_id:randomUUID()};await staff('revoke_mobile_owner_link',revoke);await staff('revoke_mobile_owner_link',revoke);
 assert.equal((await bridge({action:'owner_overview'})).error,'not_linked');assert.equal((await bridge(redeem)).error,'invalid_code');
 // Database grants and log immutability.
 await assert.rejects(()=>staff('mobile_bridge_call',{action:'owner_overview',gml_user_id:u}),/permission denied/);
 await assert.rejects(()=>db.query('select code_hash from mobile_owner_invites'),/permission denied/);
 await assert.rejects(()=>db.query("insert into mobile_owner_links(owner_application_id) values(1)"),/permission denied/);
 await root('select 1');await assert.rejects(()=>db.exec('delete from mobile_bridge_events'),/immuable/);
 // Rate counting is database-wide, not per edge process.
 for(let n=0;n<120;n++)await bridge({action:'owner_overview',gml_user_id:other});assert.equal((await bridge({action:'owner_overview',gml_user_id:other})).error,'rate_limited');
 console.log('PASS bridge cases 1–6, 8–10; wrong-code lockout, replacement, idempotency, no plaintext code, scoped fields, RLS, append-only log, persistent rate limit. Case 7: edge test.');
 }finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1});
