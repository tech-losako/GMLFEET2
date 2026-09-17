const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync('supabase/functions/submit-application/index.ts','utf8').replace(/^import .*;\r?\n/,'').replace('(status:number,data:unknown)','(status,data)').replace('(bytes:BufferSource)','(bytes)').replace('(b:Uint8Array)','(b)').replace(':Uint8Array[]','').replaceAll(':Record<string,unknown>','').replaceAll(/Deno\.env\.get\(([^)]+)\)!/g,'Deno.env.get($1)');
const png=new Uint8Array([137,80,78,71,13,10,26,10,1,2,3]);
async function run({files=[{data:png,name:'photo.png',type:'image/png'}],storageFail=false,completed=false,duplicate=false,completeFail=false}={}){
 let handler,uploads=[],reserved,finalized=0;
 const client={rpc:async(name,args)=>{if(name==='reserve_public_submission'){reserved=args.p;return {data:{application_id:77,completed}};}finalized++;return {error:completeFail?{message:'DB failed'}:null};},storage:{from:bucket=>({upload:async(path,bytes,options)=>{uploads.push({bucket,path,bytes,options});return {error:storageFail?{statusCode:503}:duplicate?{statusCode:409}:null};}})}};
 vm.runInNewContext(source,{Deno:{env:{get:n=>n},serve:f=>handler=f},Response,Blob,File,Uint8Array,TextDecoder,TextEncoder,crypto,createClient:()=>client});
 const form=new FormData();form.set('request_id','11111111-1111-4111-8111-111111111111');form.set('application',JSON.stringify({name:'Candidate',phone:'000',vehicle:'Toyota',workflow_stage:'approved',assigned_to:'attacker',note:'injected'}));for(const f of files)form.append('files',new File([f.data],f.name,{type:f.type}));
 const response=await handler(new Request('https://test',{method:'POST',body:form}));return {status:response.status,data:await response.json(),uploads,reserved,finalized};
}
(async()=>{
 const ok=await run();assert.equal(ok.status,200);assert.equal(ok.uploads.length,1);assert.equal(ok.uploads[0].bucket,'application-documents');assert.ok(ok.uploads[0].path.startsWith('77/'));assert.equal(ok.reserved.application.workflow_stage,undefined);assert.equal(ok.reserved.application.assigned_to,undefined);assert.equal(ok.reserved.application.note,undefined);
 const forged=await run({files:[{data:'<svg onload="alert(1)">',name:'fake.png',type:'image/png'}]});assert.equal(forged.status,400);assert.equal(forged.uploads.length,0);
 assert.equal((await run({files:Array.from({length:9},()=>({data:png,name:'photo.png',type:'image/png'}))})).status,400);
 const failed=await run({storageFail:true});assert.equal(failed.status,503);assert.equal(failed.finalized,0);
 assert.equal((await run({duplicate:true})).status,200);assert.equal((await run({completeFail:true})).status,503);
 const repeat=await run({completed:true});assert.equal(repeat.status,200);assert.equal(repeat.uploads.length,0);
 console.log('PASS: actual multipart file bytes, private paths, applicant-field allowlist, magic-byte validation, file-count limit, upload failure, duplicate-file retry and completed-request retry.');
})().catch(e=>{console.error(e);process.exit(1)});
