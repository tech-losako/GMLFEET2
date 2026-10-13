const fs=require('node:fs'),assert=require('node:assert/strict'),{PGlite}=require(process.env.PGLITE_MODULE||'../tmp/document-tests/node_modules/@electric-sql/pglite');
(async()=>{const db=new PGlite();try{
 const bootstrap=fs.readFileSync('tests/finance-database.cjs','utf8').split('await db.exec(`')[1].split('`);')[0];await db.exec(bootstrap);await db.exec('create role service_role bypassrls');
 for(const name of ['20260916114252_operations_dashboard','20260916133033_contracts_cashier_reconciliation','20260917101529_araka_driver_payments','20260917111108_driver_phone_and_mobile_money_fees','20260917112541_driver_plate_lookup_and_receipts','20260922095357_driver_daily_schedule_and_receipt_split','20260924094709_candidature_lifecycle','20261002082903_admin_guided_workflow','20261009180948_streamlined_appointment_confirmation','20260924110206_vehicle_model_specs'])await db.exec(fs.readFileSync('supabase/migrations/'+name+'.sql','utf8'));
 const migration=fs.readdirSync('supabase/migrations').find(f=>f.endsWith('_twelve_month_vehicle_offers.sql'));await db.exec(fs.readFileSync('supabase/migrations/'+migration,'utf8'));
 await db.exec(`select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);set role authenticated`);
 const app=(await db.query(`insert into applications(name,phone,vehicle,source,plan_duration_months) values('Isolated applicant','+243810000000','Toyota Vitz','office',12) returning *`)).rows[0];
 assert.equal(app.plan_duration_months,12);assert.equal(app.service_details.offerTotalUsd,9288);assert.equal(app.service_details.dailyPayment,'29.77 USD');assert.equal(app.program_type,'DRIVE_TO_OWN');assert.equal(app.workflow_stage,'new');assert.equal(app.lifecycle_version,2);assert.match(app.case_reference,/CNG-/);
 await db.query(`update applications set review_status='accepted' where id=$1`,[app.id]);assert.equal((await db.query('select service_details from applications where id=$1',[app.id])).rows[0].service_details.offerTotalUsd,9288);
 assert.equal((await db.query('select count(*)::int n from contracts')).rows[0].n,0);
 const publicApp=(await db.query(`insert into applications(name,phone,vehicle,source,service_details) values('Isolated online applicant','+243810000000','Suzuki Swift','website','{"offerRevision":2}') returning *`)).rows[0];assert.equal(publicApp.plan_duration_months,12);
 assert.ok((await db.query('select * from audit_logs where application_id=$1',[publicApp.id])).rows.length>0);
 console.log('PASS pricing integration with full operations/lifecycle/finance schema: reference generation, new intake, quote snapshots, review transitions and audit.');
}finally{await db.close();}})().catch(e=>{console.error(e.message,e.where);process.exitCode=1;});
