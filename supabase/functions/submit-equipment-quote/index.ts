import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const headers={'Access-Control-Allow-Origin':'https://gmfleet.georgemichaellogistics.cd','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
const reference=(requestId:string,stamp=new Date())=>'GML-CMD-'+stamp.getUTCFullYear()+'-'+requestId.replace(/-/g,'').slice(0,8).toUpperCase();
const phone=value=>{const digits=String(value||'').replace(/\D/g,'').replace(/^243/,'').replace(/^0/,'').slice(0,9);return digits.length===9?'+243'+digits:'';};
let firebaseTokenCache=null;

async function sendSms(to,message,logPrefix){
 const username=Deno.env.get('AFRICASTALKING_USERNAME'),apiKey=Deno.env.get('AFRICASTALKING_API_KEY'),senderId=Deno.env.get('AFRICASTALKING_SENDER_ID');
 if(!username||!apiKey)return 'not_configured';
 try{
  const form=new URLSearchParams({username,to,message,enqueue:'true'});
  if(senderId)form.set('from',senderId);
  const endpoint=username==='sandbox'?'https://api.sandbox.africastalking.com/version1/messaging':'https://api.africastalking.com/version1/messaging';
  const response=await fetch(endpoint,{method:'POST',headers:{apiKey,'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},body:form});
  if(!response.ok)throw new Error(`Africa's Talking HTTP ${response.status}`);
  return 'sent';
 }catch(error){console.error(logPrefix+' SMS failed',error);return 'failed';}
}
async function sendOrderSms(recipient:string,requestReference:string){
 return sendSms(recipient,`GM Fleet : commande ${requestReference} reçue. Un professionnel vous contactera pour préciser votre besoin, confirmer le devis et planifier l'installation.`,'Equipment order');
}
async function adminStaff(client){
 const {data,error}=await client.from('staff_members').select('user_id,phone').eq('active',true).in('role',['super_admin','admin']);
 if(error)throw error;
 return data||[];
}
async function sendAdminSms(client,message){
 if(!Deno.env.get('AFRICASTALKING_USERNAME')||!Deno.env.get('AFRICASTALKING_API_KEY'))return 'not_configured';
 try{
  const recipients=(await adminStaff(client)).map(row=>row.phone).filter(Boolean);
  if(!recipients.length)return 'no_recipients';
  let sent=0,failed=0;
  for(const recipient of recipients){const status=await sendSms(recipient,message,'Admin alert');if(status==='sent')sent++;else failed++;}
  return sent&&failed?'partial':sent?'sent':'failed';
 }catch(error){console.error('Admin SMS lookup failed',error);return 'failed';}
}
const encodeBase64Url=value=>btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
function privateKeyBytes(pem){
 const normalized=String(pem||'').replace(/\\n/g,'\n');
 const base64=normalized.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,'');
 const binary=atob(base64),bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 return bytes.buffer;
}
async function firebaseAccessToken(){
 const clientEmail=Deno.env.get('FIREBASE_CLIENT_EMAIL'),privateKey=String(Deno.env.get('FIREBASE_PRIVATE_KEY')||'').replace(/\\n/g,'\n');
 if(firebaseTokenCache&&firebaseTokenCache.expiresAt>Date.now()+60000)return firebaseTokenCache.token;
 const now=Math.floor(Date.now()/1000);
 const header=encodeBase64Url(new TextEncoder().encode(JSON.stringify({alg:'RS256',typ:'JWT'})));
 const claim=encodeBase64Url(new TextEncoder().encode(JSON.stringify({iss:clientEmail,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600})));
 const key=await crypto.subtle.importKey('pkcs8',privateKeyBytes(privateKey),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const signature=encodeBase64Url(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(header+'.'+claim)));
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:header+'.'+claim+'.'+signature})});
 if(!response.ok)throw new Error('Firebase OAuth HTTP '+response.status);
 const json=await response.json();
 if(!json.access_token)throw new Error('Firebase OAuth token missing');
 firebaseTokenCache={token:json.access_token,expiresAt:Date.now()+Math.max(1,(json.expires_in||3600)-60)*1000};
 return firebaseTokenCache.token;
}
async function sendAdminPush(client,title,body,data){
 const projectId=Deno.env.get('FIREBASE_PROJECT_ID'),clientEmail=Deno.env.get('FIREBASE_CLIENT_EMAIL'),privateKey=String(Deno.env.get('FIREBASE_PRIVATE_KEY')||'');
 if(!projectId||!clientEmail||!privateKey.includes('BEGIN PRIVATE KEY'))return 'not_configured';
 try{
  const admins=await adminStaff(client),ids=admins.map(row=>row.user_id);
  if(!ids.length)return 'no_recipients';
  const {data:tokens,error}=await client.from('staff_push_tokens').select('token').eq('active',true).in('user_id',ids);
  if(error)throw error;
  if(!tokens?.length)return 'no_recipients';
  const accessToken=await firebaseAccessToken();
  let sent=0,failed=0;
  for(const row of tokens){
   const response=await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`,{method:'POST',headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},body:JSON.stringify({message:{token:row.token,notification:{title,body},data,webpush:{fcm_options:{link:data.url||'https://gmfleet.georgemichaellogistics.cd/admin.html'}}}})});
   if(response.ok)sent++;else{failed++;console.error('Firebase push failed',response.status,await response.text());}
  }
  return sent&&failed?'partial':sent?'sent':'failed';
 }catch(error){console.error('Firebase push failed',error);return 'failed';}
}

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return reply(405,{error:'Méthode non autorisée'});
 try{
  const body=await req.json(),requestId=String(body.request_id||''),payload=body.p;
  if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(requestId)||!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('Demande invalide');
  const normalizedPhone=phone(payload.phone);if(!normalizedPhone)throw new Error('Téléphone invalide : saisissez 9 chiffres après +243');
  const application={...payload,phone:normalizedPhone};
  const serviceClient=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await serviceClient.rpc('submit_equipment_quote',{request_id:requestId,p:application});
  if(error)throw new Error(error.message);
  const submittedAt=new Date(),requestReference=reference(requestId,submittedAt);
  if(data?.created===false)return reply(200,{success:true,reference:requestReference,submitted_at:submittedAt.toISOString(),sms_status:'previously_processed',admin_sms_status:'previously_processed',admin_push_status:'previously_processed'});
  const smsStatus=await sendOrderSms(normalizedPhone,requestReference);
  const labels={gps:'Tracker GPS',dashcam:'Dashcam',both:'Tracker GPS + dashcam'};
  const adminBody=`Nouvelle demande de devis ${requestReference} : ${application.name} (${labels[application.equipment]||application.equipment}). Ouvrez l'espace opérations.`;
  const adminSmsStatus=await sendAdminSms(serviceClient,'GM Fleet admin : '+adminBody);
  const adminPushStatus=await sendAdminPush(serviceClient,'Nouvelle demande de devis GM Fleet',adminBody,{type:'quote',quote_id:requestId,reference:requestReference,url:'https://gmfleet.georgemichaellogistics.cd/admin.html'});
  return reply(200,{success:true,reference:requestReference,submitted_at:submittedAt.toISOString(),sms_status:smsStatus,admin_sms_status:adminSmsStatus,admin_push_status:adminPushStatus});
 }catch(error){return reply(400,{error:error instanceof Error?error.message:'Demande invalide'});}
});
