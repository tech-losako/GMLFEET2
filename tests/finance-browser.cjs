const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
function fixture(){
 const staff={user_id:'11111111-1111-1111-1111-111111111111',display_name:'Équipe de test',active:true};
 const base={phone:'+243000000000',source:'website',created_at:'2026-09-16T08:00:00Z',created_on:'2026-09-16',workflow_stage:'new',lolc_status:'not_submitted',revision:1,preparation:{},service_details:{},status:'En attente'};
 const tables={staff_members:[staff],applications:[{...base,id:1,name:'Patrick Test',program_type:'DRIVE_TO_OWN',vehicle:'Toyota Vitz',address:'Gombe'},{...base,id:2,name:'<img src=x onerror=alert(1)>',program_type:'YANGO',service:'Chauffeur Yango',vehicle:'Toyota IST',service_details:{carPlate:'TEST-123'}}],appointments:[],admin_notes:[],documents:[],audit_logs:[],operations_notifications:[]};
 window.fixtureTables=tables;
 class Query{
  constructor(table){this.table=table;this.filters=[];this.mode='read';this.offset=0;this.end=999;}
  select(){return this;}eq(k,v){this.filters.push(r=>r[k]===v);return this;}order(){return this;}range(a,b){this.offset=a;this.end=b;return this;}single(){this.one=true;return this;}maybeSingle(){this.one=true;return this;}
  insert(payload){this.mode='insert';this.payload=payload;return this;}update(payload){this.mode='update';this.payload=payload;return this;}
  then(resolve,reject){return Promise.resolve().then(()=>{
   if(window.fixtureDenied&&this.table==='staff_members')return {data:null,error:null};
   let items=tables[this.table].filter(r=>this.filters.every(f=>f(r)));
   if(this.mode==='insert'){
    const r={...base,...this.payload,id:this.table==='applications'?tables.applications.length+1:crypto.randomUUID(),created_by:staff.user_id};
    if(this.table==='applications')r.program_type=r.service==='Chauffeur Yango'?'YANGO':r.service==='Gestion de flotte'?'FLEET_OWNER':r.service==='Recrutement Chauffeur'?'PARTNER_DRIVER':'DRIVE_TO_OWN';
    tables[this.table].push(r);items=[r];
   }
   if(this.mode==='update')items.forEach(r=>Object.assign(r,this.payload,{revision:r.revision+1}));
   return {data:this.one?(items[0]||null):items.slice(this.offset,this.end+1),error:null};
  }).then(resolve,reject);}
 }
 Object.assign(tables,{contracts:[],drivers:[],vehicles:[],repayment_schedules:[],payments:[],payment_allocations:[],lolc_deposits:[],lolc_deposit_items:[],finance_events:[],araka_attempts:[]});
 staff.role='admin';window.rpcCalls=[];
 async function financeRpc(name,{p}){
  window.rpcCalls.push({name,p:JSON.parse(JSON.stringify(p))});
  if(window.rejectPaymentOnce&&name==='confirm_cash_payment'){window.rejectPaymentOnce=false;return {error:{message:'Test : connexion interrompue, réessayez.'}};}
  if(name==='activate_contract'){
   const id=crypto.randomUUID(),driverId=crypto.randomUUID(),a=tables.applications.find(a=>a.id===p.application_id);
   tables.drivers.push({id:driverId,full_name:a.name,phone:a.phone});
   tables.vehicles.push({id:1,model:p.model,plate:p.plate,vin:p.vin,tracker_id:p.tracker_id});
   tables.contracts.push({...p,id,driver_id:driverId,vehicle_id:1,status:'active',contract_type:a.program_type});
   tables.repayment_schedules.push({id:1,contract_id:id,due_on:p.first_payment_date,lolc_due:p.daily_lolc,gml_due:p.daily_gml});
   return {data:id,error:null};
  }
  if(name==='confirm_cash_payment'){
   const c=tables.contracts.find(c=>c.id===p.contract_id),id=tables.payments.length+1,lolc_amount=Number(p.amount)*.8;
   tables.payments.push({...p,id,entry_kind:'payment',driver_name:'Patrick Test',recorded_by:staff.user_id,created_at:new Date().toISOString(),lolc_amount});
   tables.payment_allocations.push({payment_id:id,schedule_id:1,amount:p.amount,lolc_amount});
   return {data:id,error:null};
  }
  if(name==='reverse_cash_payment'){
   const original=tables.payments.find(r=>r.id===p.payment_id),id=tables.payments.length+1;
   tables.payments.push({...original,...p,id,entry_kind:'reversal',reverses_payment_id:original.id,reference:'ANN-'+original.id});
   tables.payment_allocations.push({payment_id:id,schedule_id:1,amount:-Number(original.amount),lolc_amount:-original.lolc_amount});
   return {data:id,error:null};
  }
  if(name==='record_lolc_deposit'){
   const id=crypto.randomUUID();tables.lolc_deposits.push({...p,id,recorded_by:staff.user_id});
   p.payment_ids.forEach(payment_id=>tables.lolc_deposit_items.push({deposit_id:id,payment_id,amount:tables.payments.find(r=>r.id===payment_id).lolc_amount}));
   return {data:id,error:null};
  }
  return {error:{message:'Unknown test RPC'}};
 }

 window.supabase={createClient:()=>({from:t=>new Query(t),rpc:financeRpc,auth:{getUser:async()=>({data:{user:{id:staff.user_id}}}),getSession:async()=>({data:{session:{user:{id:staff.user_id}}}}),onAuthStateChange:()=>{},signOut:async()=>{}},storage:{from:()=>({upload:async()=>({data:{},error:null}),remove:async()=>({data:{},error:null}),createSignedUrl:async()=>({data:{signedUrl:'about:blank'},error:null})})}})};
}
(async()=>{
 const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const file=path.join(root,pathname==='/admin'?'admin.html':pathname);
  if(!file.startsWith(root.replaceAll('/',path.sep))&&!file.startsWith(root)){res.writeHead(403);return res.end();}
  try{const body=fs.readFileSync(file);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(body);}catch{res.writeHead(404);res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL || 'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/vendor/supabase-2.57.4.js',r=>r.fulfill({contentType:'text/javascript',body:`(${fixture.toString()})();`}));
  await page.goto(`http://127.0.0.1:${server.address().port}/admin`);
  await page.locator('#workspace').waitFor({state:'visible'});
  await page.screenshot({path:path.join(__dirname,'dashboard-desktop.png'),fullPage:true});
  await page.getByRole('button',{name:/Candidatures/}).click();
  await page.locator('#search').fill('Patrick');
  assert.equal(await page.locator('tbody tr').count(),1);
  await page.getByRole('button',{name:'Patrick Test',exact:true}).click();
  await page.locator('#reviewForm button').click();
  await page.waitForFunction(()=>window.fixtureTables.applications[0].review_status==='accepted');
  await page.locator('#case-tab-process').click();
  await page.locator('#workflowForm').waitFor();
  await page.locator('#workflowForm [name="next_action"]').fill('Appeler pour les pièces LOLC');
  await page.getByRole('button',{name:'Enregistrer le suivi'}).click();
  await page.waitForFunction(()=>window.fixtureTables.applications[0].next_action==='Appeler pour les pièces LOLC');
  await page.locator('#case-tab-history').click();
  await page.locator('#noteForm textarea').fill('Le candidat apportera son permis.');
  await page.getByRole('button',{name:'Ajouter la note'}).click();
  await page.waitForFunction(()=>window.fixtureTables.admin_notes.length===1);
  await page.locator('#case-tab-appointments').click();
  await page.locator('summary').click();
  await page.locator('[name="starts_at"]').fill('2026-09-18T10:30');
  await page.locator('[name="location"]').fill('Bureau GML, Gombe');
  await page.locator('[name="briefing_confirmed"]').check();
  await page.getByRole('button',{name:'Programmer',exact:true}).click();
  await page.waitForFunction(()=>window.fixtureTables.appointments.length===1);
  assert.equal(await page.evaluate(()=>window.fixtureTables.appointments[0].starts_at),'2026-09-18T09:30:00.000Z');
  await page.locator('#case-tab-documents').click();
  await page.locator('#documentForm input').setInputFiles({name:'permis.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 test')});
  await page.getByRole('button',{name:'Téléverser',exact:true}).click();
  await page.waitForFunction(()=>window.fixtureTables.documents.length===1);
  await page.screenshot({path:path.join(__dirname,'dashboard-case.png'),fullPage:true});
  await page.locator('[data-close="caseDialog"]').click();
  await page.getByRole('button',{name:'＋ Nouvelle candidature'}).click();
  await page.locator('#intakeForm [name="name"]').fill('Walk-in Test');
  await page.locator('#intakeForm [name="phone"]').fill('+243000000001');
  await page.locator('#intakeProgram').selectOption('PARTNER_DRIVER');
  await page.getByRole('button',{name:'Créer le dossier'}).click();
  await page.waitForFunction(()=>window.fixtureTables.applications.length===3);
  assert.equal(await page.evaluate(()=>window.fixtureTables.applications[2].source),'office');
  await page.locator('[data-close="caseDialog"]').click();
  await page.locator('#search').fill('');
  assert.equal(await page.locator('tbody img').count(),0,'Escaped applicant names must not create HTML');
  await page.setViewportSize({width:390,height:844});
  await page.locator('nav [data-view="overview"]').click();
  await page.screenshot({path:path.join(__dirname,'dashboard-mobile.png'),fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.evaluate(()=>{Object.assign(window.fixtureTables.applications[0],{workflow_stage:'handed_over',lolc_status:'approved'});});
  await page.locator('#refresh').click();
  await page.locator('nav').getByRole('button',{name:/Contrats & véhicules/}).click();
  await page.getByRole('button',{name:'＋ Activer un contrat'}).click();
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Kinshasa',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  for(const [k,v] of Object.entries({signed_reference:'UI-CONTRACT-01',model:'Toyota Vitz',plate:'UI 001',vin:'UI-VIN-001',tracker_id:'UI-TRACK-001',end_date:day,daily_lolc:'20',daily_gml:'5'}))await page.locator('#activateForm [name="'+k+'"]').fill(v);
  await page.locator('#activateForm [name="operating_days"]').check({force:true}).catch(async()=>{for(const box of await page.locator('#activateForm [name="operating_days"]').all())await box.check();});
  await page.locator('#activateForm input[type="checkbox"][required]').check();
  await page.getByRole('button',{name:'Activer le contrat et générer les échéances'}).click();
  await page.waitForFunction(()=>window.fixtureTables.contracts.length===1);
  assert.equal(await page.evaluate(()=>window.rpcCalls[0].p.daily_lolc),'20');
  assert.equal(await page.evaluate(()=>window.rpcCalls[0].p.daily_gml),'5');
  const exportWait=page.waitForEvent('download');await page.getByRole('button',{name:'Exporter les contrats (CSV)'}).click();const exported=await exportWait;
  assert.match(exported.suggestedFilename(),/^GMFleet-chauffeurs-contrats-.*\.csv$/);const csv=fs.readFileSync(await exported.path(),'utf8');
  assert.equal(csv.charCodeAt(0),0xFEFF);assert.ok(csv.includes('"UI-CONTRACT-01"'));assert.ok(csv.includes('"20.00";"5.00";"25.00"'));assert.ok(csv.includes('"Téléphone"'));assert.equal(csv.trim().split('\r\n').length,2);
  await page.evaluate(()=>{window.fixtureTables.drivers[0].full_name='=1+1;"Test"';});await page.locator('#refresh').click();
  const safeWait=page.waitForEvent('download');await page.getByRole('button',{name:'Exporter les contrats (CSV)'}).click();const safe=fs.readFileSync(await (await safeWait).path(),'utf8');assert.ok(safe.includes(`"'=1+1;""Test"""`));

  await page.getByRole('button',{name:/Caisse \/ versements/}).click();
  await page.getByRole('button',{name:'＋ Enregistrer un versement'}).click();
  await page.locator('#paymentForm [name="amount"]').fill('10');
  await page.locator('#paymentForm [name="method"]').selectOption('M-Pesa');assert.match(await page.locator('#cashFeePreview').innerText(),/10,30/);assert.equal(await page.locator('#receivedTotalLabel').isVisible(),true);
  await page.locator('#paymentForm [name="method"]').selectOption('Espèces');assert.equal(await page.locator('#receivedTotalLabel').isVisible(),false);assert.match(await page.locator('#cashFeePreview').innerText(),/0,00/);
  await page.locator('#paymentForm [name="reference"]').fill('UI-RECEIPT-01');
  await page.locator('#paymentForm [name="reason"]').fill('Paiement au bureau');
  await page.evaluate(()=>window.rejectPaymentOnce=true);
  await page.getByRole('button',{name:'Confirmer l’encaissement'}).click();
  await page.locator('#paymentForm .form-error').filter({hasText:'connexion interrompue'}).waitFor();
  await page.getByRole('button',{name:'Confirmer l’encaissement'}).click();
  await page.waitForFunction(()=>window.fixtureTables.payments.length===1);
  assert.equal(await page.evaluate(()=>window.rpcCalls[1].p.request_id===window.rpcCalls[2].p.request_id),true);
  await page.getByRole('button',{name:'Annuler avec motif'}).click();
  await page.locator('#reverseForm textarea').fill('Correction du reçu');
  await page.getByRole('button',{name:'Confirmer l’annulation'}).click();
  await page.waitForFunction(()=>window.fixtureTables.payments.length===2);
  await page.getByRole('button',{name:'＋ Enregistrer un versement'}).click();
  await page.locator('#paymentForm [name="amount"]').fill('25');
  await page.locator('#paymentForm [name="reference"]').fill('UI-RECEIPT-02');
  await page.locator('#paymentForm [name="reason"]').fill('Versement complet');
  await page.getByRole('button',{name:'Confirmer l’encaissement'}).click();
  await page.waitForFunction(()=>window.fixtureTables.payments.length===3);
  await page.setViewportSize({width:1440,height:1000});
  await page.screenshot({path:path.join(__dirname,'finance-payments.png'),fullPage:true});
  await page.getByRole('button',{name:/Dépôts LOLC/}).click();
  await page.getByRole('button',{name:'＋ Enregistrer le dépôt LOLC'}).click();
  await page.locator('#depositForm [name="period_start"]').fill(day);
  await page.locator('#depositForm [name="period_start"]').dispatchEvent('change');
  await page.locator('#depositForm [name="amount"]').fill('20');
  await page.locator('#depositForm [name="bank_reference"]').fill('UI-BANK-01');
  await page.locator('#depositForm [name="proof"]').setInputFiles({name:'bank.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 test')});
  await page.getByRole('button',{name:'Confirmer le rapprochement'}).click();
  await page.waitForFunction(()=>window.fixtureTables.lolc_deposits.length===1);
  assert.equal(await page.evaluate(()=>window.fixtureTables.lolc_deposit_items.length),1);
  assert.equal(await page.evaluate(()=>window.fixtureTables.payment_allocations.reduce((n,a)=>n+Number(a.amount),0)),25);
  await page.screenshot({path:path.join(__dirname,'finance-deposits.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.join(__dirname,'finance-mobile.png'),fullPage:true});
  console.log('PASS: contract activation, separate LOLC/GML terms, cashier confirmation, stable retry ID, reversal, bank proof, weekly reconciliation, mobile layout.');

  await page.addInitScript(()=>window.fixtureDenied=true);
  await page.reload();
  await page.getByRole('heading',{name:'Accès réservé au personnel'}).waitFor();
  assert.deepEqual(errors,[]);
  console.log('PASS: desktop/mobile, search, safe rendering, case update, notes, appointment timezone, document upload, walk-in intake, denied staff access.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
