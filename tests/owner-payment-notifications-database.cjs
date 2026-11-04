const {PGlite}=require('../work/dbtest/node_modules/@electric-sql/pglite'),fs=require('fs'),assert=require('assert/strict');
(async()=>{const db=new PGlite();try{
 // Reuse the transport fixture so these tests exercise the real durable queue and its permissions.
 const transportTest=fs.readFileSync('tests/sms-delivery-database.cjs','utf8');
 const schema=transportTest.match(/await db\.exec\(`([\s\S]*?)`\);/);assert.ok(schema);
 await db.exec(schema[1]);
 await db.exec(fs.readFileSync('supabase/migrations/20261029110923_tracked_transactional_sms_and_delivery_reports.sql','utf8'));
 await db.exec(`alter table vehicles add column model text,add column plate text;
 alter table contracts add column start_date date;
 alter table payments add column paid_on date;
 create table fleet_mandates(id uuid primary key,owner_application_id bigint,vehicle_id bigint);
 create table owner_settlements(id uuid primary key,mandate_id uuid,period_start date,period_end date,owner_net numeric,recovered numeric,paid_on date,payment_reference text);
 create table lolc_case_payments(id uuid primary key,application_id bigint,kind text,amount numeric,paid_on date,reference text);
 update private.sms_transport_config set enabled=true;
 insert into applications(id,phone,case_reference) values(1,'+243810000001','DRIVER-1'),(2,'+243810000002','OWNER-2');
 insert into vehicles values(1,2,'Toyota Vitz','TEST-001'),(2,null,'Suzuki Swift','TEST-002');`);
 await db.exec(fs.readFileSync(process.env.OWNER_PAYMENT_SMS_MIGRATION||'supabase/migrations/20261104102157_owner_and_confirmed_payment_sms_notifications.sql','utf8'));
 const messages=async(kind)=>(await db.query('select * from sms_dispatches where kind=$1 order by created_at',[kind])).rows;
 await db.exec(`insert into contracts values('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',1,1,'GMF-CTR-1','2026-11-05','USD','2026-11-04');`);
 let rows=await messages('owner_assignment');assert.equal(rows.length,1);assert.equal(rows[0].recipient,'+243810000002');assert.match(rows[0].body,/Toyota Vitz \(TEST-001\).*04\/11\/2026.*GMF-CTR-1/);
 await db.exec(`insert into payments values(1,'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','payment',155,'CASH-1','2026-11-06');`);
 assert.equal((await messages('payment_receipt')).length,1);rows=await messages('owner_collection');assert.equal(rows.length,1);assert.equal(rows[0].recipient,'+243810000002');assert.match(rows[0].body,/155.00 USD le 06\/11\/2026.*CASH-1.*bilan mensuel/);
 // Confirmed digital receipts follow the same ledger trigger, not an unverified payment attempt.
 await db.exec(`insert into payments values(2,'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','payment',31,'DIGITAL-2','2026-11-09');insert into payments values(3,'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','reversal',31,'REVERSAL-3','2026-11-09');`);
 assert.equal((await messages('payment_receipt')).length,3);assert.equal((await messages('owner_collection')).length,3);assert.match((await messages('owner_collection'))[2].body,/annulation/);
 await db.exec(`begin;insert into payments values(4,'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','payment',31,'ROLLBACK','2026-11-10');rollback;`);assert.equal((await messages('owner_collection')).length,3);
 await db.exec(`select private.queue_sms('payment:1:owner','owner_collection','+243810000002','duplicate',2);`);assert.equal((await messages('owner_collection')).length,3);
 await db.exec(`insert into contracts values('cccccccc-cccc-cccc-cccc-cccccccccccc',1,2,'GMF-CTR-2','2026-11-05','USD','2026-11-04');insert into payments values(5,'cccccccc-cccc-cccc-cccc-cccccccccccc','payment',177,'LOAN-5','2026-11-08');`);assert.equal((await messages('owner_collection')).length,3);assert.equal((await messages('owner_assignment')).length,1);
 await db.exec(`insert into fleet_mandates values('dddddddd-dddd-dddd-dddd-dddddddddddd',2,1);insert into owner_settlements values('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','dddddddd-dddd-dddd-dddd-dddddddddddd','2026-11-01','2026-11-30',419.5,80.5,'2026-11-30','OWNER-PAYOUT-1');`);
 rows=await messages('owner_settlement');assert.equal(rows.length,1);assert.equal(rows[0].recipient,'+243810000002');assert.match(rows[0].body,/419.50 USD.*80.50 USD.*OWNER-PAYOUT-1/);
 await db.exec(`insert into lolc_case_payments values('ffffffff-ffff-ffff-ffff-ffffffffffff',1,'client_deposit_lolc',1400,'2026-11-04','DEPOSIT-1'),('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',1,'equipment_received',240,'2026-11-04','EQUIPMENT-1');`);rows=await messages('lolc_deposit_receipt');assert.equal(rows.length,1);assert.match(rows[0].body,/1400.00 USD.*DEPOSIT-1/);
 assert.equal((await db.query("select count(*) n from sms_dispatches where status<>'pending'")).rows[0].n,0,'tests only queue locally; no provider calls');
 await db.exec('set role authenticated');await assert.rejects(()=>db.query('select private.queue_owner_settlement_sms()'),/permission denied/);
 console.log('PASS owner start, cash/digital receipts, owner collections, reversals, monthly payout, LOLC deposit, non-owner isolation, deduplication, rollback and private permissions');
 }finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
