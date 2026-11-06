// Payment capability stays ephemeral: only its hash is persisted.
import { smsRpc, sendReservedSMS } from './sms.ts';
const site='https://gmfleet.georgemichaellogistics.cd';
const hex=(bytes:Uint8Array)=>Array.from(bytes).map(b=>b.toString(16).padStart(2,'0')).join('');
export function paymentReminderText(j:any,token:string){
 if(!/^[a-f0-9]{64}$/.test(token)||!/^\d{4}-\d{2}-\d{2}$/.test(j.due_on)||!['daily','weekly','saturday'].includes(j.kind)||!['USD','CDF'].includes(j.currency))throw Error('Rappel invalide');
 const amount=(v:any)=>{const n=Number(v);if(!Number.isFinite(n)||n<0||n>=1e12)throw Error('Montant invalide');return n.toFixed(2);};
 const name=String(j.driver_name||'').normalize('NFKD').replace(/\p{M}/gu,'').replace(/[^a-zA-Z0-9 -]/g,'').trim().split(/\s+/)[0].slice(0,16),date=j.due_on.split('-').reverse().join('/');
 const due=amount(j.current_amount),arrears=amount(j.arrears),total=amount(j.amount),link=site+'/p#token='+token;
 const detail=j.kind==='saturday'?'solde semaine '+due+' + arriere '+arrears+' = '+total+' '+j.currency+'. Avant votre activite personnelle.':j.kind==='weekly'?'demain '+date+', semaine '+due+' + arriere '+arrears+' = '+total+' '+j.currency+'.':date+', jour '+due+' + arriere '+arrears+' = '+total+' '+j.currency+'. Avant 21h.';
 const text='GM Fleet'+(name?' '+name:'')+': '+detail+' Payer: '+link;
 if(text.length>306||/[^\x20-\x7E]/.test(text))throw Error('Rappel trop long');return text;
}
export async function sendDriverPaymentReminder(db:any,n:any){
 return sendReservedSMS(db,n,async()=>{
  const token=hex(crypto.getRandomValues(new Uint8Array(32))),token_hash=hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))));
  const live=await smsRpc(db,'prepare_driver_payment_reminder',{sms_id:n.id,token_hash});
  return live?paymentReminderText(live,token):null;
 });
}
