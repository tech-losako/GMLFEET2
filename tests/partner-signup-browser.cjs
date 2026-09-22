const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..');const server=http.createServer((req,res)=>{try{const p=path.join(root,new URL(req.url,'http://localhost').pathname);res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':'text/html');res.end(fs.readFileSync(p));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{for(const legacy of [true,false]){
 const page=await browser.newPage({viewport:{width:390,height:844}});let sent=[],alerts=[];page.on('dialog',async d=>{alerts.push(d.message());await d.dismiss();});
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname==='127.0.0.1')return route.continue();if(u.pathname.endsWith('/functions/v1/submit-application')){sent.push(route.request().postDataBuffer().toString());return route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({success:true})});}return route.abort();});
 if(legacy)await page.route('**/recrutement-chauffeurs.html',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,'recrutement-chauffeurs.html'),'utf8').replace('/vendor/supabase-2.57.4.js','https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.js')}));
 await page.goto('http://127.0.0.1:'+server.address().port+'/recrutement-chauffeurs.html');
 for(const [id,value] of Object.entries({applicantFirstName:'Test',applicantLastName:'Driver',applicantPhone:'+243810000000',applicantCommune:'Gombe'}))await page.locator('#'+id).fill(value);
 await page.locator('#applicantExperience').selectOption({index:1});await page.locator('#applicantDocument').setInputFiles({name:'permit.jpg',mimeType:'image/jpeg',buffer:Buffer.from([255,216,255,0,1,2])});
 await page.locator('#serviceApplicationForm').evaluate(f=>f.requestSubmit());
 if(legacy){await page.waitForTimeout(100);assert.ok(alerts.some(x=>x.includes('Le service est indisponible')));assert.equal(sent.length,0);}else{await page.waitForFunction(()=>!document.getElementById('successModalOverlay').classList.contains('hidden'));assert.equal(sent.length,1);assert.ok(sent[0].includes('Recrutement Chauffeur'));assert.ok(sent[0].includes('permit.jpg'));assert.equal(alerts.length,0);}
 await page.close();}
 console.log('PASS: reproduced CDN-blocked signup failure; bundled real SDK submits the partner-driver form and attachment with external scripts blocked.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
