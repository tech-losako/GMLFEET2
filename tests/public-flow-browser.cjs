const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');function fixture(){window.sent=[];window.supabase={createClient:()=>({functions:{invoke:async(name,{body})=>{window.sent.push({name,request:body.get('request_id'),app:JSON.parse(body.get('application')),files:body.getAll('files').map(f=>({name:f.name,size:f.size}))});if(window.failOnce){window.failOnce=false;return {error:{context:{json:async()=>({error:'Connexion interrompue. Réessayez.'})}}};}return {data:{success:true}};}}})};}
(async()=>{const server=http.createServer((req,res)=>{try{const file=path.join(root,decodeURIComponent(new URL(req.url,'http://local').pathname));res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const b=await chromium.launch({headless:true,channel:'msedge'});try{const page=await b.newPage({viewport:{width:390,height:844}}),base='http://127.0.0.1:'+server.address().port,errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/vendor/supabase-2.57.4.js',r=>r.fulfill({contentType:'text/javascript',body:'('+fixture.toString()+')();'}));await page.route('**/*supabase.co/**',r=>r.abort());

for(const width of [390,1440]){
 await page.setViewportSize({width,height:900});
 for(const name of ['vehicule-credit','recrutement-chauffeurs','agregateur-yango','gestion-flotte']){
  await page.goto(base+'/'+name+'.html',{waitUntil:'domcontentloaded'});await page.locator('.pub-header').waitFor();
  assert.equal(await page.locator('.pub-section-nav').count(),0);assert.equal(await page.locator('.service-story:visible').count(),1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:path.join(root,`tests/artifacts/flow-${name}-landing-${width}.png`),fullPage:true,timeout:15000});
  await page.locator('#pub-start').click();assert.ok(page.url().endsWith('#candidature'));assert.equal(await page.locator('.pub-hero:visible').count(),0);
  assert.equal(await page.locator('.application-heading h1:visible').count(),1);assert.ok(await page.locator('.application-heading h1').evaluate(e=>e.getBoundingClientRect().top<300));
  assert.equal(await page.locator('.service-story:visible').count(),0);
  if(name==='vehicule-credit'){
   assert.equal(await page.locator('.vehicle-options button').count(),4);assert.equal(await page.locator('.vehicle-next').isDisabled(),true);
   assert.equal(await page.locator('#noCarSelectedWarning').count(),0);
   await page.screenshot({path:path.join(root,`tests/artifacts/flow-choose-${width}.png`),fullPage:true,timeout:15000});
   await page.locator('[data-vehicle="Swift"]').click();assert.equal(await page.locator('#generalVehicleSelect').inputValue(),'Swift');assert.match(await page.locator('#modalValJour').innerText(),/29,5/);
   await page.locator('.vehicle-next').click();await page.locator('#clientName').fill('Saved Candidate');
   await page.locator('.application-heading .application-back').click();assert.equal(await page.locator('.pub-hero:visible').count(),1);
   await page.locator('#pub-start').click();assert.equal(await page.locator('#clientName').inputValue(),'Saved Candidate');
   await page.screenshot({path:path.join(root,`tests/artifacts/flow-dossier-${width}.png`),fullPage:true,timeout:15000});
  }
  await page.goBack();assert.equal(await page.locator('.pub-hero:visible').count(),1);await page.goForward();assert.equal(await page.locator('.application-heading h1:visible').count(),1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }
}
await page.goto(base+'/vehicule-credit.html#candidature',{waitUntil:'domcontentloaded'});await page.locator('.application-heading h1').waitFor();assert.equal(await page.locator('.pub-hero:visible').count(),0);
assert.deepEqual(errors,[]);console.log('PASS focused applications, vehicle choice, preserved inputs, direct candidature links, browser back/forward and mobile/desktop layouts.');
}finally{await b.close();server.close();}})().catch(e=>{console.error(e);process.exit(1)});
