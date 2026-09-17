import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
const headers={'Access-Control-Allow-Origin':'https://gmfleet.georgemichaellogistics.cd','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
const digest=async(bytes:BufferSource)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
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
  const service=input.service||null;if(service&&!['Chauffeur Yango','Gestion de flotte','Recrutement Chauffeur','Recrutement'].includes(service))throw new Error('Service invalide');
  app.service=service==='Recrutement'?'Recrutement Chauffeur':service;app.application_type=service?'service':'vehicle';
  const months=input.plan_duration_months==null?null:Number(input.plan_duration_months);if(months!==null&&![12,15,18].includes(months))throw new Error('Durée invalide');app.plan_duration_months=months;
  const details:Record<string,unknown>={};for(const key of ['email','idNumber','carBrand','carModel','carPlate','carYear','carChassis','permisFileName','carteRoseFileName','photosCount','cvFileName']){const value=input.service_details?.[key];if(value!==undefined){if(!['string','number'].includes(typeof value)||String(value).length>500)throw new Error('Détail de formulaire invalide');details[key]=value;}}app.service_details=details;
  const files=form.getAll('files');if(files.length>8)throw new Error('Maximum 8 fichiers par demande');
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
  if(reservation.completed)return reply(200,{success:true});
  for(const [i,file] of manifest.entries()){
   const path=reservation.application_id+'/'+requestId+'/'+file.key;
   const {error}=await serviceClient.storage.from('application-documents').upload(path,contents[i],{contentType:file.type,upsert:false});
   if(error&&!['409','Duplicate'].includes(String(error.statusCode))&&error.message!=='The resource already exists')return reply(503,{error:'Envoi de fichier interrompu. Vos données restent dans le formulaire : réessayez.'});
  }
  const {error:completeError}=await serviceClient.rpc('complete_public_submission',{request:requestId});
  if(completeError)return reply(503,{error:'Enregistrement interrompu. Réessayez pour terminer la demande.'});
  return reply(200,{success:true});
 }catch(error){return reply(400,{error:error instanceof Error?error.message:'Formulaire invalide'});}
});
