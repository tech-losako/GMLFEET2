const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),artifacts=process.env.ARTIFACT_DIR||path.join(__dirname,'artifacts');
function fixture(){
 const data={contract_id:'contract',driver_name:'Éric Test',currency:'USD',vehicle:{model:'Toyota Corolla',plate:'1234AB/01'},first_payment_date:"2026-09-21",daily_amount:10,due:20,total_remaining:100,attempts:[],receipts:[]};window.calls=[];
 const slip={id:123,reference:'GMTEST',driver_name:'Éric Test',vehicle:data.vehicle,contract_reference:'GML-2026-123',currency:'USD',amount:10,transaction_fee:0.3,total_charged:10.3,paid_on:'2026-09-17',confirmed_at:'2026-09-17T12:00:00Z',method:'Araka MPESA',status:'confirmed'};
 window.supabase={createClient:()=>({functions:{invoke:async(name,{body})=>{
  window.calls.push(body);
  if(body.action==='pay'&&window.slowPay)await new Promise(r=>setTimeout(r,700));
  if(body.action==='check'&&window.checkError)return {data:{error:'Connexion interrompue'}};
  if(body.action==='check'&&window.decline){data.attempts[0].state='declined';return {data:JSON.parse(JSON.stringify(data))};}
  if(body.action==='driver-lookup')return body.phone==='+243812345678'&&body.plate==='1234AB/01'?{data:{token:'b'.repeat(64)}}:{data:{error:'Téléphone ou plaque incorrects'}};
  if(body.action==='pay')data.attempts=[{id:body.id,reference:'GMTEST',amount:Number(body.amount),transaction_fee:0.3,total_charged:10.3,currency:'USD',provider:body.provider,state:'pending'}];
  if(body.action==='check'){data.attempts[0].state='approved';data.attempts[0].receipt_id=123;data.total_remaining=90;data.due=0;data.receipts=[slip];}
  if(body.action==='receipt')return {data:slip};
  return {data:JSON.parse(JSON.stringify(data))};
 }}})};
}
(async()=>{fs.mkdirSync(artifacts,{recursive:true});const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://localhost').pathname);try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'});try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*supabase.co/**',r=>r.abort());await page.route('**/supabase-js@*/**',r=>r.fulfill({contentType:'text/javascript',body:'('+fixture.toString()+')();'}));const base='http://127.0.0.1:'+server.address().port;
 await page.goto(base+'/payer.html');await page.locator('#phoneForm').waitFor();assert.equal(await page.locator('#driverPayForm').count(),0);assert.equal(await page.getByText(/SMS/).count(),0);
 await page.locator('[name=phone]').fill('812345678');await page.locator('[name=plate]').fill('9999ZZ/02');await page.getByRole('button',{name:'Voir mes versements'}).click();await page.getByText('Téléphone ou plaque incorrects',{exact:true}).waitFor();assert.equal(await page.locator('#driverPayForm').count(),0);
 await page.locator('[name=plate]').fill('1234ab01');assert.equal(await page.locator('[name=plate]').inputValue(),'1234AB/01');assert.equal(await page.locator('[name=phone]').getAttribute('maxlength'),'9');await page.getByRole('button',{name:'Voir mes versements'}).click();await page.getByText('Véhicule : Toyota Corolla',{exact:false}).waitFor();assert.match(await page.locator('#feeSummary').innerText(),/20,60/);
 await page.getByText('Début des versements : 2026-09-21.',{exact:false}).waitFor();
 await page.locator('#payOneDay').click();assert.equal(await page.locator('[name=amount]').inputValue(),'10.00');assert.match(await page.locator('#feeSummary').innerText(),/10,30/);
 await page.locator('#payAllDue').click();assert.equal(await page.locator('[name=amount]').inputValue(),'20.00');
 await page.locator('[name=amount]').fill('7.5');assert.match(await page.locator('#feeSummary').innerText(),/7,73/);
 await page.locator('[name=wallet]').fill('810000000');await page.locator('[name=amount]').fill('10');await page.getByRole('button',{name:'Payer maintenant'}).click();await page.locator('#checkPayment').waitFor();assert.equal(await page.evaluate(()=>window.calls.find(c=>c.action==='pay').amount),'10');assert.equal(await page.locator('#driverPayForm').count(),0);assert.equal(await page.locator('[data-download-receipt]').count(),0);
 await page.locator('#checkPayment').click();await page.getByText('Paiement confirmé',{exact:true}).waitFor();await page.getByText('Reçu #123',{exact:false}).waitFor();
 const waiting=page.waitForEvent('download');await page.getByRole('button',{name:'Télécharger le reçu PDF'}).click();const download=await waiting;assert.equal(download.suggestedFilename(),'GMFleet-recu-123.pdf');const dest=path.join(artifacts,download.suggestedFilename());await download.saveAs(dest);assert.equal(fs.readFileSync(dest).subarray(0,5).toString(),'%PDF-');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(new URL(page.url()).hash,'');await page.screenshot({path:path.join(artifacts,'driver-payments-mobile.png'),fullPage:true});
 await page.locator('#changeDriver').click();await page.locator('#phoneForm').waitFor();await page.goto(base+'/payer.html#token='+'a'.repeat(64));await page.locator('#driverPayForm').waitFor();await page.evaluate(()=>window.slowPay=true);
 await page.locator('[name=wallet]').fill('810000000');await page.locator('[name=provider]').selectOption('ORANGE');await page.locator('[name=amount]').fill('7.5');
 await page.getByRole('button',{name:'Payer maintenant',exact:true}).click();await page.locator('#paymentStatus[data-state="sending"]').waitFor();assert.equal(await page.locator('[name=wallet]').isDisabled(),true);
 await page.locator('#paymentStatus[data-state="pending"]').waitFor();await page.evaluate(()=>window.checkError=true);await page.locator('#checkPayment').click();await page.locator('#paymentStatus[data-state="unknown"]').waitFor();assert.equal(await page.locator('#driverPayForm').count(),0);
 await page.evaluate(()=>{window.checkError=false;window.decline=true;});await page.locator('#checkPayment').click();await page.locator('#paymentStatus[data-state="declined"]').waitFor();assert.equal(await page.locator('[name=wallet]').inputValue(),'810000000');assert.equal(await page.locator('[name=provider]').inputValue(),'ORANGE');assert.equal(await page.locator('[name=amount]').inputValue(),'7.5');
 await page.evaluate(()=>window.decline=false);await page.getByRole('button',{name:'Réessayer le paiement',exact:true}).click();await page.locator('#paymentStatus[data-state="pending"]').waitFor();await page.locator('#checkPayment').click();await page.locator('#paymentStatus[data-state="approved"]').waitFor();
 const ids=await page.evaluate(()=>window.calls.filter(x=>x.action==='pay').map(x=>x.id));assert.equal(new Set(ids).size,ids.length);assert.deepEqual(errors,[]);
 console.log('PASS: no SMS, phone and plate required, incorrect lookup stays private, 3% preview, pending has no slip, confirmed payment downloads a PDF, personal links and mobile layout work.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
