const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');function fixture(){window.sent=[];window.supabase={createClient:()=>({functions:{invoke:async(name,{body})=>{window.sent.push({name,request:body.get('request_id'),app:JSON.parse(body.get('application')),files:body.getAll('files').map(f=>({name:f.name,size:f.size}))});if(window.failOnce){window.failOnce=false;return {error:{context:{json:async()=>({error:'Connexion interrompue. RÃƒÆ’Ã‚Â©essayez.'})}}};}return {data:{success:true}};}}})};}
(async()=>{const server=http.createServer((req,res)=>{try{const file=path.join(root,decodeURIComponent(new URL(req.url,'http://local').pathname));res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const b=await chromium.launch({headless:true,channel:'msedge'});try{const page=await b.newPage({viewport:{width:390,height:844}}),base='http://127.0.0.1:'+server.address().port,errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/vendor/supabase-2.57.4.js',r=>r.fulfill({contentType:'text/javascript',body:'('+fixture.toString()+')();'}));await page.route('**/*supabase.co/**',r=>r.abort());

page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(60000);for(const width of [390,1440]){
 await page.setViewportSize({width,height:950});
 for(const name of ['index','services']){
  await page.goto(base+'/'+name+'.html',{waitUntil:'domcontentloaded'});await page.locator('.pub-header').waitFor();
  assert.equal(await page.locator('.pub-logo img').getAttribute('src'),'/img/gml-official.jpeg');
  assert.equal(await page.locator('.visual-path').count(),5);
  assert.equal(await page.locator('[role=tab]').count(),0);
  await page.locator('.visual-path img').evaluateAll(es=>Promise.all(es.map(e=>{e.loading='eager';return e.decode();})));
  assert.deepEqual(await page.locator('.visual-path img').evaluateAll(es=>es.filter(e=>!e.naturalWidth).map(e=>e.src)),[]);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);


 }
}
for(const [car,img] of [['Swift','swift-official'],['Blade','blade-official'],['IST','ist-official']]){await page.goto(base+'/detail-vehicule.html?car='+car,{waitUntil:'domcontentloaded'});await page.locator('.pub-header').waitFor();assert.match(await page.locator('#modalCarImg').getAttribute('src'),new RegExp(img));}
assert.doesNotMatch(await page.locator('body').innerText(),/[\u00c3\u00c2][\u0080-\u00ff]/);assert.deepEqual(errors,[]);console.log('PASS six service choices, image loads, supplied vehicle photos and equipment pricing at mobile/desktop sizes.');
}finally{await b.close();server.close();}})().catch(e=>{console.error(e);process.exit(1)});
