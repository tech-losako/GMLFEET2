import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { sendTrackedSMS, smsPhone } from '../_shared/sms.ts';
const origin='https://gmfleet.georgemichaellogistics.cd';
const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, x-client-info, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store','Referrer-Policy':'no-referrer'};
const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(b=>b.toString(16).padStart(2,'0')).join('');
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});if(req.method!=='POST')return reply(405,{error:'Méthode non autorisée'});
 try{
  const p=await req.json(),url=Deno.env.get('SUPABASE_URL')!,service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  if(p.action==='download'){
   if(!/^[a-f0-9]{64}$/.test(String(p.token||'')))return reply(404,{error:'Lien invalide ou expiré'});
   const {data:s,error}=await service.from('contract_sms_shares').select('object_path,expires_at,revoked_at').eq('token_hash',await hash(p.token)).maybeSingle();
   if(error||!s||s.revoked_at||new Date(s.expires_at).getTime()<=Date.now())return reply(404,{error:'Lien invalide ou expiré. Demandez une nouvelle copie à GM Fleet.'});
   const {data,error:failed}=await service.storage.from('contract-copies').createSignedUrl(s.object_path,120,{download:'Contrat-GM-Fleet.pdf'});if(failed)throw failed;
   return reply(200,{url:data.signedUrl});
  }
  const caller=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:req.headers.get('Authorization')||''}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:identity,error:authError}=await caller.auth.getUser();if(authError||!identity.user)return reply(401,{error:'Reconnectez-vous'});
  const {data:staff}=await caller.from('staff_members').select('active,deleted_at').eq('user_id',identity.user.id).maybeSingle();if(!staff?.active||staff.deleted_at)return reply(403,{error:'Accès personnel requis'});
  if(p.action!=='send'||!Number.isSafeInteger(p.application_id)||p.application_id<=0||!/^[a-f0-9-]{36}$/i.test(String(p.request_id||'')))return reply(400,{error:'Dossier et identifiant requis'});
  const path=p.application_id+'/'+p.request_id+'.pdf';if(p.object_path!==path)return reply(400,{error:'Copie invalide'});
  const {data:a,error:appError}=await caller.from('applications').select('id,phone,program_type').eq('id',p.application_id).maybeSingle();
  if(appError||!a||!['FLEET_OWNER','PARTNER_DRIVER','YANGO'].includes(a.program_type))return reply(400,{error:'Modèle de contrat indisponible pour ce dossier'});
  const phone=smsPhone(a.phone);if(!phone)return reply(400,{error:'Corrigez le téléphone du dossier avant l’envoi'});
  const {data:existing,error:lookupError}=await service.from('contract_sms_shares').select('id,application_id,created_by,recipient,object_path').eq('id',p.request_id).maybeSingle();if(lookupError)throw lookupError;
  if(existing){
   if(existing.application_id!==a.id||existing.created_by!==identity.user.id||existing.object_path!==path)return reply(409,{error:'Identifiant déjà utilisé'});
   const {data:message}=await service.from('sms_dispatches').select('status,error').eq('event_key','contract-copy:'+p.request_id).maybeSingle();
   return reply(200,{success:true,replayed:true,sms_status:message?.status||'unknown',sms_error:message?.error||'Consultez le suivi SMS avant tout nouvel envoi.'});
  }
  // Read through the caller's storage policy; only the caller's own new PDF can be shared.
  const {data:validCopy,error:copyError}=await caller.rpc('validate_contract_copy',{p:{object_path:path}});
  if(copyError||!validCopy)return reply(400,{error:'Copie PDF privée introuvable ou créée par un autre agent'});
  const {data:pdf,error:pdfError}=await caller.storage.from('contract-copies').download(path);if(pdfError||!pdf||pdf.size>10485760||!new TextDecoder().decode(await pdf.slice(0,5).arrayBuffer()).startsWith('%PDF-'))return reply(400,{error:'PDF invalide'});
  const token=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b=>b.toString(16).padStart(2,'0')).join('');
  const {error:saveError}=await service.from('contract_sms_shares').insert({id:p.request_id,application_id:a.id,created_by:identity.user.id,object_path:path,recipient:phone,token_hash:await hash(token)});if(saveError){if(saveError.code==='23505')return reply(409,{error:'Envoi déjà en cours. Consultez le suivi SMS.'});throw saveError;}
  const link=origin+'/contrat.html#token='+token;
  const result=await sendTrackedSMS(service,{event_key:'contract-copy:'+p.request_id,kind:'contract_copy',recipient:phone,application_id:a.id,actor_id:identity.user.id,sensitive:true},'GM Fleet : votre '+(a.program_type==='YANGO'?'document':'contrat prérempli à lire et signer')+' : '+link+' Valable 7 jours. Contactez GM Fleet pour remettre la copie signée.');
  return reply(200,{success:true,sms_status:result.status,sms_error:result.error||null});
 }catch{return reply(500,{error:'Envoi interrompu. Vérifiez le suivi SMS avant de réessayer.'});}
});
