const fs=require('fs'),assert=require('assert/strict'),{randomUUID}=require('crypto'),{PGlite}=require('../work/dbtest/node_modules/@electric-sql/pglite');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
(async()=>{const db=new PGlite();try{
 // Reuse the real managed-fleet schema and workflow fixture, before any test data.
 const source=fs.readFileSync('tests/connected-fleet-finance-database.cjs','utf8'),init=source.slice(source.indexOf('const boot='),source.indexOf('const admin='));await new AsyncFunction('db','fs','process',init)(db,fs,process);
 await db.exec(`alter table staff_members add column if not exists deleted_at timestamptz;
 create table sms_dispatches(event_key text primary key,kind text,recipient text,body text,application_id bigint);
 create function private.queue_sms(k text,t text,ph text,msg text,a bigint default null,ap uuid default null,q uuid default null,n bigint default null) returns void language sql security definer set search_path='' as $$insert into public.sms_dispatches values(k,t,ph,msg,a) on conflict do nothing$$;`);
 const recap=fs.readFileSync('supabase/migrations/20261104113843_owner_debt_recap_on_vehicle_activation.sql','utf8').split('create function private.get_owner_financial_recap')[0];await db.exec(recap+'commit;');
 await db.exec(fs.readFileSync(process.env.SERVICE_REVIEW_MIGRATION||'supabase/migrations/20261105162514_reviewed_owner_service_activation.sql','utf8'));
 await db.exec('create trigger queue_contract_sms after insert on public.contracts for each row execute function private.queue_contract_sms()');
 const admin='11111111-1111-1111-1111-111111111111';
 async function root(sql,args=[]){await db.exec('reset role');return db.query(sql,args);}
 async function rpc(name,p){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);await db.exec('set role authenticated');return (await db.query('select '+name+'($1::jsonb) value',[JSON.stringify(p)])).rows[0].value;}
 const helpers=source.slice(source.indexOf('async function create(service)'),source.indexOf('let owner='));
 const fixture=await new AsyncFunction('db','rpc','q','randomUUID',helpers+`
 let owner=await appointment(await create('Gestion de flotte'));owner=await decide(owner,'inspection_passed',Object.fromEntries(['roadworthy','carte_rose','insurance','transport_authorization','vignette','technical_control'].map(k=>[k,true])));owner=await decide(owner,'installed',{equipment_package:'tracker',tracker_id:'TRACK-1',sim_number:'+243810000001',sim_operator:'Vodacom'});
 const today=(await q("select (now() at time zone 'Africa/Kinshasa')::date::text d")).rows[0].d;
 const vehicle=await rpc('onboard_owner_vehicle',{application_id:owner.id,revision:owner.revision,model:'Toyota Vitz',plate:'REVIEW-001',vin:'VIN-1',tracker_id:'TRACK-1',fuel_amount:63,fuel_reference:'FUEL-RECEIPT',fuel_paid_on:today,fuel_funding:'gml',fuel_months:2,fuel_request_id:randomUUID()});
 let driver=await appointment(await create('Recrutement Chauffeur'));for(const outcome of ['interview_passed','driving_test_passed','training_completed'])driver=await decide(driver,outcome);
 return {owner,driver,vehicle,today};`)(db,rpc,async(sql,args)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);await db.exec('set role authenticated');return db.query(sql,args)},randomUUID);
 const {owner,driver,vehicle,today}=fixture;
 await root("update applications set email='owner@example.test',address='Gombe',service_details=service_details||'{\"email\":\"owner@example.test\",\"idNumber\":\"OWNER-ID\",\"carBrand\":\"Toyota\",\"carYear\":\"2020\"}' where id=$1",[owner.id]);
 const mandate=await rpc('create_fleet_mandate',{vehicle_id:vehicle,kinshasa_registered_on:'2023-05-19',signed_on:today,acceptance_reference:'SIGNED-OWNER',request_id:randomUUID()});
 let review=await rpc('get_owner_service_setup',{vehicle_id:vehicle,driver_application_id:driver.id,start_date:today});assert.ok(review.blockers.some(x=>x.includes('fiche chauffeur')));
 await root("update applications set birth_date='1990-01-01',service_details=service_details||'{\"idNumber\":\"DRIVER-ID\",\"birthPlace\":\"Kinshasa\",\"nationality\":\"Congolaise\",\"addressNumber\":\"1\",\"addressAvenue\":\"Exemple\",\"addressQuarter\":\"Fleuve\",\"addressCommune\":\"Gombe\",\"licenseNumber\":\"PERMIS\",\"licenseCategory\":\"B\"}' where id=$1",[driver.id]);
 const dates=(await root("select ($1::date+interval '12 months'-interval '1 day')::date::text last,min(d)::date::text first from generate_series($1::date+1,$1::date+7,interval '1 day')d where extract(isodow from d)<=5",[today])).rows[0];
 const command={application_id:driver.id,currency:'USD',model:'Toyota Vitz',plate:'REVIEW-001',vin:'VIN-1',tracker_id:'TRACK-1',start_date:today,end_date:dates.last,first_payment_date:dates.first,daily_lolc:0,daily_gml:31,operating_days:[1,2,3,4,5],excluded_dates:[],request_id:randomUUID()};
 await assert.rejects(()=>rpc('activate_contract',command),/Relisez et confirmez/);
 assert.equal((await root('select count(*)::int n from contracts')).rows[0].n,0);assert.equal((await root('select count(*)::int n from repayment_schedules')).rows[0].n,0);
 review=await rpc('get_owner_service_setup',{vehicle_id:vehicle,driver_application_id:driver.id,start_date:today});assert.equal(review.blockers.length,0);
 const issue=await rpc('report_vehicle_issue',{vehicle_id:vehicle,responsibility:'owner',description:'Réparation mécanique et climatisation',request_id:randomUUID()});
 await assert.rejects(()=>rpc('activate_contract',{...command,owner_setup_reviewed:true,owner_setup_fingerprint:review.fingerprint}),/réparations signalées/);
 const advance=await rpc('record_vehicle_advance',{vehicle_id:vehicle,debtor:'owner',kind:'document',description:'Documents avancés',principal:460,months:4,funded_on:today,recovery_start:today,approval_reference:'OWNER-APPROVAL',expense_reference:'GARAGE-INVOICE',request_id:randomUUID()});
 const before=(await root('select * from vehicle_advances where id=$1',[advance])).rows[0];const termsBefore=(await root('select * from advance_instalments where advance_id=$1 order by due_on',[advance])).rows;
 const correction={advance_id:advance,kind:'repair',description:'Réparations mécaniques et climatisation',issue_id:issue,reason:'Correction de catégorie confirmée par le propriétaire',request_id:randomUUID()};await rpc('correct_vehicle_advance_details',correction);assert.equal(await rpc('correct_vehicle_advance_details',correction),advance);
 const after=(await root('select * from vehicle_advances where id=$1',[advance])).rows[0];for(const k of ['principal','fee','total','months','recovery_start','recovery_deadline','command_payload'])assert.deepEqual(after[k],before[k],k);assert.deepEqual((await root('select * from advance_instalments where advance_id=$1 order by due_on',[advance])).rows,termsBefore);
 await rpc('update_vehicle_issue',{issue_id:issue,revision:1,responsibility:'owner',status:'gml_repaired',evidence_reference:'GARAGE-INVOICE',notes:'Travaux terminés et véhicule contrôlé',request_id:randomUUID()});
 await assert.rejects(()=>rpc('activate_contract',{...command,owner_setup_reviewed:true,owner_setup_fingerprint:review.fingerprint}),/informations ou frais ont changé/);
 review=await rpc('get_owner_service_setup',{vehicle_id:vehicle,driver_application_id:driver.id,start_date:today});assert.equal(review.blockers.length,0);assert.equal(review.recap.remaining,601.45);
 const approved={...command,owner_setup_reviewed:true,owner_setup_fingerprint:review.fingerprint};const id=await rpc('activate_contract',approved);assert.equal(await rpc('activate_contract',approved),id);
 const sms=(await root('select * from sms_dispatches')).rows;assert.equal(sms.filter(x=>x.kind==='owner_assignment').length,1);assert.equal(sms.filter(x=>x.kind==='owner_debt_recap').length,0);assert.equal(sms.filter(x=>x.kind==='contract_activated').length,1);
 const message=sms.find(x=>x.kind==='owner_assignment').body;for(const text of ['63','9.45','72.45','460','69','529','601.45','mois'])assert.ok(message.includes(text),text);
 assert.equal((await root('select count(*)::int n from repayment_schedules where contract_id=$1 and extract(isodow from due_on)>5',[id])).rows[0].n,0);
 assert.equal((await root('select status from fleet_mandates where id=$1',[mandate])).rows[0].status,'active');
 console.log('PASS managed activation requires complete identity, resolved repairs, reviewed/stale-safe costs; audited repair reclassification preserves amounts and instalments; one consolidated owner SMS; idempotent activation and unchanged Mon–Fri schedule. No real messages sent.');
 }finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1});
