const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');function fixture(){window.sent=[];window.supabase={createClient:()=>({functions:{invoke:async(name,{body})=>{window.sent.push({name,request:body.get('request_id'),app:JSON.parse(body.get('application')),files:body.getAll('files').map(f=>({name:f.name,size:f.size}))});if(window.failOnce){window.failOnce=false;return {error:{context:{json:async()=>({error:'Connexion interrompue. Réessayez.'})}}};}return {data:{success:true}};}}})};}
(async()=>{const server=http.createServer((req,res)=>{try{const file=path.join(root,decodeURIComponent(new URL(req.url,'http://local').pathname));res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const b=await chromium.launch({headless:true,channel:'msedge'});try{const page=await b.newPage({viewport:{width:390,height:844}}),base='http://127.0.0.1:'+server.address().port,errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/vendor/supabase-2.57.4.js',r=>r.fulfill({contentType:'text/javascript',body:'('+fixture.toString()+')();'}));await page.route('**/*supabase.co/**',r=>r.abort());

let release;const gate=new Promise(r=>release=r);
await page.route('**/public-ui.js?*',async route=>{await gate;await route.continue();});
await page.goto(base+'/index.html',{waitUntil:'commit'});
await page.locator('body>nav').waitFor({state:'attached'});
assert.equal(await page.locator('body').evaluate(e=>getComputedStyle(e).visibility),'hidden');
assert.equal(await page.locator('html').evaluate(e=>getComputedStyle(e,'::before').content),'"GMFLEET"');
release();await page.locator('.pub-header').waitFor();
assert.equal(await page.locator('body').evaluate(e=>getComputedStyle(e).visibility),'visible');
await page.unroute('**/public-ui.js?*');
for(const name of ['services','vehicules','vehicule-credit','agregateur-yango','gestion-flotte','recrutement-chauffeurs','apropos','detail-vehicule']){
 await page.goto(base+'/'+name+'.html',{waitUntil:'domcontentloaded'});await page.locator('.pub-header').waitFor();
 assert.equal(await page.locator('html').evaluate(e=>e.classList.contains('public-ui-pending')),false,name);
}
await page.route('**/public-ui.js?*',r=>r.abort());
await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
await page.locator('html.public-ui-failed').waitFor({state:'attached'});
assert.equal(await page.locator('body').evaluate(e=>getComputedStyle(e).visibility),'hidden');
assert.deepEqual(errors,[]);
console.log('PASS: delayed UI script never exposes legacy layout; all pages reveal modern UI; failed download displays recovery message.');
}finally{await b.close();server.close();}})().catch(e=>{console.error(e);process.exit(1)});
