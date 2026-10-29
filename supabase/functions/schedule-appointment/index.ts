import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { sendTrackedSMS } from "../_shared/sms.ts";
const origin='https://gmfleet.georgemichaellogistics.cd';
const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;


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
  const {data:n,error:nError}=await service.from('operations_notifications').select('id,recipient,body,application_id,appointment_id,delivery_status').eq('id',confirmation.notification_id).single();
  if(nError||!n)return reply(200,{success:true,...confirmation,sms_status:'pending',sms_error:'Rendez-vous enregistré. Envoi SMS à reprendre.'});
  if(['accepted','sent','delivered','unknown','sending'].includes(n.delivery_status))return reply(200,{success:true,...confirmation,sms_status:n.delivery_status});
  const result=await sendTrackedSMS(service,{event_key:'notification:'+n.id,kind:'appointment',recipient:n.recipient,body:n.body,application_id:n.application_id,appointment_id:n.appointment_id,notification_id:n.id,retry:!!p.appointment_id},n.body);
  return reply(200,{success:true,...confirmation,sms_status:result.status,sms_error:result.error||null});
 }catch{return reply(500,{error:'Confirmation interrompue. Reessayez sans modifier les informations.'});}
});
