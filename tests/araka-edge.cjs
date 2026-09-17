const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const raw=fs.readFileSync('supabase/functions/araka-payments/index.ts','utf8');
const source=raw.replace(/^import .*;\r?\n/,'').replaceAll('body?:unknown','body').replace(/:(number|string|unknown|any)\b/g,'').replaceAll(/Deno\.env\.get\(([^)]+)\)!/g,'Deno.env.get($1)');
const cap='a'.repeat(64),callback='b'.repeat(64),sha=v=>require('crypto').createHash('sha256').update(v).digest('hex');
async function run({action='check',providerData={transactionId:'TX-1',statusCode:200,statusDescription:'APPROVED'},dispatch=true,sandbox=false,invalidCallback=false,transactionId='TX-1',recent=false}={}){
 let handler,charges=0,updates=[];const attempt={id:'11111111-1111-4111-8111-111111111111',contract_id:'contract',reference:'GMTEST',amount:10,currency:'USD',provider:'MPESA',wallet:'+243810000000',state:'pending',transaction_id:transactionId,callback_hash:sha(callback),last_checked_at:recent?new Date().toISOString():null};
 const snapshot=()=>({contract_id:'contract',driver_name:'Driver',currency:'USD',daily_amount:10,total_remaining:100,due:10,attempts:[{...attempt}]});
 const db={rpc:async(name,{p}={})=>{if(name==='driver_payment_context')return {data:snapshot()};if(name==='begin_araka_payment')return {data:{...attempt,dispatch,driver_name:'Driver'}};if(name==='record_araka_status'){updates.push(p);if(p.status==='APPROVED')attempt.state='approved';return {data:attempt.state};}throw Error(name);},from:()=>({select:()=>({eq(){return this;},maybeSingle:async()=>({data:invalidCallback?null:attempt})})})};
 const env={ARAKA_BASE_URL:sandbox?'https://araka-api-uat.azurewebsites.net':'https://api.arakapay.com',ARAKA_EMAIL:'fake@example.test',ARAKA_PASSWORD:'test-placeholder',ARAKA_PAYMENT_PAGE_ID:'test-page'};
 vm.runInNewContext(source,{Deno:{env:{get:n=>env[n]||n},serve:f=>handler=f},Response,Request,URL,TextEncoder,Uint8Array,crypto,AbortSignal,createClient:()=>db,fetch:async(url,options)=>{if(url.endsWith('/api/login'))return Response.json({token:'test-token'});if(url.endsWith('/api/pay/paymentrequest')){charges++;const body=JSON.parse(options.body);assert.equal(body.order.amount,10);assert.equal(body.order.currency,'USD');return Response.json({transactionId:'TX-1',statusCode:202,statusDescription:'ACCEPTED'});}return Response.json(providerData);}});
 const url=action==='callback'?'https://test?callback='+callback:'https://test';
 const response=await handler(new Request(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(action==='callback'?{statusCode:200,statusDescription:'APPROVED'}:{action,token:cap,id:attempt.id,amount:'10',provider:'MPESA',wallet:attempt.wallet})}));
 return {status:response.status,data:await response.json(),charges,updates};
}
(async()=>{
 assert.ok((await run()).updates.some(p=>p.status==='APPROVED'));
 const accepted=await run({action:'pay'});assert.equal(accepted.charges,1);assert.ok(accepted.updates.every(p=>p.status!=='APPROVED'));
 assert.equal((await run({action:'pay',dispatch:false})).charges,0);
 assert.equal((await run({action:'pay',sandbox:true})).status,409);
 const forged=await run({action:'callback',recent:true,providerData:{transactionId:'TX-1',statusCode:202,statusDescription:'PENDING'}});assert.ok(forged.updates.every(p=>p.status!=='APPROVED'));
 assert.ok((await run({action:'callback',recent:true})).updates.some(p=>p.status==='APPROVED'));
 assert.equal((await run({action:'callback',invalidCallback:true})).status,401);
 for(const providerData of [{transactionId:'OTHER',statusCode:200,statusDescription:'APPROVED'},{transactionId:'TX-1',statusCode:200,statusDescription:'APPROVED',amount:11},{transactionId:'TX-1',statusCode:200,statusDescription:'APPROVED',currency:'CDF'}])assert.equal((await run({providerData})).updates.length,0);
 assert.equal((await run({transactionId:null,providerData:{transactionId:'TX-1',originatingTransactionId:'OTHER',statusCode:200,statusDescription:'APPROVED'}})).updates.length,0);
 assert.ok((await run({transactionId:null,providerData:{transactionId:'TX-1',originatingTransactionId:'GMTEST',statusCode:200,statusDescription:'APPROVED'}})).updates.some(p=>p.status==='APPROVED'));
 console.log('PASS: only matching provider-approved transactions credit the ledger; 202, forged callbacks, wrong amounts/currency/IDs cannot; retries do not recharge; sandbox collection blocked.');
})().catch(e=>{console.error(e);process.exit(1)});
