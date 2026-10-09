import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
const origin='https://gmfleet.georgemichaellogistics.cd';
const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function deliver(notification:{recipient:string;body:string}):Promise<{status:string;error?:string;messageId?:string}>{
 const username=Deno.env.get('AFRICASTALKING_USERNAME'),apiKey=Deno.env.get('AFRICASTALKING_API_KEY'),sender=Deno.env.get('AFRICASTALKING_SENDER_ID');
 if(!username||!apiKey)return {status:'not_configured',error:'Service SMS non configure'};
 const form=new URLSearchParams({username,to:notification.recipient,message:notification.body,enqueue:'true'});
 if(sender)form.set('from',sender);
 try{
  const endpoint=username==='sandbox'?'https://api.sandbox.africastalking.com/version1/messaging':'https://api.africastalking.com/version1/messaging';
  const response=await fetch(endpoint,{method:'POST',headers:{apiKey,'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body:form,signal:AbortSignal.timeout(15000)});
  if(!response.ok)return {status:response.status>=500?'unknown':'failed',error:'Service SMS HTTP '+response.status};
  const body=await response.json(),recipients=body?.SMSMessageData?.Recipients;
  if(!Array.isArray(recipients)||recipients.length!==1)return {status:'unknown',error:'Reponse du service SMS a verifier'};
  const result=recipients[0];
  if(result.status==='Success'&&Number(result.statusCode)===101&&typeof result.messageId==='string')return {status:'sent',messageId:result.messageId};
  return {status:'failed',error:'SMS refuse par le service ('+String(result.statusCode||'inconnu')+')'};
 }catch{return {status:'unknown',error:'Envoi SMS a verifier avant toute nouvelle tentative'};}
}

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return reply(405,{error:'Methode non autorisee'});
 try{
  const authorization=req.headers.get('Authorization')||'',url=Deno.env.get('SUPABASE_URL')!;
  const caller=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:identity,error:authError}=await caller.auth.getUser();
  if(authError||!identity.user)return reply(401,{error:'Reconnectez-vous'});
  const {data:staff,error:staffError}=await caller.from('staff_members').select('active,deleted_at').eq('user_id',identity.user.id).maybeSingle();
  if(staffError||!staff?.active||staff.deleted_at)return reply(403,{error:'Acces personnel requis'});
  const p=await req.json();let confirmation;
  if(p.appointment_id){
   if(!uuid.test(p.appointment_id))return reply(400,{error:'Rendez-vous invalide'});
   const {data:ap,error}=await caller.from('appointments').select('id,application_id,status').eq('id',p.appointment_id).maybeSingle();
   if(error||!ap)return reply(404,{error:'Rendez-vous introuvable'});
   if(!['scheduled','confirmed'].includes(ap.status))return reply(409,{error:'Ce rendez-vous est deja cloture'});
   const {data:n,error:notificationError}=await caller.from('operations_notifications').select('id,delivery_status').eq('appointment_id',ap.id).eq('kind','appointment').maybeSingle();
   if(notificationError||!n)return reply(409,{error:'Invitation SMS introuvable'});
   confirmation={appointment_id:ap.id,application_id:ap.application_id,notification_id:n.id,sms_status:n.delivery_status||'pending'};
  }else{
   if(!uuid.test(p.request_id)||!Number.isSafeInteger(p.application_id)||!Number.isInteger(p.revision)||!Number.isFinite(Date.parse(p.starts_at))||typeof p.location!=='string'||p.location.trim().length>500)return reply(400,{error:'Verifiez la date, l\u2019heure et l\u2019adresse'});
   const {data,error}=await caller.rpc('schedule_case_appointment',{p});
   if(error)return reply(409,{error:error.message});confirmation=data;
  }
  const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:claimed,error:claimError}=await service.rpc('claim_appointment_sms',{notification_id:confirmation.notification_id});
  if(claimError)return reply(200,{success:true,...confirmation,sms_status:'pending',sms_error:'Rendez-vous enregistre. Envoi SMS a reprendre.'});
  if(!claimed){
   const {data:n}=await caller.from('operations_notifications').select('delivery_status').eq('id',confirmation.notification_id).maybeSingle();
   return reply(200,{success:true,...confirmation,sms_status:n?.delivery_status||confirmation.sms_status});
  }
  const result=await deliver(claimed);
  const {error:saveError}=await service.from('operations_notifications').update({delivery_status:result.status,sent_at:result.status==='sent'?new Date().toISOString():null,provider_message_id:result.messageId||null,delivery_error:result.error||null}).eq('id',confirmation.notification_id).eq('delivery_status','sending');
  if(saveError)return reply(200,{success:true,...confirmation,sms_status:result.status==='sent'?'sent':'unknown',sms_error:'Etat SMS a verifier. Ne confirmez pas un second rendez-vous.'});
  return reply(200,{success:true,...confirmation,sms_status:result.status,sms_error:result.error||null});
 }catch{return reply(500,{error:'Confirmation interrompue. Reessayez sans modifier les informations.'});}
});
