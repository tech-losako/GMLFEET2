import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
const site='https://gmfleet.georgemichaellogistics.cd';
const headers={'Access-Control-Allow-Origin':site,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, GET, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store','Referrer-Policy':'no-referrer'};
const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,'0')).join('');
const secretToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b=>b.toString(16).padStart(2,'0')).join('');
let cachedToken='',tokenUntil=0;
function configuration(){
 const names=['ARAKA_EMAIL','ARAKA_PASSWORD','ARAKA_PAYMENT_PAGE_ID','ARAKA_BASE_URL'];
 if(names.some(n=>!Deno.env.get(n)))throw new Error('Configuration Araka incomplète. Contactez GM Fleet.');
 const endpoint=new URL(Deno.env.get('ARAKA_BASE_URL')!.trim());
 // Araka's production merchant frontend publishes this API origin.
 if(endpoint.hostname==='merchant.arakapay.com'&&['/','/auth/login','/auth/login/'].includes(endpoint.pathname)&&endpoint.protocol==='https:'&&!endpoint.username&&!endpoint.password&&!endpoint.search){
  endpoint.hostname='pcesarakapayprodapi01.eastus.cloudapp.azure.com';endpoint.pathname='/';endpoint.hash='';
 }
 if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.search||(endpoint.hostname!=='pcesarakapayprodapi01.eastus.cloudapp.azure.com'&&!/(^|\.)arakapay\.com$|(^|\.)proxypay\.africa$|^araka[-a-z0-9]*\.azurewebsites\.net$/i.test(endpoint.hostname)))throw new Error('Adresse API Araka à vérifier dans la configuration.');
 // Normalize standard API/documentation addresses without accepting arbitrary paths.
 if(!/^\/(?:api\/?|swagger(?:\/index\.html|\/v[0-9]+\/swagger\.json)?\/?)?$/i.test(endpoint.pathname))throw new Error('Adresse API Araka invalide : utilisez la racine API ou son adresse Swagger.');
 const base=endpoint.origin;
 return {base,test:/uat|sandbox|staging|test/i.test(endpoint.hostname),page:Deno.env.get('ARAKA_PAYMENT_PAGE_ID')!};
}
async function login(){
 if(cachedToken&&Date.now()<tokenUntil)return cachedToken;
 const {base}=configuration();
 const r=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({emailAddress:Deno.env.get('ARAKA_EMAIL'),password:Deno.env.get('ARAKA_PASSWORD')}),signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw new Error('Connexion Araka impossible. Vérifiez les identifiants et l’activation API.');
 const data=await r.json();if(typeof data.token!=='string'||!data.token)throw new Error('Réponse de connexion Araka invalide.');
 cachedToken=data.token;tokenUntil=Date.now()+240000;return cachedToken;
}
async function api(path:string,body?:unknown){
 const token=await login(),{base}=configuration();
 const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
 if(r.status===401){cachedToken='';tokenUntil=0;}
 const data=await r.json().catch(()=>null);return {http:r.status,data};
}
async function checkCollectionRoute(){
 if(configuration().base!=='https://pcesarakapayprodapi01.eastus.cloudapp.azure.com')return;
 // A GET cannot initiate a payment. The merchant API may not expose the e-commerce API.
 const result=await api('/api/pay/paymentrequest');
 if(result.http===404)throw new Error('Paiement indisponible : cette adresse Araka ne fournit pas l’API e-commerce. GM Fleet doit configurer l’adresse de production fournie par Araka. Aucune demande de paiement envoyée.');
 if(result.http!==405&&result.http!==200)throw new Error('API de paiement Araka indisponible. Aucune demande de paiement envoyée.');
}
async function rpc(db:any,name:string,p:any){const {data,error}=await db.rpc(name,p);if(error)throw new Error(error.message);return data;}
async function verify(db:any,attempt:any,force=false){
 if(attempt.state==='approved')return 'approved';
 if(configuration().test)throw new Error('Vérification suspendue : environnement Araka de test.');
 // Rate-limit repeated browser/callback checks for this attempt.
 if(!force&&attempt.last_checked_at&&Date.now()-Date.parse(attempt.last_checked_at)<10000)return attempt.state;
 const byId=!!attempt.transaction_id;
 const lookup=await api('/api/reporting/'+(byId?'transactionstatus/':'transactionstatusbyreference/')+encodeURIComponent(byId?attempt.transaction_id:attempt.reference));
 const data=lookup.data;
 if(lookup.http!==200||!data||typeof data.transactionId!=='string')throw new Error('Vérification Araka indisponible (HTTP '+lookup.http+', code '+String(data?.statusCode??'absent').slice(0,20)+'). Référence : '+attempt.reference+'. Aucun nouveau débit ne sera lancé.');
 // A lost initiation response requires the provider to echo our reference before trusting the recovered transaction ID.
 const matches=byId?data.transactionId===attempt.transaction_id:[data.originatingTransactionId,data.transactionReference].includes(attempt.reference);
 if(!matches)return attempt.state;
 if(data.currency!==undefined&&data.currency!==attempt.currency)return attempt.state;
 if(data.amount!==undefined&&Number(data.amount)!==Number(attempt.total_charged))return attempt.state;
 const status=String(data.statusDescription||data.status||'').toUpperCase();
 const approved=status==='APPROVED'&&Number(data.statusCode)===200;
 const declined=status==='DECLINED'&&Number(data.statusCode)===400;
 return rpc(db,'record_araka_status',{p:{id:attempt.id,transaction_id:data.transactionId,status:approved?'APPROVED':declined?'DECLINED':'PENDING'}});
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 try{
  const url=new URL(req.url),supabaseUrl=Deno.env.get('SUPABASE_URL')!;
  const db=createClient(supabaseUrl,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const callback=url.searchParams.get('callback');
  if(callback){
   // The callback capability authenticates this notification only. Its body can never mark a payment approved.
   if(!/^[a-f0-9]{64}$/.test(callback))return reply(401,{error:'Notification invalide'});
   const {data:attempt}=await db.from('araka_attempts').select('*').eq('callback_hash',await hash(callback)).maybeSingle();
   if(!attempt)return reply(401,{error:'Notification invalide'});
   await verify(db,attempt,true);
   if(req.method==='GET'||req.headers.get('accept')?.includes('text/html'))return new Response(null,{status:303,headers:{...headers,Location:site+'/payer.html'}});
   return reply(200,{received:true});
  }
  if(req.method!=='POST')return reply(405,{error:'Méthode non autorisée'});
  const raw=await req.text();if(raw.length>5000)return reply(400,{error:'Requête trop longue'});const p=JSON.parse(raw);
  if(p.action==='driver-lookup'){
   if(typeof p.phone!=='string'||p.phone.length>30||typeof p.plate!=='string'||p.plate.length>40)return reply(400,{error:'Téléphone et plaque requis.'});
   const token=secretToken();
   const result=await rpc(db,'issue_driver_plate_access',{p:{phone:p.phone,plate:p.plate,token_hash:await hash(token),ip_hash:await hash(req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown')}});
   if(!result.ok)return reply(result.limited?429:400,{error:result.error});
   return reply(200,{token});
  }
  if(['health','staff-check'].includes(p.action)){
   const caller=createClient(supabaseUrl,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:req.headers.get('Authorization')||''}},auth:{persistSession:false,autoRefreshToken:false}});
   const {data:identity,error}=await caller.auth.getUser();if(error||!identity.user)return reply(401,{error:'Reconnectez-vous'});
   const {data:staff}=await caller.from('staff_members').select('role,active').eq('user_id',identity.user.id).maybeSingle();
   if(!staff?.active||!['super_admin','admin','cashier'].includes(staff.role))return reply(403,{error:'Accès réservé à la caisse'});
   if(p.action==='health'){const config=configuration();await login();await checkCollectionRoute();return reply(200,{connected:true,environment:config.test?'test':'live'});}
   const {data:attempt}=await db.from('araka_attempts').select('*').eq('id',p.id).maybeSingle();if(!attempt)return reply(404,{error:'Paiement introuvable'});
   return reply(200,{state:await verify(db,attempt,true)});
  }
  if(typeof p.token!=='string'||!/^[a-f0-9]{64}$/.test(p.token))return reply(401,{error:'Ouvrez votre lien de paiement personnel fourni par GM Fleet.'});
  const tokenHash=await hash(p.token),context=await rpc(db,'driver_payment_context',{token:tokenHash});
  if(p.action==='receipt')return reply(200,await rpc(db,'driver_payment_receipt',{p:{token_hash:tokenHash,receipt_id:p.receipt_id}}));
  if(p.action==='context')return reply(200,context);
  if(p.action==='check'){
   const {data:attempt}=await db.from('araka_attempts').select('*').eq('id',p.id).eq('contract_id',context.contract_id).maybeSingle();if(!attempt)return reply(404,{error:'Paiement introuvable'});
   await verify(db,attempt);return reply(200,await rpc(db,'driver_payment_context',{token:tokenHash}));
  }
  if(p.action!=='pay')return reply(400,{error:'Action invalide'});
  const config=configuration();if(config.test)return reply(409,{error:'Araka est configuré en test. Les versements chauffeurs attendent les identifiants de production.'});
  await login(); // Fail before reserving an attempt when authentication/configuration is invalid.
  await checkCollectionRoute();
  const callbackToken=secretToken();
  const attempt=await rpc(db,'begin_araka_payment',{p:{id:p.id,token_hash:tokenHash,amount:p.amount,provider:p.provider,wallet:p.wallet,callback_hash:await hash(callbackToken)}});
  if(attempt.dispatch){
   let initiationError='';
   try{
    const result=await api('/api/pay/paymentrequest',{order:{paymentPageId:config.page,customerFullName:attempt.driver_name,customerPhoneNumber:attempt.wallet,transactionReference:attempt.reference,amount:Number(attempt.total_charged),currency:attempt.currency,redirectURL:supabaseUrl+'/functions/v1/araka-payments?callback='+callbackToken},paymentChannel:{channel:'MOBILEMONEY',provider:attempt.provider,walletID:attempt.wallet}});
    if(result.data&&typeof result.data.transactionId==='string'&&result.data.transactionId){
     // Request acceptance (including 202) is never proof of payment.
     await rpc(db,'record_araka_status',{p:{id:attempt.id,transaction_id:result.data.transactionId,status:'PENDING'}});
    }else{
     initiationError='Araka n’a pas confirmé la réception de la demande (HTTP '+result.http+', code '+String(result.data?.statusCode??'absent').slice(0,20)+'). Référence : '+attempt.reference+'. Vérifiez le statut avant tout nouvel essai.';
    }
   }catch{initiationError='Réponse Araka non reçue. Référence : '+attempt.reference+'. Vérifiez le statut avant tout nouvel essai.';}
   if(initiationError)throw new Error(initiationError);
  }
  return reply(200,await rpc(db,'driver_payment_context',{token:tokenHash}));
 }catch(error){return reply(400,{error:error instanceof Error?error.message:'Service indisponible. Réessayez.'});}
});
