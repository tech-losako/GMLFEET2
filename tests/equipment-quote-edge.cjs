const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync('supabase/functions/submit-equipment-quote/index.ts','utf8').replace(/^import .*;\r?\n/,'').replace(/:\s*(?:number|string|unknown)/g,'').replaceAll(/Deno\.env\.get\(([^)]+)\)!/g,'Deno.env.get($1)');
async function run({payload={},created=true,sms=false}={}){
 let handler,saved,requests=[];
 const admins=[{user_id:'admin-1',phone:'+243820000000'}];
 const client={rpc:async(name,args)=>{assert.equal(name,'submit_equipment_quote');saved=args.p;return {data:{success:true,created}};},from:table=>({select(){return this;},eq(){return this;},in(){return this;},then(resolve,reject){return Promise.resolve(table==='staff_members'?{data:admins,error:null}:{data:[],error:null}).then(resolve,reject);}})};
 const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'service'};if(sms){env.AFRICASTALKING_USERNAME='sandbox';env.AFRICASTALKING_API_KEY='secret';}
 const fetch=async(url,options)=>{requests.push({url,body:String(options.body)});assert.match(url,/api\.sandbox\.africastalking\.com/);return {ok:true,status:201};};
 vm.runInNewContext(source,{Deno:{env:{get:key=>env[key]},serve:f=>handler=f},Response,URLSearchParams,fetch,console,createClient:()=>client});
 const base={name:'Order Test',email:'order@example.test',phone:'+243810000000',city:'Gombe',equipment:'gps',vehicle_type:'Voiture',model:'Toyota Vitz',quantity:1,message:''};
 const response=await handler(new Request('https://test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({request_id:'11111111-1111-4111-8111-111111111111',p:{...base,...payload}})}));return {status:response.status,data:await response.json(),saved,requests};
}
(async()=>{
 const ok=await run();assert.equal(ok.status,200);assert.equal(ok.saved.phone,'+243810000000');assert.match(ok.data.reference,/^GML-CMD-\d{4}-11111111$/);assert.equal(ok.data.sms_status,'not_configured');assert.equal(ok.data.admin_sms_status,'not_configured');assert.equal(ok.data.admin_push_status,'not_configured');
 const sent=await run({sms:true});assert.equal(sent.data.sms_status,'sent');assert.equal(sent.data.admin_sms_status,'sent');assert.equal(sent.requests.length,2);assert.match(sent.requests[0].body,/commande\+GML-CMD-/);assert.match(new URLSearchParams(sent.requests[0].body).get('message'),/confirmer le devis et planifier l'installation/);assert.match(new URLSearchParams(sent.requests[1].body).get('message'),/nouvelle demande de devis/i);
 const repeated=await run({created:false,sms:true});assert.equal(repeated.data.sms_status,'previously_processed');assert.equal(repeated.data.admin_sms_status,'previously_processed');assert.equal(repeated.requests.length,0);
 const invalid=await run({payload:{phone:'12345'}});assert.equal(invalid.status,400);assert.match(invalid.data.error,/9 chiffres/);
 console.log('PASS equipment order reference, phone normalization, distinct SMS wording, missing-secret fallback and retry deduplication.');
})().catch(error=>{console.error(error);process.exit(1)});
