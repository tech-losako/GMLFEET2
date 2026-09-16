import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
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
  const {data:staff}=await caller.from('staff_members').select('role,active').eq('user_id',identity.user.id).maybeSingle();
  if(!staff?.active||staff.role!=='super_admin')return reply(403,{error:'Accès réservé au Super Admin'});
  const p=await req.json();
  const email=String(p.email||'').trim().toLowerCase(),name=String(p.display_name||'').trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||!name||name.length>200||!['super_admin','admin','cashier','agent'].includes(p.role))return reply(400,{error:'Vérifiez le nom, l’e-mail et le rôle'});
  const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  // Existing active staff may receive an explicit password reset link.
  let type:'invite'|'recovery'='invite';
  if(p.user_id){
   const {data:existing}=await service.auth.admin.getUserById(p.user_id);
   const {data:member}=await caller.from('staff_members').select('*').eq('user_id',p.user_id).maybeSingle();
   if(!member?.active||!existing.user||existing.user.email?.toLowerCase()!==email)return reply(400,{error:'Le compte doit être actif et correspondre à cette adresse'});
   type=existing.user.email_confirmed_at?'recovery':'invite';
  }
  const {data,error}=await service.auth.admin.generateLink({type,email});
  if(error||!data.user||!data.properties?.hashed_token)return reply(400,{error:'Invitation impossible. Vérifiez l’adresse ; un compte déjà activé ne peut pas être réinvité.'});
  const {error:saveError}=await caller.rpc('manage_staff',{p:{user_id:data.user.id,display_name:name,role:p.role,active:true,revision:p.revision||0}});
  if(saveError)return reply(409,{error:saveError.message});
  return reply(200,{link:origin+'/set-password.html#token_hash='+encodeURIComponent(data.properties.hashed_token)+'&type='+type,email});
 }catch{return reply(500,{error:'Invitation indisponible. Actualisez et réessayez.'});}
});
