const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync('supabase/functions/staff-email/index.ts','utf8').replace(/^import .*;\r?\n/,'').replace('(status:number,data:unknown)','(status,data)').replaceAll(/Deno\.env\.get\(([^)]+)\)!/g,'Deno.env.get($1)');
async function run({authenticated=true,denied=false,currentEmail='old@example.test',updateFails=false,finishFails=false}={}){
 let handler,updates=0,actual=currentEmail;
 const caller={auth:{getUser:async()=>({data:{user:authenticated?{id:'owner'}:null}})},rpc:async()=>denied?{error:{message:'Super Admin required'}}:{data:{id:'job',target_id:'target',new_email:'new@example.test'}}};
 const service={auth:{admin:{getUserById:async()=>({data:{user:{email:actual}}}),updateUserById:async(id,p)=>{assert.equal(id,'target');assert.deepEqual(Object.keys(p),['email']);updates++;if(!updateFails)actual=p.email;return {error:updateFails?{message:'duplicate'}:null};}}},rpc:async()=>finishFails?{error:{message:'offline'}}:{data:{state:actual==='new@example.test'?'completed':'failed',revision:3}}};
 vm.runInNewContext(source,{Deno:{env:{get:n=>n},serve:f=>handler=f},Response,createClient:(_,key)=>key==='SUPABASE_SERVICE_ROLE_KEY'?service:caller});
 const res=await handler(new Request('https://test',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({user_id:'target',revision:1,email:'new@example.test'})}));return {status:res.status,data:await res.json(),updates};
}
(async()=>{
 assert.equal((await run({authenticated:false})).status,401);const denied=await run({denied:true});assert.equal(denied.status,403);assert.equal(denied.updates,0);
 const ok=await run();assert.equal(ok.status,200);assert.equal(ok.data.email,'new@example.test');
 const retry=await run({currentEmail:'new@example.test'});assert.equal(retry.status,200);assert.equal(retry.updates,0);
 assert.equal((await run({updateFails:true})).status,400);assert.equal((await run({finishFails:true})).status,503);
 console.log('PASS: email API rejects unauthorized callers, edits only email, handles duplicate address, resumes completed Auth update, and reports finalization failure.');
})().catch(e=>{console.error(e);process.exit(1)});
