import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const headers={'Access-Control-Allow-Origin':'https://gmfleet.georgemichaellogistics.cd','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
const reference=(requestId:string,stamp=new Date())=>'GML-CMD-'+stamp.getUTCFullYear()+'-'+requestId.replace(/-/g,'').slice(0,8).toUpperCase();
const phone=value=>{const digits=String(value||'').replace(/\D/g,'').replace(/^243/,'').replace(/^0/,'').slice(0,9);return digits.length===9?'+243'+digits:'';};

async function sendOrderSms(recipient:string,requestReference:string){
 const username=Deno.env.get('AFRICASTALKING_USERNAME'),apiKey=Deno.env.get('AFRICASTALKING_API_KEY'),senderId=Deno.env.get('AFRICASTALKING_SENDER_ID');
 if(!username||!apiKey)return 'not_configured';
 try{
  const form=new URLSearchParams({username,to:recipient,message:`GM Fleet : commande ${requestReference} reçue. Un professionnel vous contactera pour préciser votre besoin, confirmer le devis et planifier l'installation.`,enqueue:'true'});
  if(senderId)form.set('from',senderId);
  const endpoint=username==='sandbox'?'https://api.sandbox.africastalking.com/version1/messaging':'https://api.africastalking.com/version1/messaging';
  const response=await fetch(endpoint,{method:'POST',headers:{apiKey,'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},body:form});
  if(!response.ok)throw new Error(`Africa's Talking HTTP ${response.status}`);
  return 'sent';
 }catch(error){console.error('Equipment order SMS failed',error);return 'failed';}
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
  const smsStatus=data?.created===false?'previously_processed':await sendOrderSms(normalizedPhone,requestReference);
  return reply(200,{success:true,reference:requestReference,submitted_at:submittedAt.toISOString(),sms_status:smsStatus});
 }catch(error){return reply(400,{error:error instanceof Error?error.message:'Demande invalide'});}
});
