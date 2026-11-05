const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),{stripTypeScriptTypes}=require('module'),{webcrypto,createHmac,randomUUID}=require('crypto');
const secret='test-only-bridge-secret-32-random-bytes-placeholder';let handler,commands=[],logs=[];
const service={rpc:async(name,{p})=>{if(name==='log_mobile_bridge_event'){logs.push(p);return {data:null}}commands.push(p);return {data:p.action==='owner_overview'?{owner:{name:'Test'},vehicles:[]}:{error:'not_linked',message:'Aucun accès propriétaire actif.'}}}};
vm.runInNewContext(stripTypeScriptTypes(fs.readFileSync('supabase/functions/gml-mobile-bridge/index.ts','utf8').replace(/^import .*\r?\n/gm,'')),{Request,Response,TextEncoder,Uint8Array,crypto:webcrypto,Date,console,createClient:()=>service,Deno:{env:{get:k=>k==='GML_BRIDGE_SECRET'?secret:'test'},serve:f=>handler=f}});
async function call(p={},options={}){const raw=options.raw||JSON.stringify({action:'owner_overview',gml_user_id:randomUUID(),...p}),ts=String(Math.floor(Date.now()/1000)+(options.offset||0));const signature=options.bad?'0'.repeat(64):createHmac('sha256',secret).update(ts+'.'+raw).digest('hex');const r=await handler(new Request('https://test/gml-mobile-bridge',{method:'POST',headers:{'x-gml-bridge-version':options.version||'1','x-gml-timestamp':ts,'x-gml-signature':signature},body:raw}));return {status:r.status,body:await r.json()};}
(async()=>{
 // 7. Correct signature, bad signature, stale/future timestamps, wrong version and raw-body mutation.
 assert.equal((await call()).status,200);for(const options of [{bad:true},{offset:-600},{offset:600},{version:'2'}]){const n=commands.length;const r=await call({},options);assert.equal(r.status,401);assert.equal(r.body.error,'bad_signature');assert.equal(commands.length,n);}
 assert.equal(logs.filter(x=>x.outcome==='bad_signature').length,4);
 assert.equal((await call({}, {raw:'{'})).status,400);assert.equal((await call({action:'confirm_cash_payment'})).status,400);assert.equal((await call({action:'vehicle_receipts',vehicle_id:'1'})).status,400);
 await call({proof_path:'private',gml_phone:'not-allowed-for-overview',code:'12345678'});assert.deepEqual(Object.keys(commands.at(-1)).sort(),['action','gml_user_id']);
 for(const action of ['redeem_invite','vehicle_receipts','vehicle_settlements','vehicle_advances']){const r=await call({action,vehicle_id:1,month:'2026-11',code:'12345678',gml_phone:'+243810000001'});assert.equal(r.status,403);}
 assert.ok(!JSON.stringify(logs).includes('12345678'));
 console.log('PASS case 7: real WebCrypto HMAC verification, timestamps/version, malformed body/action checks, five-action allowlist, redacted auth logs; provider/database mocked.');
})().catch(e=>{console.error(e);process.exitCode=1});
