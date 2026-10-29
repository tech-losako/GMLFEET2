const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{webcrypto}=require('node:crypto'),{stripTypeScriptTypes}=require('node:module');
const source=require('./sms-source.cjs').load('submit-application');
async function scenario(options={}){
 let handler,reserved,completed=0;const messages=[];
 const client={from:()=>({select(){return this;},eq(){return this;},is(){return this;},in:async()=>({data:[{user_id:'admin-1',phone:'+243820000000'},{user_id:'admin-2',phone:'+243830000000'}]})}),rpc:async(name,p)=>{
  if(name==='reserve_public_submission'){reserved=p.p;return options.stale?{error:{message:'Le tarif a changé'}}:{data:{application_id:77,completed:Boolean(options.replay)}};}
  completed++;return options.staleComplete?{error:{message:'Le tarif a changé. Consultez le nouveau montant'}}:options.failComplete?{error:{message:'Interrupted'}}:{data:77};
 }};
 const env={SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'server-test',AFRICASTALKING_USERNAME:'sandbox',AFRICASTALKING_API_KEY:'mock-only'};
 if(options.noSms)delete env.AFRICASTALKING_API_KEY;
 const fetch=async(url,p)=>{assert.match(url,/africastalking/);messages.push({to:p.body.get('to'),message:p.body.get('message')});return Response.json({SMSMessageData:{Recipients:[{statusCode:101,messageId:'AT-TEST-1'}]}});};
 vm.runInNewContext(source,{AbortSignal,URLSearchParams,crypto,TextEncoder,Uint8Array,createClient:()=>client,fetch,URLSearchParams,Response,Request,Blob,File,TextEncoder,TextDecoder,Uint8Array,crypto:webcrypto,Date,Number,JSON,console:{error(){}},Deno:{env:{get:k=>env[k]},serve:h=>handler=h}});
 const app={name:'Isolated candidate',phone:'+243810000000',vehicle:'Suzuki Swift',plan_duration_months:12,service_details:{offerRevision:2},...options.app};
 const form=new FormData();form.set('request_id','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');form.set('application',JSON.stringify(app));
 const response=await handler(new Request('https://example.test/submit',{method:'POST',body:form}));
 return {status:response.status,body:await response.json(),messages,reserved,completed};
}
(async()=>{
 const success=await scenario();assert.equal(success.status,200);assert.equal(success.body.sms_status,'sent');assert.equal(success.reserved.application.plan_duration_months,12);assert.equal(success.reserved.application.service_details.offerRevision,2);assert.equal(success.messages.filter(m=>m.to==='+243810000000').length,1);assert.equal(success.messages.length,3,'one client SMS, two separate admin alerts');assert.match(success.messages[0].message,/demande CNG-.* reçue/);
 for(const months of [15,18,24,0]){const r=await scenario({app:{plan_duration_months:months}});assert.equal(r.status,400);assert.equal(r.messages.length,0);assert.equal(r.reserved,undefined);}
 assert.equal((await scenario({app:{plan_duration_months:null}})).reserved.application.plan_duration_months,12);
 for(const details of [{},{yangoConditionsAccepted:'true',yangoConditionsVersion:'old'},{yangoConditionsAccepted:'false',yangoConditionsVersion:'2026-10-23-v1'}]){const denied=await scenario({app:{service:'Chauffeur Yango',vehicle:'Yango',service_details:details}});assert.equal(denied.status,400);assert.equal(denied.reserved,undefined);assert.equal(denied.messages.length,0);}
 const service=await scenario({app:{service:'Chauffeur Yango',vehicle:'Yango',plan_duration_months:18,service_details:{yangoConditionsAccepted:'true',yangoConditionsVersion:'2026-10-23-v1',yangoConditionsAcceptedAt:'forged',role:'admin'}}});assert.equal(service.reserved.application.service_details.yangoConditionsAccepted,'true');assert.equal(service.reserved.application.service_details.yangoConditionsVersion,'2026-10-23-v1');assert.equal(service.reserved.application.service_details.yangoConditionsAcceptedAt,undefined);assert.equal(service.reserved.application.service_details.role,undefined);assert.equal(service.reserved.application.plan_duration_months,null);
 const replay=await scenario({replay:true});assert.equal(replay.body.sms_status,'previously_processed');assert.equal(replay.messages.length,0);assert.equal(replay.completed,0);
 for(const failure of [{stale:true},{failComplete:true},{staleComplete:true}]){const r=await scenario(failure);assert.ok(r.status>=400);assert.equal(r.messages.length,0);if(failure.staleComplete){assert.equal(r.status,409);assert.match(r.body.error,/tarif a changé/);}}
 assert.equal((await scenario({noSms:true})).body.sms_status,'not_configured');
 console.log('PASS public intake: fixed 12-month validation, quote revision payload, one client acknowledgment, separate admin alerts, no SMS on failed/replayed submissions. No real SMS sent.');
})().catch(e=>{console.error(e);process.exitCode=1;});
