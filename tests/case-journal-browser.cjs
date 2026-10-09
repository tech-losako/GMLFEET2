const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const fixture='function fixture(){'+fs.readFileSync(path.join(__dirname,'finance-browser.cjs'),'utf8').split('function fixture(){')[1].split('\n(async()=>')[0];
const seed=()=>{
 const t=window.fixtureTables,current=t.staff_members[0].user_id,former='22222222-2222-2222-2222-222222222222',archived='33333333-3333-3333-3333-333333333333';
 Object.assign(t.staff_members[0],{display_name:'Aline Mbala',role:'agent'});
 t.staff_members.push({user_id:former,display_name:'Jean Kabeya',role:'agent',active:false},{user_id:archived,display_name:'Mireille Kanku',role:'admin',active:false,deleted_at:'2026-10-07T08:00:00Z'});
 t.equipment_quotes=[];
 const base={...t.applications[0],lifecycle_version:2,review_status:'pending',process_step:'review',assigned_to:current,preparation:{},service_details:{}};
 t.applications=[{...base,id:1,name:'Dossier journal',program_type:'DRIVE_TO_OWN'},{...base,id:2,name:'Dossier refuse',review_status:'rejected',workflow_stage:'rejected',program_type:'YANGO'},...['DRIVE_TO_OWN','PARTNER_DRIVER','FLEET_OWNER','YANGO'].map((program_type,i)=>({...base,id:i+3,name:'Suivi '+program_type,review_status:'accepted',process_step:'appointment',program_type}))];
 t.admin_notes=[{id:'n1',application_id:1,created_by:former,created_at:'2026-10-05T08:00:00Z',body:'Ancien agent : permis manquant.'},{id:'n2',application_id:1,created_by:archived,created_at:'2026-10-06T08:00:00Z',body:'Compte archive : entretien effectue.'},{id:'n3',application_id:1,created_by:current,created_at:'2026-10-07T08:00:00Z',body:'Texte <img src=x onerror=alert(1)> reste du texte.'}];
 let id=0;
 const log=(entity,actor_id,day,before,after)=>t.audit_logs.push({id:++id,application_id:1,entity,actor_id,action:before?'UPDATE':'INSERT',created_at:`2026-10-${day}T08:00:00Z`,changes:before?{before,after}:{after}});
 log('applications',null,'01',null,{...base,name:'Dossier journal',assigned_to:null});
 log('applications',former,'02',{assigned_to:null},{assigned_to:former});
 log('applications',archived,'03',{assigned_to:former},{assigned_to:current});
 log('applications',former,'04',{program_type:'DRIVE_TO_OWN',process_step:'account',next_action:'Appeler',follow_up_on:'2026-10-03',preparation:{account_opened:false}},{program_type:'DRIVE_TO_OWN',process_step:'sourcing',next_action:null,follow_up_on:null,preparation:{account_opened:true}});
 log('documents',archived,'05',{name:'permis.pdf',review_status:'pending',review_reason:null},{name:'permis.pdf',review_status:'rejected',review_reason:'Document illisible'});
 log('documents',current,'06',null,{name:'permis-net.pdf',category:'license',review_status:'pending',replaces_document_id:'original',replacement_note:'Copie lisible'});
 log('appointments',current,'07',{purpose:'account',status:'scheduled',starts_at:'2026-10-07T08:00:00Z',assigned_to:former},{purpose:'account',status:'completed',starts_at:'2026-10-07T08:00:00Z',assigned_to:former,outcome:'lolc_approved',outcome_notes:'Accord confirme',result:{lolc_reference:'LOLC-42'}});
 log('admin_notes',former,'08',null,{body:'Le candidat a depose ses pieces.',created_by:former});
 for(let i=0;i<65;i++)t.audit_logs.push({id:++id,application_id:1,entity:'applications',actor_id:current,action:'UPDATE',created_at:'2026-10-09T08:00:00Z',changes:{before:{next_action:'Etape '+i},after:{next_action:'Etape '+(i+1)}}});
 const original=window.supabase.createClient;
 window.supabase.createClient=(...args)=>{
  const client=original(...args),from=client.from;
  client.from=table=>{
   const q=from(table),insert=q.insert.bind(q);
   q.insert=payload=>{
    if(table==='admin_notes'&&window.rejectNoteOnce){window.rejectNoteOnce=false;return {then:resolve=>Promise.resolve(resolve({error:{message:'Connexion interrompue'}}))};}
    if(table==='admin_notes')log('admin_notes',current,'09',null,{...payload,created_by:current});
    return insert(table==='admin_notes'?{...payload,created_at:'2026-10-09T08:01:00Z'}:payload);
   };
   return q;
  };
  return client;
 };
};
(async()=>{
 const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/vendor/supabase-2.57.4.js',route=>route.fulfill({contentType:'text/javascript',body:`(${fixture})();(${seed.toString()})();`}));
  await page.route('**/supabase.co/**',route=>route.abort());
  const base=process.env.CASE_JOURNAL_BASE_URL||`http://127.0.0.1:${server.address().port}`;
  await page.goto(base+'/admin.html');await page.locator('#workspace').waitFor();
  await page.locator('nav [data-view=applications]').click();
  await page.getByRole('button',{name:'Dossier journal',exact:true}).click();await page.locator('#case-tab-history').click();
  const decisionLast=async()=>assert.equal(await page.locator('.case-tabs > button').last().getAttribute('id'),'case-tab-decision');
  await decisionLast();
  assert.equal(await page.locator('#usersNav').isVisible(),false);
  assert.equal(await page.locator('#case-activity-notes').isVisible(),true);
  assert.equal(await page.locator('#case-activity-journal').isVisible(),false);
  assert.match(await page.locator('.case-note-list').innerText(),/Jean Kabeya[\s\S]*Compte d\u00e9sactiv\u00e9/);
  assert.match(await page.locator('.case-note-list').innerText(),/Mireille Kanku[\s\S]*Ancien compte/);
  assert.equal(await page.locator('.case-note-list img').count(),0,'note content escaped');
  await page.locator('#noteForm textarea').fill('   ');await page.locator('#noteForm button').click();
  await page.getByText('La note ne peut pas \u00eatre vide.',{exact:true}).waitFor();
  await page.evaluate(()=>{window.rejectNoteOnce=true;});
  await page.locator('#noteForm textarea').fill('Appel termine, documents recus.');await page.locator('#noteForm button').click();
  await page.getByText('Connexion interrompue',{exact:true}).waitFor();
  assert.equal(await page.locator('#noteForm textarea').inputValue(),'Appel termine, documents recus.');
  await page.locator('#case-activity-tab-journal').click();assert.equal(await page.locator('#noteForm').isVisible(),false);
  assert.equal(await page.locator('.case-journal-entry').count(),30);
  await page.locator('.case-journal-more').click();assert.equal(await page.locator('.case-journal-entry').count(),60);
  await page.locator('.case-journal-more').click();assert.equal(await page.locator('.case-journal-entry').count(),73,'older audit events are not dropped');
  await page.locator('#case-journal-query').fill('responsable');
  assert.match(await page.locator('#case-journal-log').innerText(),/Jean Kabeya[\s\S]*Aline Mbala/);
  await page.locator('#case-journal-query').fill('');await page.locator('#case-journal-kind').selectOption('documents');
  assert.equal(await page.locator('.case-journal-entry').count(),2);
  assert.match(await page.locator('#case-journal-log').innerText(),/Document remplac\u00e9[\s\S]*Document refus\u00e9[\s\S]*Document illisible/);
  await page.locator('#case-journal-actor').selectOption('33333333-3333-3333-3333-333333333333');assert.equal(await page.locator('.case-journal-entry').count(),1);
  await page.locator('#case-journal-kind').selectOption('all');await page.locator('#case-journal-actor').selectOption('all');
  await page.locator('#case-journal-query').fill('relance');
  const changeEntry=page.locator('.case-journal-entry');assert.equal(await changeEntry.count(),1);
  await changeEntry.locator('summary').click();
  assert.match(await changeEntry.innerText(),/Compte ouvert[\s\S]*\u00c9ligible/);
  assert.match(await changeEntry.innerText(),/Non renseign\u00e9/);
  assert.match(await changeEntry.innerText(),/Compte ouvert lors du rendez-vous[\s\S]*Non[\s\S]*Oui/);
  await page.locator('#case-journal-query').fill('');await page.locator('#case-journal-order').selectOption('asc');
  assert.match(await page.locator('.case-journal-entry').first().innerText(),/Candidature re\u00e7ue[\s\S]*Candidat \/ site web/);
  await page.locator('#case-tab-documents').click();await page.locator('#case-tab-history').click();
  assert.equal(await page.locator('#case-activity-journal').isVisible(),true,'main tabs preserve nested panel state');
  assert.equal(await page.locator('#case-activity-notes').isVisible(),false);
  await page.screenshot({path:path.join(__dirname,'artifacts/case-journal-desktop.png'),fullPage:true});
  await page.locator('#case-activity-tab-journal').focus();await page.keyboard.press('ArrowLeft');
  assert.equal(await page.locator('#case-activity-notes').isVisible(),true);
  assert.equal(await page.locator('#noteForm textarea').inputValue(),'Appel termine, documents recus.','draft survives sub-tab switching');
  await page.locator('#noteForm button').click();await page.getByText('Note enregistr\u00e9e.',{exact:true}).waitFor();
  assert.equal(await page.locator('#noteForm textarea').inputValue(),'');
  assert.match(await page.locator('.case-note-list').innerText(),/Aline Mbala[\s\S]*Appel termine/);
  await page.screenshot({path:path.join(__dirname,'artifacts/case-notes-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(__dirname,'artifacts/case-notes-mobile.png'),fullPage:true});
  assert.ok(await page.locator('#caseDialog').evaluate(el=>el.scrollWidth<=el.clientWidth),'notes fit mobile');
  await page.locator('#case-activity-tab-journal').click();await page.locator('#case-journal-kind').selectOption('documents');
  await page.screenshot({path:path.join(__dirname,'artifacts/case-journal-mobile.png'),fullPage:true});
  assert.ok(await page.locator('#caseDialog').evaluate(el=>el.scrollWidth<=el.clientWidth),'journal fits mobile');
  assert.ok(await page.locator('#case-activity-journal').evaluate(el=>el.scrollWidth<=el.clientWidth),'journal controls fit mobile');
  await page.locator('[data-close=caseDialog]').click();await page.setViewportSize({width:1440,height:1000});
  await page.locator('[data-queue=all]').click();
  for(const name of ['Dossier refuse',...['DRIVE_TO_OWN','PARTNER_DRIVER','FLEET_OWNER','YANGO'].map(program=>'Suivi '+program)]){
   await page.getByRole('button',{name,exact:true}).click();await page.locator('#case-tab-history').waitFor();await decisionLast();
   await page.locator('#case-tab-history').click();assert.equal(await page.locator('#case-activity-notes').isVisible(),true,'new dossier resets sub-tab');
   await page.locator('#case-activity-tab-journal').click();assert.match(await page.locator('#case-journal-log').innerText(),/Aucune activit\u00e9 enregistr\u00e9e/);
   await page.locator('[data-close=caseDialog]').click();
  }
  assert.deepEqual(errors,[]);console.log('PASS case journal: decision last, active/former/archived authors, named audit changes, full history pagination, filters, sort, nested keyboard tabs, note validation/retry and mobile layout.');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
