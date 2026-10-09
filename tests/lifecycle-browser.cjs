const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
let fixture='function fixture(){'+fs.readFileSync(path.join(__dirname,'finance-browser.cjs'),'utf8').split('function fixture(){')[1].split('\n(async()=>')[0];
fixture=fixture.replace("if(this.mode==='update')items.forEach(r=>Object.assign(r,this.payload,{revision:r.revision+1}));","if(this.mode==='update')items.forEach(r=>{Object.assign(r,this.payload,{revision:r.revision+1});if(this.payload.review_status){r.process_step=r.review_status==='accepted'?'appointment':'review';r.workflow_stage=r.review_status==='accepted'?'contacted':'rejected';}});");
function seed(){
 const t=window.fixtureTables;t.equipment_quotes=[];
 const b={...t.applications[0],lifecycle_version:2,review_status:'pending',process_step:'review',assigned_to:t.staff_members[0].user_id,phone:'+243810000000',preparation:{},service_details:{}};
 t.applications=['DRIVE_TO_OWN','PARTNER_DRIVER','FLEET_OWNER','YANGO'].map((program_type,i)=>({...b,id:i+1,case_reference:'TEST-'+(i+1),name:'Candidate '+program_type,program_type,preparation:{}}));
 const factory=window.supabase.createClient;
 window.functionCalls=[];
 window.supabase.createClient=(...args)=>{
  const db=factory(...args),original=db.rpc;
  db.functions={invoke:async(name,{body:p})=>{
   window.functionCalls.push({name,p});let ap=t.appointments.find(x=>x.id===p.appointment_id||x.booking_request_id===p.request_id);
   if(!ap){const a=t.applications.find(x=>x.id===p.application_id);ap={id:crypto.randomUUID(),application_id:a.id,booking_request_id:p.request_id,status:'scheduled',starts_at:p.starts_at,location:p.location,assigned_to:a.assigned_to,purpose:GMFleetWorkflow.flows[a.program_type].purpose,sequence_no:1};t.appointments.push(ap);a.workflow_stage='appointment';a.revision++;t.operations_notifications.push({id:crypto.randomUUID(),application_id:a.id,appointment_id:ap.id,kind:'appointment',delivery_status:'pending'});}
   const n=t.operations_notifications.find(x=>x.appointment_id===ap.id);n.delivery_status=window.failSmsOnce?'failed':'sent';window.failSmsOnce=false;
   return {data:{success:true,appointment_id:ap.id,sms_status:n.delivery_status,sms_error:n.delivery_status==='failed'?'SMS refused by test provider':null}};
  }};
  db.rpc=async(name,{p})=>{
   if(name==='record_case_step'){
    window.rpcCalls.push({name,p});const a=t.applications.find(x=>x.id===p.application_id),ap=t.appointments.find(x=>x.id===p.appointment_id);
    const targets={lolc_approved:'sourcing',information_required:'account',lolc_rejected:'account',vehicle_selected:'gml_inspection',vehicle_accepted:'custody',vehicle_received:'equipment',installed:a.program_type==='FLEET_OWNER'?'ready':'documents',handed_over:'handover',interview_passed:'interview',driving_test_passed:'test',training_completed:'allocation',invitation_explained:'invited',yango_joined:'joined',repairs_required:'repairs'};
    const before=JSON.parse(JSON.stringify(a));
    if(p.outcome==='inspection_passed')a.process_step=a.program_type==='FLEET_OWNER'?'equipment':a.process_step==='gml_inspection'?'lolc_inspection':'client_validation';
    else if(targets[p.outcome])a.process_step=targets[p.outcome];
    if(p.outcome==='lolc_approved'){a.lolc_status='approved';a.lolc_reference='LOLC-'+a.case_reference;}
    if(p.outcome==='vehicle_selected')a.preparation.purchased_vehicle=p.result;
    if(p.outcome==='installed')a.preparation.equipment=p.result;
    a.preparation.last_decision={...p,actor_id:t.staff_members[0].user_id,recorded_at:new Date().toISOString()};a.revision++;
    if(ap){ap.status=['missed','cancelled'].includes(p.outcome)?p.outcome:'completed';ap.outcome=p.outcome;ap.outcome_notes=p.notes;}
    if(a.process_step==='handover')a.workflow_stage='handed_over';
    t.audit_logs.push({id:crypto.randomUUID(),application_id:a.id,entity:'applications',action:'UPDATE',actor_id:t.staff_members[0].user_id,created_at:new Date().toISOString(),changes:{before,after:JSON.parse(JSON.stringify(a))}});
    return {data:a.id};
   }
   if(name==='onboard_owner_vehicle'){t.vehicles.push({id:99,model:p.model,plate:p.plate,vin:p.vin,status:'Disponible',owner_application_id:p.application_id});t.applications.find(a=>a.id===p.application_id).preparation.fleet_joined_on=p.fuel_paid_on;return {data:99};}
   return original(name,{p});
  };
  return db;
 };
}
(async()=>{
 const server=http.createServer((req,res)=>{try{const file=path.join(root,new URL(req.url,'http://local').pathname);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/vendor/supabase-2.57.4.js',r=>r.fulfill({contentType:'text/javascript',body:'('+fixture+')();('+seed.toString()+')();'}));await page.route('**/supabase.co/**',r=>r.abort());
  await page.goto((process.env.LIFECYCLE_BASE_URL||'http://127.0.0.1:'+server.address().port)+'/admin.html');await page.locator('#workspace').waitFor();
  const nav=async v=>page.locator('nav [data-view="'+v+'"]').click();
  const close=async()=>page.locator('[data-close=caseDialog]').click();
  const open=async program=>{await nav('preparation');await page.locator('.row').filter({has:page.getByRole('button',{name:'Candidate '+program,exact:true})}).locator('[data-open-tab]').click();await page.locator('#case-panel-appointments').waitFor({state:'visible'});};
  const accept=async program=>{await nav('applications');await page.getByRole('button',{name:'Candidate '+program,exact:true}).click();assert.equal(await page.locator('.case-tabs button').last().getAttribute('id'),'case-tab-decision');await page.locator('#case-tab-decision').click();await page.locator('#reviewForm button').click();await page.locator('#appointmentForm').waitFor();};
  const book=async(fail=false)=>{
   assert.equal(await page.locator('#appointmentForm input').count(),3);assert.equal(await page.locator('#workflowForm').count(),0);assert.match(await page.locator('#appointmentForm [name=location]').inputValue(),/Ngongo/);
   const parts=await page.evaluate(()=>{const d=new Date(Date.now()+120000);return {day:new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Kinshasa',year:'numeric',month:'2-digit',day:'2-digit'}).format(d),time:new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Kinshasa',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(d)};});
   await page.locator('[name=meeting_date]').fill(parts.day);await page.locator('[name=meeting_time]').fill(parts.time);if(fail)await page.evaluate(()=>window.failSmsOnce=true);await page.locator('#appointmentForm button').click();
   if(fail){await page.locator('[data-sms-state=failed]').waitFor();assert.equal(await page.locator('#caseDialog').evaluate(e=>e.open),true);await page.locator('[data-retry-appointment-sms]').click();}
   await page.waitForFunction(()=>!document.querySelector('#caseDialog').open);
  };
  const decide=async(choice,fields={},checks=[])=>{
   await page.locator('#caseStepForm [name=outcome]').selectOption(choice);
   for(const [key,value] of Object.entries(fields))await page.locator('#caseStepForm [name="'+key+'"]').fill(value);
   for(const key of checks)await page.locator('#caseStepForm [name="'+key+'"]').check();
   const n=await page.evaluate(()=>window.rpcCalls.length);await page.locator('#caseStepForm button').click();await page.waitForFunction(n=>window.rpcCalls.length>n,n);await page.waitForFunction(()=>!document.querySelector('#caseStepForm button:disabled'));
  };
  await accept('DRIVE_TO_OWN');await book(true);assert.equal(await page.evaluate(()=>fixtureTables.appointments.length),1);
  await nav('overview');await page.locator('.dashboard-today').waitFor();assert.match(await page.locator('.dashboard-today').innerText(),/Candidate DRIVE_TO_OWN/);await page.screenshot({path:path.join(__dirname,'artifacts/dashboard-today.png'),fullPage:true});
  await page.locator('.dashboard-today [data-open-tab=appointments]').click();await page.locator('#caseStepForm').waitFor();assert.equal(await page.locator('#case-tab-appointments').textContent(),'Décision LOLC');assert.equal(await page.locator('[data-lolc-reference]').evaluate(e=>e.readOnly),true);
  await decide('lolc_approved');await page.getByRole('heading',{name:'Identification du véhicule',exact:true}).waitFor();assert.equal(await page.locator('#appointmentForm').count(),0);assert.match(await page.locator('.case-progress').innerText(),/LOLC-TEST-1/);
  await decide('vehicle_selected',{model:'Toyota Vitz',plate:'TEST-123',vin:'VIN-TEST'});await decide('inspection_passed');await decide('inspection_passed');await decide('vehicle_accepted');
  const today=await page.evaluate(()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Kinshasa',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));
  await decide('vehicle_received',{purchase_date:today});await decide('installed',{tracker_id:'TRK-TEST'});await decide('handed_over',{handover_date:today},['paperwork','yango']);await page.getByRole('button',{name:'Activer le contrat signé'}).waitFor();assert.equal(await page.evaluate(()=>fixtureTables.appointments.length),1);await close();
  for(const program of ['PARTNER_DRIVER','FLEET_OWNER','YANGO']){
   await accept(program);await book();await open(program);
   if(program==='PARTNER_DRIVER'){await decide('interview_passed');await decide('driving_test_passed');await decide('training_completed');await page.getByRole('button',{name:'Ouvrir les contrats et affectations'}).waitFor();}
   if(program==='YANGO'){await decide('invitation_explained');await decide('yango_joined');await page.getByRole('heading',{name:'Rattachement Yango confirmé'}).waitFor();}
   if(program==='FLEET_OWNER'){
    await decide('repairs_required',{notes:'Brake repairs needed'});assert.match(await page.locator('#case-tab-appointments').textContent(),/réparations/);
    await decide('inspection_passed',{},['roadworthy','carte_rose','insurance','transport_authorization','vignette','technical_control']);await decide('installed',{tracker_id:'TRK-OWNER',dashcam_id:'CAM-OWNER'});
    await page.locator('#ownerFleetForm').waitFor();for(const [key,value] of Object.entries({model:'Toyota IST',plate:'OWNER-123',vin:'VIN-OWNER',tracker_id:'TRK-OWNER',fuel_reference:'FUEL-TEST',fuel_paid_on:today}))await page.locator('#ownerFleetForm [name="'+key+'"]').fill(value);await page.locator('#ownerFleetForm input[type=checkbox]').check();await page.locator('#ownerFleetForm button').click();await page.waitForFunction(()=>fixtureTables.vehicles.length===1);
   }
   await close();
  }
  await page.setViewportSize({width:390,height:844});await nav('overview');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.evaluate(()=>{const a=fixtureTables.applications[0];a.process_step='equipment';a.workflow_stage='preparation';});await open('DRIVE_TO_OWN');await page.screenshot({path:path.join(__dirname,'artifacts/decision-mobile.png'),fullPage:true});assert.ok(await page.locator('#caseDialog').evaluate(e=>e.scrollWidth<=e.clientWidth));
  await page.locator('#case-tab-history').click();await page.locator('[data-activity-tab=journal]').click();assert.match(await page.locator('#case-journal-log').innerText(),/Équipe de test/);assert.doesNotMatch(await page.locator('#case-journal-log').innerText(),/request id/);
  assert.deepEqual(errors,[]);console.log('PASS browser: 3-field booking, failed-SMS retry without duplicate, automatic close, today dashboard treatment, read-only reference, every decision stage and programme, owner intake, journal and mobile.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
