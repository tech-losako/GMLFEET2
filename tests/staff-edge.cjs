const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync('supabase/functions/staff-invite/index.ts','utf8').replace(/^import .*;\r?\n/,'').replace('(status:number, data:unknown)','(status, data)').replaceAll(/Deno\.env\.get\(([^)]+)\)!/g,'Deno.env.get($1)').replace("let type:'invite'|'recovery'","let type");
async function run({role='super_admin',active=true,authenticated=true,confirmed=false,saveError=null,body={email:'new@example.test',display_name:'New agent',role:'agent'}}={}){
 let handler,generated=0,linkType,saved;
 const caller={auth:{getUser:async()=>({data:{user:authenticated?{id:'owner'}:null}})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{role,active}})})})}),rpc:async(_,p)=>{saved=p;return {error:saveError};}};
 const service={auth:{admin:{getUserById:async()=>({data:{user:{email:body.email,email_confirmed_at:confirmed?'2026-09-16':null}}}),generateLink:async p=>{generated++;linkType=p.type;return {data:{user:{id:'new-user'},properties:{hashed_token:'secret-test-token'}}};}}}};
 vm.runInNewContext(source,{Deno:{env:{get:n=>n},serve:f=>handler=f},Response,createClient:(_,key)=>key==='SUPABASE_SERVICE_ROLE_KEY'?service:caller});
 const response=await handler(new Request('https://test/staff-invite',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify(body)}));
 return {status:response.status,data:await response.json(),generated,linkType,saved};
}
(async()=>{
 for(const role of ['agent','cashier','admin']){const r=await run({role});assert.equal(r.status,403);assert.equal(r.generated,0);}
 assert.equal((await run({active:false})).status,403);assert.equal((await run({authenticated:false})).status,401);
 const created=await run();assert.equal(created.status,200);assert.ok(created.data.link.includes('#token_hash=secret-test-token&type=invite'));assert.equal(created.saved.p.role,'agent');
 const denied=await run({saveError:{message:'Super Admin revoked'}});assert.equal(denied.status,409);assert.equal(denied.data.link,undefined);
 const reset=await run({confirmed:true,body:{user_id:'target',email:'existing@example.test',display_name:'Existing',role:'cashier',revision:2}});assert.equal(reset.linkType,'recovery');
 console.log('PASS: Edge authentication, active Super Admin enforcement, caller-authorized staff save, no token on failed authorization, invite/recovery link selection.');
})().catch(e=>{console.error(e);process.exit(1)});
