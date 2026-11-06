import catalogue from './whatsapp-catalogue.json' with { type: 'json' };
const origin='https://gmfleet.georgemichaellogistics.cd';
const registry=catalogue as Record<string,{body:string;count:number}>;
const required=['WHATSAPP_ACCESS_TOKEN','WHATSAPP_PHONE_NUMBER_ID','WHATSAPP_BUSINESS_ACCOUNT_ID','WHATSAPP_GRAPH_VERSION','WHATSAPP_TEMPLATE_LANGUAGE'];
let cache:{until:number;templates:Record<string,number>;mismatched:string[]}|null=null;
export function whatsappConfiguration(){
 const missing=required.filter(n=>!Deno.env.get(n)||/^REPLACE_|^vXX/i.test(Deno.env.get(n)!)),version=Deno.env.get('WHATSAPP_GRAPH_VERSION')||'',phone=Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')||'',waba=Deno.env.get('WHATSAPP_BUSINESS_ACCOUNT_ID')||'',language=Deno.env.get('WHATSAPP_TEMPLATE_LANGUAGE')||'';
 const invalid=[...(new TextEncoder().encode(Deno.env.get('GML_BRIDGE_SECRET')||'').length<32?['GML_BRIDGE_SECRET']:[]),...(!/^v\d{1,2}\.\d+$/.test(version)?['WHATSAPP_GRAPH_VERSION']:[]),...(!/^\d+$/.test(phone)?['WHATSAPP_PHONE_NUMBER_ID']:[]),...(!/^\d+$/.test(waba)?['WHATSAPP_BUSINESS_ACCOUNT_ID']:[]),...(language!=='fr'?['WHATSAPP_TEMPLATE_LANGUAGE']:[])];
 return {enabled:Deno.env.get('WHATSAPP_ENABLED')==='true',configured:missing.length===0&&invalid.length===0,missing:[...new Set([...missing,...invalid])],version,phone,waba,language};
}
export async function whatsappOptions(test=false){
 const c=whatsappConfiguration();if(!c.configured||!c.enabled&&!test)return {...c,approved:[],templates:{},mismatched:[]};
 if(cache&&cache.until>Date.now())return {...c,approved:Object.keys(cache.templates),...cache};
 const templates:Record<string,number>={},mismatched:string[]=[];let after='';
 for(let page=0;page<20;page++){
  const url=new URL('https://graph.facebook.com/'+c.version+'/'+c.waba+'/message_templates');url.searchParams.set('fields','name,status,language,components');url.searchParams.set('limit','100');if(after)url.searchParams.set('after',after);
  let response:Response;try{response=await fetch(url,{headers:{Authorization:'Bearer '+Deno.env.get('WHATSAPP_ACCESS_TOKEN')},signal:AbortSignal.timeout(8000)});}catch{return {...c,approved:[],templates:{},mismatched:[],meta_error:'Meta indisponible'};}
  const j=await response.json().catch(()=>null);if(!response.ok||!Array.isArray(j?.data))return {...c,approved:[],templates:{},mismatched:[],meta_error_code:Number(j?.error?.code)||null,meta_http_status:response.status};
  for(const t of j.data){if(t.status!=='APPROVED'||t.language!==c.language||!registry[t.name])continue;const body=t.components?.find((x:any)=>x.type==='BODY')?.text,normalize=(s:string)=>s.replace(/\s+/g,' ').trim();if(typeof body!=='string'||normalize(body)!==normalize(registry[t.name].body)||/r[ée]pondez|reply to (?:this|the) message/i.test(body)){mismatched.push(t.name);continue;}templates[t.name]=registry[t.name].count;}
  if(!j.paging?.next)break;after=j.paging?.cursors?.after;if(typeof after!=='string'||!after||after.length>2048)break;
 }
 cache={until:Date.now()+300000,templates,mismatched};return {...c,approved:Object.keys(templates),...cache};
}
export async function providerWhatsApp(to:string,name:string,parameters:string[]){
 const c=whatsappConfiguration();if(!c.configured)return {status:'failed',error_code:0};
 const phone=to.replace(/[^0-9]/g,'');if(!/^[1-9][0-9]{7,14}$/.test(phone))return {status:'failed',error_code:131026};
 try{
  const response=await fetch('https://graph.facebook.com/'+c.version+'/'+c.phone+'/messages',{method:'POST',headers:{Authorization:'Bearer '+Deno.env.get('WHATSAPP_ACCESS_TOKEN'),'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:phone,type:'template',template:{name,language:{code:c.language},components:[{type:'body',parameters:parameters.map(text=>({type:'text',text}))}]}}),signal:AbortSignal.timeout(15000)});
  const j=await response.json().catch(()=>null),wamid=j?.messages?.[0]?.id;
  if(response.ok&&typeof wamid==='string'&&/^wamid\.[!-~]{2,290}$/.test(wamid))return {status:'accepted',wamid};
  if(response.status>=400&&response.status<500&&Number.isInteger(j?.error?.code))return {status:'failed',error_code:j.error.code};
  return {status:'unknown'};
 }catch{return {status:'unknown'};}
}
const bytes=(s:string)=>new TextEncoder().encode(s),b64=(a:Uint8Array)=>btoa(String.fromCharCode(...a)),unb64=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function envelopeKey(){const secret=Deno.env.get('GML_BRIDGE_SECRET')||'';if(bytes(secret).length<32)throw Error('Clé privée du transport indisponible');const base=await crypto.subtle.importKey('raw',bytes(secret),'HKDF',false,['deriveKey']);return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:bytes('gmfleet-whatsapp-v1'),info:bytes('notification-runtime-envelope')},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
export async function encryptWhatsAppRuntime(id:string,data:any){const iv=crypto.getRandomValues(new Uint8Array(12)),encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:bytes(id)},await envelopeKey(),bytes(JSON.stringify(data)));return {version:1,iv:b64(iv),data:b64(new Uint8Array(encrypted))};}
export async function decryptWhatsAppRuntime(id:string,c:any){if(c?.version!==1||typeof c.iv!=='string'||typeof c.data!=='string')throw Error('Enveloppe privée invalide');const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(c.iv),additionalData:bytes(id)},await envelopeKey(),unb64(c.data));return JSON.parse(new TextDecoder().decode(plain));}
export function whatsappRuntimeParameters(p:any,text:string){
 const parameters=p.parameters.map((v:any)=>v==null?'':String(v));if(p.runtime_position){let value='';if(p.runtime_kind==='link'){const found=text.match(/https:\/\/[^\s]+/);if(found){const u=new URL(found[0]);if(u.origin===origin&&['/contrat.html','/set-password.html'].includes(u.pathname))value=found[0];}}else if(p.runtime_kind==='invite_code')value=text.match(/code GML Mobile\s+(\d{4}-?\d{4})/)?.[1]||'';parameters[p.runtime_position-1]=value;}
 if(parameters.length!==p.parameter_count||parameters.some((x:string)=>!x||x.length>4096))throw Error('Paramètres du modèle incomplets');return parameters;
}
