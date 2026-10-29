import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { smsRpc, smsPhone, sameSecret } from '../_shared/sms.ts';
Deno.serve(async req=>{
 const reply=(code:number,data:unknown)=>new Response(JSON.stringify(data),{status:code,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(req.method!=='POST')return reply(405,{error:'POST requis'});
 try{
  const key=new URL(req.url).searchParams.get('key')||'';if(!/^[a-f0-9]{64}$/.test(key))return reply(401,{error:'Notification non autorisée'});
  const service=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}}),config=await smsRpc(service,'sms_transport_configuration');
  if(!await sameSecret(key,config.callback_token))return reply(401,{error:'Notification non autorisée'});
  const reader=req.body?.getReader();if(!reader)return reply(400,{error:'Rapport vide'});let bytes=0;const chunks=[];while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>16384){await reader.cancel();return reply(413,{error:'Rapport trop long'});}chunks.push(value);}
  const raw=await new Blob(chunks).text(),p=req.headers.get('Content-Type')?.includes('application/json')?JSON.parse(raw):Object.fromEntries(new URLSearchParams(raw));
  const status=({Success:'delivered',Delivered:'delivered',Sent:'sent',Submitted:'accepted',Buffered:'accepted',Queued:'accepted',Failed:'failed',Rejected:'failed',Expired:'failed'} as Record<string,string>)[String(p.status)],id=String(p.id||p.messageId||'');
  if(!status||!/^[a-zA-Z0-9_-]{3,160}$/.test(id))return reply(400,{error:'Rapport invalide'});
  const phone=p.phoneNumber||p.number;if(phone&&!smsPhone(phone))return reply(400,{error:'Destinataire invalide'});
  await smsRpc(service,'record_sms_delivery',{message_id:id,phone:phone?smsPhone(phone):null,status,reason:status==='failed'?String(p.failureReason||p.status).slice(0,200):null});return reply(200,{success:true});
 }catch{return reply(503,{error:'Rapport non enregistré. Réessayez.'});}
});
