/* Settlement dates are separate from the daily allocation ledger. */
(function(root){
 'use strict';
 function settlementDate(date,contract){
  if(contract?.payment_frequency!=='weekly')return date;
  const d=new Date(date+'T12:00:00Z');
  d.setUTCDate(d.getUTCDate()+((7-d.getUTCDay())%7));
  return d.toISOString().slice(0,10);
 }
 function collection(contract,schedules,allocations,date){
  const groups=new Map(),paidBySchedule=new Map();
  for(const a of allocations)paidBySchedule.set(a.schedule_id,(paidBySchedule.get(a.schedule_id)||0)+Math.round(Number(a.amount)*100));
  for(const s of schedules.filter(s=>s.contract_id===contract.id).sort((a,b)=>a.due_on.localeCompare(b.due_on))){
   const paid=paidBySchedule.get(s.id)||0;
   const remaining=Math.max(0,Math.round((Number(s.lolc_due)+Number(s.gml_due))*100)-paid);
   const day=settlementDate(s.due_on,contract);groups.set(day,(groups.get(day)||0)+remaining);
  }
  const terms=[...groups].filter(([,n])=>n>0).map(([date,n])=>({date,amount:n/100}));
  const due=terms.filter(t=>t.date<=date),next=terms.find(t=>t.date>date);
  return {terms,due,next,oldest:due[0],today:due.filter(t=>t.date===date).reduce((n,t)=>n+Math.round(t.amount*100),0)/100,arrears:due.filter(t=>t.date<date).reduce((n,t)=>n+Math.round(t.amount*100),0)/100,total:due.reduce((n,t)=>n+Math.round(t.amount*100),0)/100};
 }
 function split(contract,schedules,allocations,amount){
  let left=Math.round(Number(amount)*100),lolc=0;
  const paidBySchedule=new Map();
  for(const a of allocations){const p=paidBySchedule.get(a.schedule_id)||{amount:0,lolc:0};p.amount+=Math.round(Number(a.amount)*100);p.lolc+=Math.round(Number(a.lolc_amount)*100);paidBySchedule.set(a.schedule_id,p);}
  for(const s of schedules.filter(s=>s.contract_id===contract.id).sort((a,b)=>a.due_on.localeCompare(b.due_on))){
   const p=paidBySchedule.get(s.id)||{amount:0,lolc:0},paid=p.amount,paidLolc=p.lolc;
   const l=Math.round(Number(s.lolc_due)*100)-paidLolc,remaining=Math.round((Number(s.lolc_due)+Number(s.gml_due))*100)-paid;
   if(remaining<=0||left<=0)continue;
   const take=Math.min(left,remaining);lolc+=take===remaining?l:Math.round(take*l/remaining);left-=take;
  }
  return {lolc:lolc/100,gml:(Math.round(Number(amount)*100)-left-lolc)/100,unallocated:left/100};
 }
 const api={settlementDate,collection,split};
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.GMFleetPaymentCalendar=api;
})(typeof window==='object'?window:globalThis);
