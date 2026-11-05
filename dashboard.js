/* Read-only operational dashboard. Amounts are integer cents; currencies never mix. */
(function(root){
 'use strict';
 const calendar=typeof module==='object'&&module.exports?require('./payment-calendar.js'):root.GMFleetPaymentCalendar;
 const cents=n=>Math.round(Number(n||0)*100);
 const day=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Kinshasa',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
 function summarize(data,today){
  const contracts=new Map(data.contracts.map(c=>[c.id,c])),drivers=new Map(data.drivers.map(d=>[d.id,d])),vehicles=new Map(data.vehicles.map(v=>[v.id,v]));
  const amounts=new Map(),buckets={};
  const bucket=currency=>buckets[currency]||(buckets[currency]={received:0,due:0,arrears:0,lolc:0});
  data.payment_allocations.forEach(a=>amounts.set(a.schedule_id,(amounts.get(a.schedule_id)||0)+cents(a.amount)));
  const active=data.contracts.filter(c=>c.status==='active'),balances=new Map(active.map(c=>[c.id,{...c,driver:drivers.get(c.driver_id),vehicle:vehicles.get(c.vehicle_id),due:0,arrears:0,lateDays:0,oldest:null}]));
  active.forEach(c=>bucket(c.currency));
  data.repayment_schedules.forEach(s=>{const b=balances.get(s.contract_id);if(!b)return;const settlement=calendar.settlementDate(s.due_on,b);if(settlement>today)return;const remain=Math.max(0,cents(s.lolc_due)+cents(s.gml_due)-(amounts.get(s.id)||0));if(settlement===today)b.due+=remain;else if(remain>0){b.arrears+=remain;b.lateDays++;b.oldest=!b.oldest||s.due_on<b.oldest?s.due_on:b.oldest;}});
  balances.forEach(b=>{bucket(b.currency).due+=b.due;bucket(b.currency).arrears+=b.arrears;});
  const reversed=new Set(data.payments.filter(p=>p.reverses_payment_id).map(p=>p.reverses_payment_id)),deposited=new Set(data.lolc_deposit_items.map(i=>i.payment_id));
  const confirmed=data.payments.filter(p=>contracts.has(p.contract_id)&&p.entry_kind==='payment'&&!reversed.has(p.id));
  data.payments.forEach(p=>{const c=contracts.get(p.contract_id);if(c&&p.paid_on===today&&['payment','reversal'].includes(p.entry_kind))bucket(c.currency).received+=(p.entry_kind==='reversal'?-1:1)*cents(p.amount);});
  const pendingDeposits=confirmed.filter(p=>cents(p.lolc_amount)>0&&!deposited.has(p.id));confirmed.forEach(p=>bucket(contracts.get(p.contract_id).currency).lolc+=cents(p.lolc_amount));
  const late=[...balances.values()].filter(b=>b.arrears>0).sort((a,b)=>a.oldest.localeCompare(b.oldest)||b.lateDays-a.lateDays);
  const attempts=data.araka_attempts.filter(a=>['pending','review'].includes(a.state)).sort((a,b)=>a.created_at.localeCompare(b.created_at));
  const recent=confirmed.slice().sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,5).map(p=>({...p,currency:contracts.get(p.contract_id).currency}));
  return {buckets,active,balances:[...balances.values()],late,attempts,recent,pendingDeposits,managedCount:data.vehicles.filter(v=>v.owner_application_id).length,vehicleCount:new Set(active.map(c=>c.vehicle_id)).size,driverCount:new Set(active.map(c=>c.driver_id)).size};
 }
 let token=0,last=null,lastAt=null;
 const tables={contracts:['id,application_id,driver_id,vehicle_id,status,currency,signed_reference,payment_frequency,end_date','id'],drivers:['id,full_name,phone','id'],vehicles:['id,model,plate,status,owner_application_id','id'],repayment_schedules:['id,contract_id,due_on,lolc_due,gml_due','id'],payment_allocations:['payment_id,schedule_id,amount','payment_id','schedule_id'],payments:['id,contract_id,driver_name,amount,paid_on,method,reference,created_at,entry_kind,reverses_payment_id,lolc_amount','id'],lolc_deposit_items:['deposit_id,payment_id','deposit_id','payment_id'],araka_attempts:['id,contract_id,reference,amount,currency,state,created_at','id']};
 async function load(db){
  return Object.fromEntries(await Promise.all(Object.entries(tables).map(async([name,[fields,...order]])=>{
   const rows=[];for(let offset=0;;offset+=500){let q=db.from(name).select(fields);order.forEach(key=>q=q.order(key));const {data,error}=await q.range(offset,offset+499);if(error)throw error;rows.push(...data);if(data.length<500)break;}return [name,rows];
  })));
 }
 async function render(ctx){
  const request=++token,host=document.getElementById('content');if(!host.querySelector('.dashboard-heading'))host.innerHTML='<section class="card empty" aria-busy="true">Synchronisation du tableau de bord…</section>';
  let stale=false;
  try{const data=await load(ctx.db);if(request!==token)return true;last=data;lastAt=new Date().toISOString();}catch(error){if(request!==token)return false;stale=true;}
  if(request!==token||!ctx.isCurrent())return !stale;
  const {escape:e,date,apps,appointments,programs,stages}=ctx,today=day(new Date()),m=last?summarize(last,today):null;
  const money=(n,c)=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:c}).format(n/100);
  const moneyList=key=>m?Object.entries(m.buckets).sort(([a],[b])=>a.localeCompare(b)).map(([c,v])=>'<span>'+money(v[key],c)+'</span>').join('')||'<span>Aucun contrat</span>':'<span>Indisponible</span>';
  const open=apps.filter(a=>!a._active_contract&&!['rejected','withdrawn'].includes(a.workflow_stage)&&!(a.program_type==='YANGO'&&a.process_step==='joined'));
  const agenda=appointments.filter(a=>['scheduled','confirmed'].includes(a.status)&&day(a.starts_at)===today).sort((a,b)=>a.starts_at.localeCompare(b.starts_at));
  const nav=(view,label,extra='')=>'<button class="secondary" data-view="'+view+'" '+extra+'>'+label+' →</button>';
  const item=(label,detail,action,tone='')=>'<li class="todo-item"><span class="tag '+tone+'">'+label+'</span><div>'+detail+'</div>'+action+'</li>';
  const items=[];
  if(m){const collection=m.balances.filter(b=>b.due+b.arrears>0).sort((a,b)=>b.arrears-a.arrears);if(collection.length>5)items.push(item('Versements','<strong>'+collection.length+' contrats à encaisser ou relancer</strong>',nav('payments','Tous les versements')));collection.slice(0,5).forEach(b=>items.push(item(b.arrears?'En retard':'À encaisser','<strong>'+e(b.driver?.full_name||'Chauffeur')+' · '+e(b.vehicle?.plate||'Véhicule')+'</strong><small>'+money(b.due+b.arrears,b.currency)+(b.arrears?' dont '+money(b.arrears,b.currency)+' en retard':' à régler aujourd’hui')+'</small>','<button class="secondary" data-dashboard-contract="'+e(b.id)+'">Voir le contrat →</button>',b.arrears?'red':'')));
   if(m.attempts.length)items.push(item('Paiement digital','<strong>'+m.attempts.length+' paiement(s) Mobile Money à vérifier</strong><small>Pas encore comptabilisés comme encaissés</small>',nav('payments','Vérifier')));
  }
  if(agenda.length>5)items.push(item('Agenda','<strong>'+agenda.length+' rendez-vous aujourd’hui</strong>',nav('appointments','Tout l’agenda')));agenda.slice(0,5).forEach(ap=>{const a=apps.find(a=>a.id===ap.application_id);items.push(item('Rendez-vous','<strong>'+e(a?.name||'Dossier '+ap.application_id)+'</strong><small>'+date(ap.starts_at,true)+' · '+e(ap.location)+'</small>',a?'<button class="secondary" data-case="'+a.id+'" data-open-tab="appointments">Traiter →</button>':nav('appointments','Agenda')));});
  const groups=new Map();open.forEach(a=>{const pending=root.GMFleetWorkflow?.review(a)==='pending',key=a.program_type+':'+(pending?'review:pending':'step:'+a.process_step);if(!groups.has(key))groups.set(key,{a,pending,count:0});groups.get(key).count++;});
  groups.forEach(({a,pending,count})=>items.push(item('Dossiers','<strong>'+count+' · '+e(pending?'À examiner':root.GMFleetWorkflow?.step(a)||stages[a.workflow_stage])+'</strong><small>'+e(programs[a.program_type])+'</small>',nav('applications','Ouvrir','data-program="'+e(a.program_type)+'" data-stage-filter="'+e(pending?'review:pending':'step:'+a.process_step)+'"'))));
  const soon=new Date(today+'T12:00:00Z');soon.setUTCDate(soon.getUTCDate()+30);const limit=soon.toISOString().slice(0,10);
  if(m)m.active.filter(ct=>ct.end_date&&ct.end_date<=limit).sort((a,b)=>a.end_date.localeCompare(b.end_date)).forEach(ct=>{const b=m.balances.find(b=>b.id===ct.id);items.push(item('Contrat','<strong>'+e(b?.driver?.full_name||ct.signed_reference)+'</strong><small>Fin '+date(ct.end_date)+(ct.end_date<today?' · contrat encore actif':'')+'</small>','<button class="secondary" data-dashboard-contract="'+e(ct.id)+'">Vérifier →</button>'));});
  const failures=(ctx.notifications||[]).filter(n=>['failed','unknown','not_configured'].includes(n.delivery_status));if(failures.length)items.push(item('SMS','<strong>Notifications à vérifier · '+failures.length+'</strong><small>Consulter le suivi avant tout nouvel envoi.</small>',nav('sms','Vérifier')));
  host.innerHTML='<div class="dashboard-heading"><div><h2>À faire aujourd’hui</h2><p>Les actions à traiter · Heure de Kinshasa</p></div><span class="tag '+(stale?'orange':'green')+'">'+(stale?'Finances à vérifier':'À jour')+'</span></div>'+
   (stale?'<div class="dashboard-warning" role="alert">Les finances n’ont pas pu être actualisées. '+(last?'Dernière lecture : '+date(lastAt,true)+'. Les montants peuvent avoir changé.':'Les montants sont indisponibles ; aucun zéro n’est supposé.')+' <button class="link-button" data-dashboard-refresh>Réessayer</button></div>':'')+
   '<div class="todo-overview"><span>À encaisser <strong data-metric="due">'+moneyList('due')+'</strong></span><span>Retards <strong data-metric="arrears">'+moneyList('arrears')+'</strong></span><span>'+agenda.length+' rendez-vous aujourd’hui</span></div><section class="card"><ol class="todo-list">'+(items.join('')||'<li class="compact-empty">Rien à traiter pour le moment.</li>')+'</ol></section>';
  window.lucide?.createIcons({attrs:{'aria-hidden':'true'}});
  return !stale;
 }
 const api={summarize,load,render,cancel:()=>{token++;},day};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.GMFleetDashboard=api;
})(typeof window==='undefined'?globalThis:window);
