import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
const headers={'Access-Control-Allow-Origin':'https://gmfleet.georgemichaellogistics.cd','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return reply(405,{error:'Méthode non autorisée'});
 try{
  const url=Deno.env.get('SUPABASE_URL')!;
  const caller=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:req.headers.get('Authorization')||''}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:identity,error:authError}=await caller.auth.getUser();if(authError||!identity.user)return reply(401,{error:'Reconnectez-vous'});
  const p=await req.json();
  const {data:job,error:guardError}=await caller.rpc('begin_staff_email',{p});
  if(guardError)return reply(403,{error:guardError.message});
  const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:current,error:readError}=await service.auth.admin.getUserById(job.target_id);
  if(readError)return reply(503,{error:'Modification en attente. Réessayez avec la même adresse.'});
  let updateError=null;
  if(current.user.email?.toLowerCase()!==job.new_email){
   const result=await service.auth.admin.updateUserById(job.target_id,{email:job.new_email});updateError=result.error;
  }
  const {data:finished,error:finishError}=await service.rpc('finish_staff_email',{job_id:job.id});
  if(finishError)return reply(503,{error:'Vérification en attente. Réessayez avec la même adresse.'});
  if(finished.state!=='completed')return reply(400,{error:updateError?'Adresse non modifiée. Vérifiez qu’elle est valide et qu’aucun autre compte ne l’utilise.':'Adresse non modifiée. Actualisez puis réessayez.'});
  return reply(200,{email:job.new_email,revision:finished.revision});
 }catch{return reply(503,{error:'Modification interrompue. Réessayez avec la même adresse.'});}
});
