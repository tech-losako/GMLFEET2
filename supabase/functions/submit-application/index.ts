import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
const headers={'Access-Control-Allow-Origin':'https://gmfleet.georgemichaellogistics.cd','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
const digest=async(bytes:BufferSource)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
const reference=(id:number,service:unknown,stamp=new Date())=>{
 const prefix=service==='Chauffeur Yango'?'YNG':service==='Gestion de flotte'?'FLT':['Recrutement','Recrutement Chauffeur'].includes(String(service))?'DRV':'CNG';
 return prefix+'-'+stamp.getUTCFullYear()+'-'+String(id).padStart(6,'0');
};
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
async function sendConfirmationSms(phone:string,requestReference:string){
 return sendSms(phone,`GM Fleet : demande ${requestReference} reçue. Notre équipe l'examine et vous appellera dès que le traitement sera terminé. Conservez votre récépissé.`,'Application confirmation');
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
  for(const phone of recipients){const status=await sendSms(phone,message,'Admin alert');if(status==='sent')sent++;else failed++;}
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
function fileType(b:Uint8Array){
 if(b[0]===255&&b[1]===216&&b[2]===255)return ['image/jpeg','jpg'];
 if([137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v))return ['image/png','png'];
 const s=new TextDecoder().decode(b.slice(0,12));
 if(s.startsWith('RIFF')&&s.slice(8,12)==='WEBP')return ['image/webp','webp'];
 if(s.startsWith('%PDF-'))return ['application/pdf','pdf'];
 throw new Error('Formats acceptés : JPG, PNG, WebP et PDF. Convertissez les autres formats avant l’envoi.');
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return reply(405,{error:'Méthode non autorisée'});
 try{
  // Public intake by design: only validated applicant fields enter privileged operations.
  const reader=req.body?.getReader();if(!reader)return reply(400,{error:'Formulaire vide'});
  const chunks:Uint8Array[]=[];let total=0;
  while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>22*1024*1024){await reader.cancel();return reply(413,{error:'Maximum 20 Mo de fichiers par demande'});}chunks.push(value);}
  const form=await new Response(new Blob(chunks),{headers:{'Content-Type':req.headers.get('Content-Type')||''}}).formData();
  const requestId=String(form.get('request_id')||'');if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(requestId))return reply(400,{error:'Identifiant de demande invalide'});
  const raw=String(form.get('application')||'');if(raw.length>20000)return reply(400,{error:'Formulaire trop long'});
  const input=JSON.parse(raw),app:Record<string,unknown>={};
  for(const [key,max] of Object.entries({name:200,phone:40,address:500,experience:500,co_borrower_name:200,co_borrower_phone:40,co_borrower_address:500,vehicle:200,license_file_name:250})){
   const value=input[key]==null?'':String(input[key]).trim();if(value.length>max)throw new Error('Champ trop long : '+key);app[key]=value||null;
  }
  if(!app.name||!app.phone||!app.vehicle)throw new Error('Nom, téléphone et véhicule ou service requis');
  if(!/^\+243[0-9]{9}$/.test(String(app.phone)))throw new Error('Téléphone invalide : saisissez 9 chiffres après +243');
  if(app.co_borrower_phone&&!/^\+243[0-9]{9}$/.test(String(app.co_borrower_phone)))throw new Error('Téléphone du co-emprunteur invalide');
  const service=input.service||null;if(service&&!['Chauffeur Yango','Gestion de flotte','Recrutement Chauffeur','Recrutement'].includes(service))throw new Error('Service invalide');
  app.service=service==='Recrutement'?'Recrutement Chauffeur':service;app.application_type=service?'service':'vehicle';
  const months=input.plan_duration_months==null?null:Number(input.plan_duration_months);if(months!==null&&![12,15,18].includes(months))throw new Error('Durée invalide');app.plan_duration_months=months;
  const details:Record<string,unknown>={};for(const key of ['email','idNumber','carBrand','carModel','carPlate','carYear','carChassis','permisFileName','permisRectoFileName','permisVersoFileName','carteRoseFileName','transportAuthorizationFileName','vignetteFileName','insuranceFileName','technicalInspectionFileName','frontPhotoFileName','rearPhotoFileName','leftPhotoFileName','rightPhotoFileName','interiorPhotoFileName','photosCount','cvFileName','licenseRectoFileName','licenseVersoFileName','dailyPayment','weeklyPayment','planTotal','initialDeposit']){const value=input.service_details?.[key];if(value!==undefined){if(!['string','number'].includes(typeof value)||String(value).length>500)throw new Error('Détail de formulaire invalide');details[key]=value;}}app.service_details=details;
  const files=form.getAll('files');if(files.length>10)throw new Error('Maximum 10 fichiers par demande');
  const manifest=[];const contents=[];let bytes=0;
  for(const [i,file] of files.entries()){
   if(!(file instanceof File)||file.size===0||file.size>10*1024*1024)throw new Error('Chaque fichier doit contenir entre 1 octet et 10 Mo');
   bytes+=file.size;if(bytes>20*1024*1024)throw new Error('Maximum 20 Mo de fichiers par demande');
   const buffer=new Uint8Array(await file.arrayBuffer()),[type,ext]=fileType(buffer),hash=await digest(buffer);
   manifest.push({name:file.name.slice(0,250),type,size:file.size,key:i+'-'+hash+'.'+ext});contents.push(buffer);
  }
  const fingerprint=await digest(new TextEncoder().encode(JSON.stringify({app,manifest})));
  const serviceClient=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:reservation,error:reserveError}=await serviceClient.rpc('reserve_public_submission',{p:{request_id:requestId,fingerprint,application:app,files:manifest}});
  if(reserveError)return reply(409,{error:reserveError.message});
  const submittedAt=new Date();
  if(reservation.completed)return reply(200,{success:true,application_id:reservation.application_id,reference:reference(reservation.application_id,app.service,submittedAt),submitted_at:submittedAt.toISOString(),sms_status:'previously_processed',admin_sms_status:'previously_processed',admin_push_status:'previously_processed'});
  for(const [i,file] of manifest.entries()){
   const path=reservation.application_id+'/'+requestId+'/'+file.key;
   const {error}=await serviceClient.storage.from('application-documents').upload(path,contents[i],{contentType:file.type,upsert:false});
   if(error&&!['409','Duplicate'].includes(String(error.statusCode))&&error.message!=='The resource already exists')return reply(503,{error:'Envoi de fichier interrompu. Vos données restent dans le formulaire : réessayez.'});
  }
  const {error:completeError}=await serviceClient.rpc('complete_public_submission',{request:requestId});
  if(completeError)return reply(503,{error:'Enregistrement interrompu. Réessayez pour terminer la demande.'});
  const requestReference=reference(reservation.application_id,app.service,submittedAt),smsStatus=await sendConfirmationSms(String(app.phone),requestReference);
  const adminBody=`Nouvelle candidature ${requestReference} : ${app.name} (${app.vehicle||app.service||'demande'}). Ouvrez l'espace opérations.`;
  const adminSmsStatus=await sendAdminSms(serviceClient,'GM Fleet admin : '+adminBody);
  const adminPushStatus=await sendAdminPush(serviceClient,'Nouvelle candidature GM Fleet',adminBody,{type:'application',application_id:String(reservation.application_id),reference:requestReference,url:'https://gmfleet.georgemichaellogistics.cd/admin.html'});
  return reply(200,{success:true,application_id:reservation.application_id,reference:requestReference,submitted_at:submittedAt.toISOString(),sms_status:smsStatus,admin_sms_status:adminSmsStatus,admin_push_status:adminPushStatus});
 }catch(error){return reply(400,{error:error instanceof Error?error.message:'Formulaire invalide'});}
});
