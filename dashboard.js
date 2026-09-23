/* Read-only operational dashboard. Amounts are integer cents; currencies never mix. */
(function(root){
 'use strict';
 const cents=n=>Math.round(Number(n||0)*100);
 const day=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Kinshasa',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
 function summarize(data,today){
  const contracts=new Map(data.contracts.map(c=>[c.id,c])),drivers=new Map(data.drivers.map(d=>[d.id,d])),vehicles=new Map(data.vehicles.map(v=>[v.id,v]));
  const amounts=new Map(),buckets={};
  const bucket=currency=>buckets[currency]||(buckets[currency]={received:0,due:0,arrears:0,lolc:0});
  data.payment_allocations.forEach(a=>amounts.set(a.schedule_id,(amounts.get(a.schedule_id)||0)+cents(a.amount)));
  const active=data.contracts.filter(c=>c.status==='active'),balances=new Map(active.map(c=>[c.id,{...c,driver:drivers.get(c.driver_id),vehicle:vehicles.get(c.vehicle_id),due:0,arrears:0,lateDays:0,oldest:null}]));
  active.forEach(c=>bucket(c.currency));
  data.repayment_schedules.forEach(s=>{const b=balances.get(s.contract_id);if(!b||s.due_on>today)return;const remain=Math.max(0,cents(s.lolc_due)+cents(s.gml_due)-(amounts.get(s.id)||0));if(s.due_on===today)b.due+=remain;else if(remain>0){b.arrears+=remain;b.lateDays++;b.oldest=!b.oldest||s.due_on<b.oldest?s.due_on:b.oldest;}});
  balances.forEach(b=>{bucket(b.currency).due+=b.due;bucket(b.currency).arrears+=b.arrears;});
  const reversed=new Set(data.payments.filter(p=>p.reverses_payment_id).map(p=>p.reverses_payment_id)),deposited=new Set(data.lolc_deposit_items.map(i=>i.payment_id));
  const confirmed=data.payments.filter(p=>contracts.has(p.contract_id)&&p.entry_kind==='payment'&&!reversed.has(p.id));
  data.payments.forEach(p=>{const c=contracts.get(p.contract_id);if(c&&p.paid_on===today&&['payment','reversal'].includes(p.entry_kind))bucket(c.currency).received+=(p.entry_kind==='reversal'?-1:1)*cents(p.amount);});
  const pendingDeposits=confirmed.filter(p=>cents(p.lolc_amount)>0&&!deposited.has(p.id));pendingDeposits.forEach(p=>bucket(contracts.get(p.contract_id).currency).lolc+=cents(p.lolc_amount));
  const late=[...balances.values()].filter(b=>b.arrears>0).sort((a,b)=>a.oldest.localeCompare(b.oldest)||b.lateDays-a.lateDays);
  const attempts=data.araka_attempts.filter(a=>['pending','review'].includes(a.state)).sort((a,b)=>a.created_at.localeCompare(b.created_at));
  const recent=confirmed.slice().sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,5).map(p=>({...p,currency:contracts.get(p.contract_id).currency}));
  return {buckets,active,late,attempts,recent,pendingDeposits,vehicleCount:new Set(active.map(c=>c.vehicle_id)).size,driverCount:new Set(active.map(c=>c.driver_id)).size};
 }
 let token=0,last=null,lastAt=null;
 const tables={contracts:['id,application_id,driver_id,vehicle_id,status,currency,signed_reference','id'],drivers:['id,full_name,phone','id'],vehicles:['id,model,plate,status','id'],repayment_schedules:['id,contract_id,due_on,lolc_due,gml_due','id'],payment_allocations:['payment_id,schedule_id,amount','payment_id','schedule_id'],payments:['id,contract_id,driver_name,amount,paid_on,method,reference,created_at,entry_kind,reverses_payment_id,lolc_amount','id'],lolc_deposit_items:['deposit_id,payment_id','deposit_id','payment_id'],araka_attempts:['id,contract_id,reference,amount,currency,state,created_at','id']};
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
  const open=apps.filter(a=>!['rejected','withdrawn','handed_over'].includes(a.workflow_stage));
  const newApps=open.filter(a=>a.workflow_stage==='new'),followups=open.filter(a=>a.follow_up_on&&a.follow_up_on<=today).sort((a,b)=>a.follow_up_on.localeCompare(b.follow_up_on));
  const incomplete=open.filter(a=>a.lolc_status==='information_required'),waiting=open.filter(a=>a.lolc_status==='pending');
  const queue=[...new Map([...incomplete,...followups,...newApps.slice().sort((a,b)=>a.created_at.localeCompare(b.created_at))].map(a=>[a.id,a])).values()];
  const agenda=appointments.filter(a=>['scheduled','confirmed'].includes(a.status)&&day(a.starts_at)===today).sort((a,b)=>a.starts_at.localeCompare(b.starts_at));
  const staleAppointments=appointments.filter(a=>['scheduled','confirmed'].includes(a.status)&&day(a.starts_at)<today);
  const row=(title,detail,button)=>'<div class="dashboard-row"><div><strong>'+title+'</strong><small>'+detail+'</small></div>'+button+'</div>';
  const nav=(view,label,extra='')=>'<button class="link-button" data-view="'+view+'" '+extra+'>'+label+' →</button>';
  host.innerHTML='<div class="dashboard-heading"><div><h2>Vos priorités du jour</h2><p>Encaissements, échéances et dossiers · Heure de Kinshasa</p></div><span class="tag '+(stale?'orange':'green')+'">'+(stale?'Synchronisation financière interrompue':'Données actualisées')+'</span></div>'+
   (stale?'<div class="dashboard-warning" role="alert">Les finances n’ont pas pu être actualisées. '+(last?'Dernière lecture réussie : '+date(lastAt,true)+'. Les montants ci-dessous peuvent avoir changé.':'Les montants restent indisponibles ; aucun zéro n’est supposé.')+' <button class="link-button" data-dashboard-refresh>Réessayer</button></div>':'')+
   '<div class="stats dashboard-stats">'+[['Encaissé aujourd’hui','received','Versements nets, hors frais de transaction','payments'],['Échéances du jour restantes','due','Après affectation des paiements','payments'],['Retards à recouvrer','arrears',m?m.late.length+' contrat(s) avec échéances impayées avant aujourd’hui':'Finances indisponibles','payments'],['Part LOLC à déposer','lolc','Versements confirmés non rapprochés','reconciliation']].map(([label,key,note,target])=>'<button class="stat dashboard-stat" data-view="'+target+'"><span>'+label+'</span><strong class="amount" data-metric="'+key+'">'+moneyList(key)+'</strong><small>'+note+'</small></button>').join('')+'</div>'+
   '<div class="dashboard-counters">'+[[newApps.length,'Nouvelles candidatures','applications','data-stage-filter="new"'],[followups.length,'Relances dues','applications','data-followups="true"'],[agenda.length,'Rendez-vous du jour à traiter','appointments',''],[m?m.active.length:'—','Contrats actifs','contracts','']].map(([n,l,v,x])=>'<button data-view="'+v+'" '+x+'><strong>'+n+'</strong><span>'+l+'</span></button>').join('')+'</div>'+
   '<div class="grid-two dashboard-grid"><section class="card"><div class="card-heading"><h3>À traiter en priorité</h3>'+nav('applications','Tous les dossiers')+'</div>'+
   (m&&m.attempts.length?row(m.attempts.length+' paiement(s) Mobile Money à vérifier','En attente ou à rapprocher · non comptabilisés comme encaissés',nav('payments','Vérifier')):'')+
   (staleAppointments.length?row(staleAppointments.length+' rendez-vous passé(s) à clôturer','Mettez à jour le résultat du rendez-vous',nav('appointments','Ouvrir l’agenda')):'')+
   (queue.length?queue.slice(0,5).map(a=>row('<button class="link-button" data-case="'+a.id+'">'+e(a.name)+'</button>',e(a.lolc_status==='information_required'?'Complément demandé par LOLC':a.next_action||stages[a.workflow_stage])+(a.follow_up_on?' · '+date(a.follow_up_on):''),'<span class="tag">'+e(programs[a.program_type]||a.program_type)+'</span>')).join(''):'<p class="empty">Aucune nouvelle candidature ou relance due.</p>')+
   '<p class="muted">'+waiting.length+' dossier(s) en attente de décision LOLC · '+incomplete.length+' complément(s) demandé(s).</p></section>'+
   '<section class="card"><div class="card-heading"><h3>Chauffeurs à relancer</h3>'+nav('payments','Ouvrir la caisse')+'</div>'+(m?(m.late.length?m.late.slice(0,5).map(c=>row(e(c.driver?.full_name||'Chauffeur'),'Plaque '+e(c.vehicle?.plate||'—')+' · '+c.lateDays+' échéance(s) en retard · depuis le '+date(c.oldest),'<button class="link-button" data-dashboard-contract="'+e(c.id)+'">'+money(c.arrears,c.currency)+' →</button>')).join(''):'<p class="empty">Aucune échéance antérieure impayée sur les contrats actifs.</p>'):'<p class="empty">Solde des chauffeurs indisponible.</p>')+'</section>'+
   '<section class="card"><div class="card-heading"><h3>Rendez-vous du jour</h3>'+nav('appointments','Agenda')+'</div>'+(agenda.length?agenda.slice(0,5).map(a=>{const app=apps.find(x=>x.id===a.application_id);return row(app?'<button class="link-button" data-case="'+app.id+'">'+e(app.name)+'</button>':'Dossier #'+e(a.application_id),e(a.location)+' · '+e(ctx.person(a.assigned_to)),'<time>'+date(a.starts_at,true)+'</time>');}).join(''):'<p class="empty">Aucun rendez-vous restant aujourd’hui.</p>')+'</section>'+
   '<section class="card"><div class="card-heading"><h3>Derniers versements confirmés</h3>'+nav('payments','Historique')+'</div>'+(m?(m.recent.length?m.recent.map(p=>row(e(p.driver_name),e(p.method)+' · '+date(p.paid_on)+' · '+e(p.reference),'<strong>'+money(cents(p.amount),p.currency)+'</strong>')).join(''):'<p class="empty">Aucun versement confirmé.</p>'):'<p class="empty">Historique financier indisponible.</p>')+'</section></div>'+
   '<section class="card dashboard-fleet"><div><h3>Flotte sous contrat actif</h3><p>'+ (m?m.vehicleCount+' véhicule(s) · '+m.driverCount+' chauffeur(s)':'Données indisponibles')+'</p></div>'+nav('contracts','Contrats & véhicules')+'<p class="muted">Les montants suivent les échéances contractuelles et leurs paiements affectés. Les échéances futures ne sont pas des retards. USD et CDF restent séparés.</p></section>';
  return !stale;
 }
 const api={summarize,load,render,cancel:()=>{token++;},day};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.GMFleetDashboard=api;
})(typeof window==='undefined'?globalThis:window);
