import { whatsappOptions, providerWhatsApp, encryptWhatsAppRuntime, decryptWhatsAppRuntime, whatsappRuntimeParameters } from './whatsapp.ts';
// One provider adapter and persisted, atomic claim for every SMS sender.
export const smsPhone=(v:unknown)=>{const s=String(v??'').replace(/[\s()-]/g,'');const d=s.replace(/^\+?243/,'').replace(/^0/,'');return /^[0-9]{9}$/.test(d)?'+243'+d:'';};
export async function smsRpc(db:any,name:string,p?:unknown){const {data,error}=await db.rpc(name,p===undefined?{}:{p});if(error)throw Error('Journal SMS indisponible : '+error.message);return data;}
export async function providerSMS(to:string,message:string){
 const username=Deno.env.get('AFRICASTALKING_USERNAME'),apiKey=Deno.env.get('AFRICASTALKING_API_KEY'),sender=Deno.env.get('AFRICASTALKING_SENDER_ID'),sandbox=username==='sandbox';
 if(!username||!apiKey)return {status:'not_configured',error:'Service SMS non configuré',sandbox};
 if(!smsPhone(to))return {status:'failed',error:'Numéro invalide : +243 suivi de 9 chiffres',sandbox};
 const body=new URLSearchParams({username,to,message,enqueue:'true'});if(sender)body.set('from',sender);
 try{
  const r=await fetch('https://api.'+(sandbox?'sandbox.':'')+'africastalking.com/version1/messaging',{method:'POST',headers:{apiKey,'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body,signal:AbortSignal.timeout(15000)});
  if(!r.ok)return {status:r.status>=500||r.status===408?'unknown':'failed',error:'Service SMS HTTP '+r.status,sandbox};
  const json=await r.json(),recipients=json?.SMSMessageData?.Recipients;
  if(!Array.isArray(recipients)||recipients.length!==1)return {status:'unknown',error:'Réponse SMS incomplète : vérifier avant de renvoyer',sandbox};
  const n=recipients[0],code=Number(n.statusCode),id=typeof n.messageId==='string'&&n.messageId.length<=160?n.messageId:undefined;
  if([100,101,102].includes(code)&&id)return {status:code===101?'sent':'accepted',message_id:id,code,sandbox};
  const errors:Record<number,string>={401:'Envoi bloqué par le contrôle du fournisseur',402:'Nom expéditeur non approuvé',403:'Numéro de téléphone refusé',404:'Type de numéro non pris en charge',405:'Solde Africa’s Talking insuffisant',406:'Destinataire sur liste de blocage',407:'Route opérateur indisponible',500:'Erreur interne du service SMS',501:'Erreur passerelle SMS',502:'Message rejeté par la passerelle'};
  return {status:[100,101,102].includes(code)?'unknown':'failed',code:Number.isFinite(code)?code:undefined,error:errors[code]||'Réponse SMS à vérifier ('+String(n.statusCode??'inconnu')+')',sandbox};
 }catch{return {status:'unknown',error:'Envoi interrompu : vérifier avant de renvoyer',sandbox};}
}
export async function sendTrackedSMS(db:any,p:any,message:string|(()=>Promise<string>)){
 const saved=await smsRpc(db,'reserve_sms_dispatch',{...p,body:p.sensitive?null:typeof message==='string'?message:null});
 return sendReservedSMS(db,saved,message,!!p.retry);
}
export async function sendReservedSMS(db:any,saved:any,message?:string|(()=>Promise<string|null>),retry=false){
 const isTest=saved.kind==='whatsapp_test'&&!saved.fallback_of,options=saved.whatsapp_template?await whatsappOptions(isTest):null;
 if(isTest&&(!options?.configured||(saved.whatsapp_template!=='GMFLEET_INVALID_TEMPLATE_TEST'&&!options.approved.includes(saved.whatsapp_template)))){await smsRpc(db,'cancel_whatsapp_notification',{id:saved.id,reason:'Configuration ou modèle WhatsApp non vérifié'});return {id:saved.id,status:'not_configured',error:'Configuration ou modèle WhatsApp non vérifié'};}
 const claimed=await smsRpc(db,'claim_sms_dispatch',{id:saved.id,retry,whatsapp_enabled:!!options?.enabled,approved_templates:options?.approved||[],whatsapp_test:isTest&&!!options?.configured});
 if(!claimed)return {id:saved.id,status:saved.status,error:saved.error,replayed:true};
 let text:string|null;
 try{if(claimed.fallback_of&&claimed.sensitive&&!message){const envelope=await smsRpc(db,'get_whatsapp_payload',{id:claimed.id});if(!envelope?.ciphertext||Date.parse(envelope.expires_at)<=Date.now()){await smsRpc(db,'cancel_whatsapp_notification',{id:claimed.id,reason:'Lien privé expiré : renouveler depuis le dossier'});return {id:claimed.id,status:'cancelled'};}text=(await decryptWhatsAppRuntime(envelope.source_id,envelope.ciphertext)).sms;}else text=typeof message==='function'?await message():claimed.body||message||'';}catch(error){await smsRpc(db,'finish_sms_dispatch',{id:claimed.id,status:'failed',error:'Préparation du message interrompue'});throw error;}
 if(text===null)return {id:claimed.id,status:'cancelled'};
 if(claimed.channel==='whatsapp'){
  let result:any;
  try{
   const payload=await smsRpc(db,'get_whatsapp_payload',{id:claimed.id});
   const envelope=await encryptWhatsAppRuntime(claimed.id,{sms:text});
   const expires_at=new Date(Date.now()+(claimed.kind==='staff_invitation'?30*60*1000:48*3600000)).toISOString();
   if(!await smsRpc(db,'save_whatsapp_runtime',{id:claimed.id,ciphertext:envelope,expires_at}))throw Error('Private transport unavailable');
   const parameters=whatsappRuntimeParameters(payload,text);
   result=await providerWhatsApp(claimed.recipient,payload.template,parameters);
  }catch{result={status:'failed',error_code:0};}
  try{const finished=await smsRpc(db,'finish_whatsapp_dispatch',{id:claimed.id,...result});return {...finished,id:claimed.id,channel:'whatsapp',error:finished.fallback?'WhatsApp refusé ; repli SMS mis en file':finished.error};}
  catch{return {id:claimed.id,status:'unknown',channel:'whatsapp',error:'État WhatsApp non enregistré : vérifier avant de renvoyer'};}
 }
 const result=await providerSMS(claimed.recipient,text);
 try{const finished=await smsRpc(db,'finish_sms_dispatch',{id:claimed.id,...result});return {...result,...finished,id:claimed.id};}
 catch{return {id:claimed.id,status:'unknown',error:'État SMS non enregistré : vérifier avant de renvoyer'};}
}
export async function queuedSMS(db:any,p:any){return sendTrackedSMS(db,p,p.body||'');}
export async function sameSecret(a:string,b:string){if(!a||!b)return false;const hash=async(s:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));const [x,y]=await Promise.all([hash(a),hash(b)]);let v=0;for(let i=0;i<x.length;i++)v|=x[i]^y[i];return v===0;}
