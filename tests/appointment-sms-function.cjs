const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const {stripTypeScriptTypes}=require('node:module');
const source=stripTypeScriptTypes(fs.readFileSync(path.join(__dirname,'../supabase/functions/schedule-appointment/index.ts'),'utf8').replace(/^import .*\n/,''));
async function scenario(options={}){
 let handler,fetches=0,saved,booked=0;
 const notification={id:9,delivery_status:options.claim===false?'sent':'pending'};
 const query=table=>({eq(){return this;},select(){return this;},update(p){saved=p;return this;},maybeSingle:async()=>({data:table==='staff_members'?{active:options.active!==false,deleted_at:options.deleted?'2026-01-01':null}:table==='appointments'?{id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',application_id:1,status:'scheduled'}:notification}),then(fn){return Promise.resolve({data:[],error:null}).then(fn);}});
 const createClient=()=>({auth:{getUser:async()=>({data:{user:options.unauth?null:{id:'staff'}},error:null})},from:query,rpc:async(name)=>{if(name==='schedule_case_appointment'){booked++;return {data:{notification_id:9,appointment_id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',sms_status:'pending'}};}return {data:options.claim===false?null:{recipient:'+243810000000',body:'SERVER-INVITATION'}};}});
 const env={SUPABASE_URL:'https://example.test',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'private-test',AFRICASTALKING_USERNAME:'sandbox',AFRICASTALKING_API_KEY:'test-key',AFRICASTALKING_SENDER_ID:'TEST'};
 if(options.unconfigured)delete env.AFRICASTALKING_API_KEY;
 const fetch=async(url,p)=>{fetches++;assert.equal(p.body.get('to'),'+243810000000');assert.equal(p.body.get('message'),'SERVER-INVITATION');assert.equal(p.headers.apiKey,'test-key');if(options.timeout)throw Error('Network timeout');return new Response(options.invalid?'bad':JSON.stringify({SMSMessageData:{Recipients:[{status:options.rejected?'InvalidPhoneNumber':'Success',statusCode:options.rejected?102:101,messageId:'PROVIDER-TEST'}]}}),{status:options.http||200});};
 vm.runInNewContext(source,{createClient,fetch,URLSearchParams,Request,Response,AbortSignal,Date,Number,JSON,Deno:{env:{get:k=>env[k]},serve:h=>{handler=h;}}});
 const payload={application_id:1,revision:2,request_id:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',starts_at:'2026-10-10T09:00:00Z',location:'Office',to:'+19999999999',message:'UNTRUSTED',...options.body};
 const response=await handler(new Request('https://example.test/schedule',{method:'POST',headers:{Authorization:'Bearer test','Content-Type':'application/json'},body:JSON.stringify(payload)}));
 return {status:response.status,body:await response.json(),fetches,saved,booked};
}
(async()=>{
 for(const denied of [{unauth:true},{active:false},{deleted:true}]){const r=await scenario(denied);assert.ok([401,403].includes(r.status));assert.equal(r.fetches,0);assert.equal(r.booked,0);}
 const invalid=await scenario({body:{request_id:'invalid'}});assert.equal(invalid.status,400);assert.equal(invalid.fetches,0);
 const success=await scenario();assert.equal(success.body.sms_status,'sent');assert.equal(success.saved.provider_message_id,'PROVIDER-TEST');assert.equal(success.fetches,1);
 for(const options of [{rejected:true},{http:400}]){const r=await scenario(options);assert.equal(r.body.sms_status,'failed');assert.ok(r.body.sms_error);assert.equal(r.body.success,true);}
 for(const options of [{http:500},{invalid:true},{timeout:true}])assert.equal((await scenario(options)).body.sms_status,'unknown');
 const missing=await scenario({unconfigured:true});assert.equal(missing.body.sms_status,'not_configured');assert.equal(missing.fetches,0);
 const duplicate=await scenario({claim:false});assert.equal(duplicate.body.sms_status,'sent');assert.equal(duplicate.fetches,0);
 const retry=await scenario({body:{appointment_id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'}});assert.equal(retry.booked,0);assert.equal(retry.fetches,1);
 console.log('PASS SMS Edge function: staff authorization, input checks, authoritative recipient/body, provider rejections, unknown outcomes, configuration and duplicate prevention. No real SMS sent.');
})().catch(e=>{console.error(e);process.exitCode=1;});
