import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { sendTrackedSMS, smsPhone } from "../_shared/sms.ts";
const origin = 'https://gmfleet.georgemichaellogistics.cd';
const headers = {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply = (status:number, data:unknown) => new Response(JSON.stringify(data), {status,headers});
Deno.serve(async req => {
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return reply(405,{error:'Méthode non autorisée'});
 try {
  const authorization=req.headers.get('Authorization')||'';
  const url=Deno.env.get('SUPABASE_URL')!;
  const caller=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:identity,error:authError}=await caller.auth.getUser();
  if(authError||!identity.user)return reply(401,{error:'Reconnectez-vous'});
  const {data:staff}=await caller.from('staff_members').select('role,active,deleted_at').eq('user_id',identity.user.id).maybeSingle();
  if(!staff?.active||staff.deleted_at||staff.role!=='super_admin')return reply(403,{error:'Accès réservé au Super Admin'});
  const p=await req.json();
  const email=String(p.email||'').trim().toLowerCase(),name=String(p.display_name||'').trim(),phone=smsPhone(p.phone);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||!name||name.length>200||!['super_admin','admin','cashier','agent'].includes(p.role))return reply(400,{error:'Vérifiez le nom, l’e-mail et le rôle'});
  if(!phone)return reply(400,{error:'Téléphone administratif invalide : utilisez +243 suivi de 9 chiffres'});
  const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(String(p.request_id||'')))return reply(400,{error:'Identifiant d’invitation requis'});
  // Existing active staff may receive an explicit password reset link.
  let type:'invite'|'recovery'='invite';
  if(p.user_id){
   const {data:existing}=await service.auth.admin.getUserById(p.user_id);
   const {data:member}=await caller.from('staff_members').select('*').eq('user_id',p.user_id).maybeSingle();
   if(!member?.active||member.deleted_at||!existing.user||existing.user.email?.toLowerCase()!==email)return reply(400,{error:'Le compte doit être actif et correspondre à cette adresse'});
   if(smsPhone(member.phone)!==phone)return reply(400,{error:'Enregistrez le téléphone de cet utilisateur avant de renouveler son lien.'});
   type=existing.user.email_confirmed_at?'recovery':'invite';
  }
  let link:string|undefined;
  const payload_hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({email,name,phone,role:p.role,user_id:p.user_id||null}))))).map(n=>n.toString(16).padStart(2,'0')).join('');
  const result=await sendTrackedSMS(service,{event_key:'staff-invite:'+p.request_id,kind:type==='recovery'?'staff_recovery':'staff_invitation',recipient:phone,sensitive:true,payload_hash,actor_id:identity.user.id},async()=>{
   const {data,error}=await service.auth.admin.generateLink({type,email});
   if(error||!data.user||!data.properties?.hashed_token)throw Error('Invitation impossible. Vérifiez l’adresse et le compte.');
   const {error:saveError}=await caller.rpc('manage_staff',{p:{user_id:data.user.id,display_name:name,phone,role:p.role,active:true,revision:p.revision||0}});
   if(saveError)throw Error(saveError.message);
   link=origin+'/set-password.html#token_hash='+encodeURIComponent(data.properties.hashed_token)+'&type='+type;
   return 'GM Fleet : '+(type==='recovery'?'choisissez un nouveau mot de passe':'activez votre accès personnel')+'.\n'+link+'\nLien personnel à usage unique. Ne le partagez pas.';
  });
  return reply(200,{link,email,phone,sms_status:result.status,sms_error:result.error||null,sms_id:result.id,replayed:!!result.replayed});
 }catch{return reply(500,{error:'Invitation indisponible. Actualisez et réessayez.'});}
});
