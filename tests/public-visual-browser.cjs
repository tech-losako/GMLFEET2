const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');function fixture(){window.sent=[];window.supabase={createClient:()=>({functions:{invoke:async(name,{body})=>{window.sent.push({name,request:body.get('request_id'),app:JSON.parse(body.get('application')),files:body.getAll('files').map(f=>({name:f.name,size:f.size}))});if(window.failOnce){window.failOnce=false;return {error:{context:{json:async()=>({error:'Connexion interrompue. RÃƒÆ’Ã‚Â©essayez.'})}}};}return {data:{success:true}};}}})};}
(async()=>{const server=http.createServer((req,res)=>{try{const file=path.join(root,decodeURIComponent(new URL(req.url,'http://local').pathname));res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const b=await chromium.launch({headless:true,channel:'msedge'});try{const page=await b.newPage({viewport:{width:390,height:844}}),base='http://127.0.0.1:'+server.address().port,errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/vendor/supabase-2.57.4.js',r=>r.fulfill({contentType:'text/javascript',body:'('+fixture.toString()+')();'}));await page.route('**/*supabase.co/**',r=>r.abort());

page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(60000);for(const width of [390,1440]){
 await page.setViewportSize({width,height:950});
 for(const name of ['index','services']){
  await page.goto(base+'/'+name+'.html',{waitUntil:'domcontentloaded'});await page.locator('.pub-header').waitFor();
  assert.equal(await page.locator('.pub-logo img').getAttribute('src'),'/img/gml-official.jpeg');
  assert.doesNotMatch(await page.locator('body').textContent(),/[\u00c3\u00c2][\u0080-\u00ff]/);const count=await page.locator('.pub-section-nav button').count();
  for(let i=0;i<count;i++){console.log('Checking',name,width,i);
   if(width<760)await page.locator('.pub-section-select select').selectOption(String(i));else await page.locator('.pub-section-nav button').nth(i).click();
   await page.locator('.pub-panel:visible img').evaluateAll(es=>Promise.all(es.map(e=>{e.loading='eager';return e.decode().catch(()=>{});})));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name+' '+i+' '+width+' '+JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>({tag:e.tagName,cls:e.className,width:e.getBoundingClientRect().width})).slice(0,8))));
   assert.deepEqual(await page.locator('.pub-panel:visible img').evaluateAll(es=>es.filter(e=>!e.naturalWidth).map(e=>e.src)),[]);
   await page.screenshot({timeout:20000,path:path.join(root,`tests/artifacts/visual-${name}-${i}-${width}.png`),fullPage:true});
  }
  if(name==='services'){
   assert.equal(await page.locator('.pub-hero-actions a[href="/services.html"]').count(),0);
   if(width<760)await page.locator('.pub-section-select select').selectOption('1');else await page.getByRole('tab',{name:'Votre parcours',exact:true}).click();
   const destinations=['vehicule-credit.html','recrutement-chauffeurs.html','gestion-flotte.html','agregateur-yango.html'];
   for(let i=0;i<4;i++){await page.locator('[data-journey]').nth(i).click();assert.equal(await page.locator('.profile-result a').getAttribute('href'),'/'+destinations[i]);assert.equal(await page.locator('[data-journey][aria-pressed=true]').count(),1);}
   assert.equal(await page.locator('.offer-card').count(),4);assert.equal(await page.locator('.equipment-card').count(),2);
   assert.match(await page.locator('.offer-grid').textContent(),/500 USD\/mois/);assert.match(await page.locator('.offer-grid').textContent(),/12 mois/);
   if(width<760){await page.locator('.pub-section-select select').selectOption('3');await page.locator('[data-equipment="1"]').click();assert.equal(await page.locator('.equipment-card:visible').count(),1);assert.match(await page.locator('.equipment-card:visible h3').textContent(),/bord/);}
   assert.equal(await page.locator('.equipment-price').count(),2);for(const item of await page.locator('.equipment-price').all())assert.match(await item.textContent(),/mensuel \/ annuel/);
  }
 }
}
for(const [car,img] of [['Swift','swift-official'],['Blade','blade-official'],['IST','ist-official']]){await page.goto(base+'/detail-vehicule.html?car='+car,{waitUntil:'domcontentloaded'});await page.locator('.pub-header').waitFor();assert.match(await page.locator('#modalCarImg').getAttribute('src'),new RegExp(img));}
assert.doesNotMatch(await page.locator('body').innerText(),/[\u00c3\u00c2][\u0080-\u00ff]/);assert.deepEqual(errors,[]);console.log('PASS visual tabs at mobile/desktop sizes, image loads, all four journey choices, supplied vehicle photos, equipment pricing and offer terms.');
}finally{await b.close();server.close();}})().catch(e=>{console.error(e);process.exit(1)});
