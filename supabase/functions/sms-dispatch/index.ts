import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { smsRpc, sendReservedSMS, sendTrackedSMS, smsPhone, sameSecret } from '../_shared/sms.ts';
const origin='https://gmfleet.georgemichaellogistics.cd';
const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});if(req.method!=='POST')return reply(405,{error:'Méthode non autorisée'});
 try{
  const url=Deno.env.get('SUPABASE_URL')!,authorization=req.headers.get('Authorization')||'',service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}}),config=await smsRpc(service,'sms_transport_configuration');
  const worker=await sameSecret(authorization.replace(/^Bearer /,''),config.worker_token);
  let staff:any,actor:string|undefined;
  if(!worker){
   const caller=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}}),{data,error}=await caller.auth.getUser();if(error||!data.user)return reply(401,{error:'Reconnectez-vous'});actor=data.user.id;
   const member=await caller.from('staff_members').select('active,deleted_at,role').eq('user_id',actor).maybeSingle();staff=member.data;
   if(!staff?.active||staff.deleted_at||!['admin','super_admin'].includes(staff.role))return reply(403,{error:'Accès administrateur requis'});
  }
  const p=await req.json();
  if(!worker&&p.action==='configuration')return reply(200,{configured:!!(Deno.env.get('AFRICASTALKING_USERNAME')&&Deno.env.get('AFRICASTALKING_API_KEY')),mode:Deno.env.get('AFRICASTALKING_USERNAME')==='sandbox'?'sandbox':'production',sender:Deno.env.get('AFRICASTALKING_SENDER_ID')||'Expéditeur par défaut du fournisseur',enabled:config.enabled,callback_url:staff.role==='super_admin'?url+'/functions/v1/africastalking-delivery?key='+config.callback_token:undefined});
  if(!worker&&p.action==='test'){
   const phone=smsPhone(p.phone);if(!phone||!/^[0-9a-f-]{36}$/i.test(String(p.request_id||'')))return reply(400,{error:'Numéro +243 et identifiant de test requis'});
   const {count,error}=await service.from('sms_dispatches').select('id',{head:true,count:'exact'}).eq('kind','sms_test').eq('actor_id',actor).gte('created_at',new Date(Date.now()-3600000).toISOString());if(error)throw error;if((count||0)>=5)return reply(429,{error:'Limite de cinq tests par heure atteinte'});
   const result=await sendTrackedSMS(service,{event_key:'test:'+actor+':'+p.request_id,kind:'sms_test',recipient:phone,actor_id:actor},'GM Fleet : SMS de test. Si vous lisez ce message, la réception sur ce téléphone fonctionne.');return reply(200,{success:true,sms_status:result.status,sms_error:result.error||null,id:result.id});
  }
  if(!worker&&p.action==='retry'){
   const {data:n,error}=await service.from('sms_dispatches').select('*').eq('id',p.id).maybeSingle();if(error||!n||n.sensitive||!['failed','not_configured'].includes(n.status))return reply(409,{error:'Ce message ne peut pas être renvoyé. Un état accepté ou inconnu exige une vérification préalable.'});
   const result=await sendReservedSMS(service,n,undefined,true);return reply(200,{success:true,sms_status:result.status,sms_error:result.error||null});
  }
  if(worker||p.action==='dispatch'){
   if(!config.enabled)return reply(200,{success:true,paused:true});
   const {data,error}=await service.from('sms_dispatches').select('id,status,body,sensitive').eq('status','pending').eq('sensitive',false).order('created_at').limit(10);if(error)throw error;
   const results=[];for(const n of data||[])results.push((await sendReservedSMS(service,n)).status);
   return reply(200,{success:true,processed:results.length,statuses:results});
  }
  return reply(400,{error:'Action inconnue'});
 }catch{return reply(500,{error:'Traitement SMS interrompu. Vérifiez le journal avant de réessayer.'});}
});
