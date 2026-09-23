const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
function fixture(){
 const staff={user_id:'11111111-1111-1111-1111-111111111111',display_name:'Équipe de test',active:true};
 const base={phone:'+243000000000',source:'website',created_at:'2026-09-16T08:00:00Z',created_on:'2026-09-16',workflow_stage:'new',lolc_status:'not_submitted',revision:1,preparation:{},service_details:{},status:'En attente'};
 const tables={staff_members:[staff],applications:[{...base,id:1,name:'Patrick Test',program_type:'DRIVE_TO_OWN',vehicle:'Toyota Vitz',address:'Gombe'},{...base,id:2,name:'<img src=x onerror=alert(1)>',program_type:'YANGO',service:'Chauffeur Yango',vehicle:'Toyota IST',service_details:{carPlate:'TEST-123'}}],appointments:[],admin_notes:[],documents:[],audit_logs:[]};
 Object.assign(tables,{contracts:[],drivers:[],vehicles:[],repayment_schedules:[],payments:[],payment_allocations:[],lolc_deposit_items:[],araka_attempts:[]});window.fixtureTables=tables;
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
 window.supabase={createClient:()=>({from:t=>new Query(t),auth:{getUser:async()=>({data:{user:{id:staff.user_id}}}),getSession:async()=>({data:{session:{user:{id:staff.user_id}}}}),onAuthStateChange:()=>{},signOut:async()=>{}},storage:{from:()=>({upload:async()=>({data:{},error:null}),remove:async()=>({data:{},error:null}),createSignedUrl:async path=>({data:{signedUrl:path.endsWith('.png')?'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=':'about:blank'},error:null})})}})};
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
  await page.locator('#workflowForm').waitFor();
  await page.locator('#workflowForm [name="next_action"]').fill('Appeler pour les pièces LOLC');
  await page.getByRole('button',{name:'Enregistrer le suivi'}).click();
  await page.waitForFunction(()=>window.fixtureTables.applications[0].next_action==='Appeler pour les pièces LOLC');
  await page.locator('#noteForm textarea').fill('Le candidat apportera son permis.');
  await page.getByRole('button',{name:'Ajouter la note'}).click();
  await page.waitForFunction(()=>window.fixtureTables.admin_notes.length===1);
  await page.locator('summary').click();
  await page.locator('[name="starts_at"]').fill('2026-09-18T10:30');
  await page.locator('[name="location"]').fill('Bureau GML, Gombe');
  await page.locator('[name="briefing_confirmed"]').check();
  await page.getByRole('button',{name:'Programmer',exact:true}).click();
  await page.waitForFunction(()=>window.fixtureTables.appointments.length===1);
  assert.equal(await page.evaluate(()=>window.fixtureTables.appointments[0].starts_at),'2026-09-18T09:30:00.000Z');
  await page.locator('#documentForm input').setInputFiles({name:'permis.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 test')});
  await page.getByRole('button',{name:'Téléverser',exact:true}).click();
  await page.waitForFunction(()=>window.fixtureTables.documents.length===1);
  await page.locator('#documentForm input').setInputFiles({name:'photo.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=','base64')});
  await page.locator('#documentForm button').click();
  await page.waitForFunction(()=>document.querySelector('.document-preview img')?.naturalWidth===1);
  await page.locator('#caseDialog').screenshot({path:path.join(__dirname,'document-preview.png')});
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
  await page.locator('nav [data-view="appointments"]').click();await page.getByRole('button',{name:'＋ Programmer un rendez-vous',exact:true}).click();await page.locator('#chooseAppointmentForm button').click();await page.locator('#appointmentForm [name="starts_at"]').waitFor();assert.equal(await page.locator('#intake').evaluate(e=>e.open),false);await page.locator('[data-close="caseDialog"]').click();
  await page.setViewportSize({width:390,height:844});
  await page.locator('nav [data-view="overview"]').click();
  await page.screenshot({path:path.join(__dirname,'dashboard-mobile.png'),fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.addInitScript(()=>window.fixtureDenied=true);
  await page.reload();
  await page.getByRole('heading',{name:'Accès réservé au personnel'}).waitFor();
  assert.deepEqual(errors,[]);
  console.log('PASS: desktop/mobile, search, safe rendering, case update, notes, appointment timezone, document upload, walk-in intake, denied staff access.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
