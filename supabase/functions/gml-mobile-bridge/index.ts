import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const headers={'Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
const bad=(status:number,error:string,message:string)=>reply(status,{error,message});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const statuses:Record<string,number>={bad_request:400,bad_signature:401,invalid_code:400,expired:400,phone_mismatch:403,too_many_attempts:429,not_linked:403,vehicle_not_found:404,rate_limited:429};

Deno.serve(async req=>{
 const service=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 const log=async(outcome:string)=>{const {error}=await service.rpc('log_mobile_bridge_event',{p:{outcome}});if(error)throw new Error('Bridge log unavailable');};
 try{
  const raw=await req.text(),timestamp=req.headers.get('x-gml-timestamp')||'',signature=req.headers.get('x-gml-signature')||'',secret=Deno.env.get('GML_BRIDGE_SECRET')||'';
  let valid=false;
  if(req.method==='POST'&&raw.length<=16384&&req.headers.get('x-gml-bridge-version')==='1'&&/^\d{10}$/.test(timestamp)&&Math.abs(Date.now()/1000-Number(timestamp))<=300&&/^[0-9a-f]{64}$/i.test(signature)&&new TextEncoder().encode(secret).length>=32){
   const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
   // WebCrypto performs the HMAC comparison without a string comparison timing leak.
   valid=await crypto.subtle.verify('HMAC',key,Uint8Array.from(signature.match(/../g)!,x=>parseInt(x,16)),new TextEncoder().encode(timestamp+'.'+raw));
  }
  if(!valid){await log('bad_signature');return bad(401,'bad_signature','Authentification invalide. Réessayez depuis GML Mobile.');}
  let p:any;try{p=JSON.parse(raw);}catch{await log('bad_request');return bad(400,'bad_request','Demande invalide.');}
  if(!p||typeof p!=='object'||Array.isArray(p)||!uuid.test(String(p.gml_user_id||''))){await log('bad_request');return bad(400,'bad_request','Demande invalide.');}
  // Explicit allow-list: the bridge cannot call arbitrary GM Fleet commands.
  const fields:Record<string,string[]>={redeem_invite:['gml_phone','code'],owner_overview:[],vehicle_settlements:['vehicle_id','limit'],vehicle_receipts:['vehicle_id','month'],vehicle_advances:['vehicle_id']};
  if(!Object.hasOwn(fields,p.action)){await log('bad_request');return bad(400,'bad_request','Action invalide.');}
  const command:Record<string,unknown>={action:p.action,gml_user_id:p.gml_user_id};
  for(const field of fields[p.action])if(Object.hasOwn(p,field))command[field]=p[field];
  if((p.action.startsWith('vehicle_')&&(!Number.isSafeInteger(p.vehicle_id)||p.vehicle_id<=0))||
   (p.action==='vehicle_settlements'&&p.limit!==undefined&&(!Number.isInteger(p.limit)||p.limit<1||p.limit>120))||
   (p.action==='redeem_invite'&&(typeof p.code!=='string'||typeof p.gml_phone!=='string'))){await log('bad_request');return bad(400,'bad_request','Demande invalide.');}
  const {data,error}=await service.rpc('mobile_bridge_call',{p:command});
  if(error)throw new Error('Bridge command unavailable');
  return reply(data?.error?(statuses[data.error]||400):200,data);
 }catch{
  // Do not log request bodies, codes, signatures or credentials to runtime logs.
  try{await log('bad_request');}catch{/* Database outage: fail closed without logging credentials. */}
  return bad(400,'bad_request','Service momentanément indisponible. Réessayez plus tard.');
 }
});
