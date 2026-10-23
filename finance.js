/* Contract terms and money movements are validated atomically by database RPCs. */
window.GMFleetFinance = (() => {
 'use strict';
 let ctx,view,store={},cashView='collection',bilanView='lolc',collectionSearch='',historySearch='',historyPage=0,bilanFrom='',bilanTo='',collectionCache=new Map();
 const $=id=>document.getElementById(id),esc=v=>ctx.escape(v),money=(n,c)=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:c}).format(Number(n||0));
 const cents=n=>Math.round(Number(n||0)*100),sum=(rows,key)=>rows.reduce((n,r)=>n+cents(r[key]),0)/100;
 const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Kinshasa',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const role=()=>ctx.staff.find(s=>s.user_id===ctx.user.id)?.role;
 const cashier=()=>['super_admin','admin','cashier'].includes(role());
 const contract=id=>store.contracts.find(c=>c.id===id),driver=c=>store.drivers.find(d=>d.id===c.driver_id),vehicle=c=>c.vehicle_snapshot?.model?c.vehicle_snapshot:store.vehicles.find(v=>v.id===c.vehicle_id);
 const reversed=p=>store.payments.some(r=>r.reverses_payment_id===p.id),deposited=p=>store.lolc_deposit_items.some(i=>i.payment_id===p.id);
 const validPayments=()=>store.payments.filter(p=>p.contract_id&&p.entry_kind==='payment'&&!reversed(p));
 const pending=()=>validPayments().filter(p=>Number(p.lolc_amount)>0&&!deposited(p));
 const options=(list,key,label,selected)=>list.map(x=>`<option value="${esc(x[key])}" ${x[key]===selected?'selected':''}>${esc(label(x))}</option>`).join('');
 function balances(c) {
  let due=0,arrears=0,total=0;const date=today();
  const schedule=store.repayment_schedules.filter(s=>s.contract_id===c.id).map(s=>{
   const paid=store.payment_allocations.filter(a=>a.schedule_id===s.id).reduce((n,a)=>n+cents(a.amount),0);
   const remaining=cents(s.lolc_due)+cents(s.gml_due)-paid;
   const settlement=window.GMFleetPaymentCalendar.settlementDate(s.due_on,c);total+=remaining;if(settlement===date)due+=remaining;if(settlement<date)arrears+=remaining;
   return {...s,paid:paid/100,remaining:remaining/100};
  });
  return {due:c.status==='active'?due/100:0,arrears:c.status==='active'?arrears/100:0,total:c.status==='active'?total/100:0,schedule};
 }
 async function load(){
  const names=['contracts','drivers','vehicles','repayment_schedules','payments','payment_allocations','lolc_deposits','lolc_deposit_items','araka_attempts','lolc_case_payments'];
  const data=await Promise.all(names.map(t=>ctx.rows(t,q=>t==='araka_attempts'?q.select('id,contract_id,reference,amount,transaction_fee,total_charged,currency,provider,state,transaction_id,receipt_id,created_at,last_checked_at,verified_at,review_reason').order('created_at'):t==='payment_allocations'?q.order('payment_id').order('schedule_id'):t==='lolc_deposit_items'?q.order('deposit_id').order('payment_id'):q.order('id'))));
  store=Object.fromEntries(names.map((n,i)=>[n,data[i]]));collectionCache.clear();
 }
 async function render(selected,context){
  view=selected;ctx=context;
  $('today').textContent=new Intl.DateTimeFormat('fr-FR',{dateStyle:'full',timeZone:'Africa/Kinshasa'}).format(new Date());
  $('content').innerHTML='<section class="card empty">Chargement des opérations financières…</section>';
  try{await load();paint();if(ctx.openContract&&view==='contracts'&&document.querySelector('nav button.active')?.dataset.view==='contracts'){const id=ctx.openContract;ctx.openContract=null;if(store.contracts.some(c=>c.id===id))showContract(id);}}catch(e){if(document.querySelector('nav button.active')?.dataset.view!==view)return;$('content').innerHTML=`<section class="card form-error">${esc(e.message)}</section>`;return false;}
 }
 function paint(){
  if(document.querySelector('nav button.active')?.dataset.view!==view)return;
  if(view==='contracts')paintContracts();else if(view==='payments')paintPayments();else paintDeposits();
 }
 // Quote every field and neutralize spreadsheet formulas in user-entered text.
 function csvCell(value){
  let text=String(value??'');if(/^[\s\uFEFF]*[=+@-]/.test(text))text="'"+text;
  return '"'+text.replace(/"/g,'""')+'"';
 }
 function exportContracts(){
  const columns=['Chauffeur','Téléphone','Référence contrat','Type de contrat','Statut','Véhicule','Plaque','Châssis / VIN','Tracker','Début du contrat','Fin du contrat','Premier paiement','Jours de versement','Devise','Part quotidienne LOLC','Part quotidienne GML','Versement quotidien','Échéances du contrat','Total contractuel prévu','Versements nets confirmés','Reste dû aujourd’hui','Retards','Solde contractuel restant','Situation au'];
  const lines=store.contracts.map(c=>{const d=driver(c)||{},v=vehicle(c)||{},b=balances(c);return [d.full_name,d.phone,c.signed_reference,c.contract_type==='DRIVE_TO_OWN'?'Drive to Own':c.contract_type==='PARTNER_DRIVER'?'Chauffeur partenaire':c.contract_type,c.status==='active'?'Actif':c.status==='void'?'Annulé':c.status,v.model,v.plate,v.vin,v.tracker_id,c.start_date,c.end_date,c.first_payment_date,(c.operating_days||[]).map(n=>['','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'][n]).join(', '),c.currency,Number(c.daily_lolc||0).toFixed(2),Number(c.daily_gml||0).toFixed(2),((cents(c.daily_lolc)+cents(c.daily_gml))/100).toFixed(2),b.schedule.length,(b.schedule.reduce((n,s)=>n+cents(s.lolc_due)+cents(s.gml_due),0)/100).toFixed(2),sum(validPayments().filter(p=>p.contract_id===c.id),'amount').toFixed(2),b.due.toFixed(2),b.arrears.toFixed(2),b.total.toFixed(2),today()];});
  const blob=new Blob(['\uFEFF'+[columns,...lines].map(row=>row.map(csvCell).join(';')).join('\r\n')+'\r\n'],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='GMFleet-chauffeurs-contrats-'+today()+'.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 function paintContracts(){
  const active=store.contracts.filter(c=>c.status==='active');
  $('content').innerHTML=`<div class="card-heading"><p class="muted">Les échéances commencent à la date prévue au contrat, jamais à la candidature.</p><div class="header-actions"><button class="secondary" data-finance="export-contracts" ${store.contracts.length?'':'disabled'}>Exporter les contrats (CSV)</button><button class="primary" data-finance="activate">＋ Activer un contrat</button></div></div><div class="stats"><div class="stat"><span>Contrats actifs</span><strong>${active.length}</strong><small>Chauffeurs et véhicules affectés</small></div><div class="stat"><span>Drive to Own</span><strong>${active.filter(c=>c.contract_type==='DRIVE_TO_OWN').length}</strong><small>Remboursement LOLC + frais GML</small></div><div class="stat"><span>Chauffeurs Partenaires</span><strong>${active.filter(c=>c.contract_type==='PARTNER_DRIVER').length}</strong><small>Versements selon contrat</small></div><div class="stat"><span>Contrats avec retard</span><strong>${active.filter(c=>balances(c).arrears>0).length}</strong><small>Règlements dont la date limite est dépassée</small></div></div><section class="card"><h3>Contrats et affectations</h3>${store.contracts.length?`<div class="table-wrap"><table><thead><tr><th>Chauffeur / contrat</th><th>Véhicule</th><th>Versement par jour</th><th>Retard</th><th>Statut</th></tr></thead><tbody>${store.contracts.map(c=>`<tr><td><button class="link-button" data-contract="${c.id}">${esc(driver(c)?.full_name)}</button><small>${esc(c.signed_reference)} · ${ctx.date(c.start_date)}</small></td><td>${esc(vehicle(c)?.model)}<small>${esc(vehicle(c)?.plate)}</small></td><td>${money(Number(c.daily_lolc)+Number(c.daily_gml),c.currency)}<small>LOLC ${money(c.daily_lolc,c.currency)} · GML ${money(c.daily_gml,c.currency)}</small></td><td>${c.status==='active'?money(balances(c).arrears,c.currency):'—'}</td><td><span class="tag ${c.status==='active'?'green':''}">${c.status==='active'?'Actif':'Annulé'}</span></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Aucun contrat. Terminez le dossier et la remise du véhicule avant l’activation.</div>'}</section>`;
 }
 const collection=c=>{const key=c.id+':'+today();if(!collectionCache.has(key))collectionCache.set(key,window.GMFleetPaymentCalendar.collection(c,store.repayment_schedules,store.payment_allocations,today()));return collectionCache.get(key);};
 function subtabs(items,selected,attribute){return '<div class="queue-tabs finance-tabs" role="tablist">'+items.map(([id,label])=>'<button role="tab" aria-selected="'+(selected===id)+'" class="'+(selected===id?'active':'secondary')+'" '+attribute+'="'+id+'">'+label+'</button>').join('')+'</div>';}
 function searchable(c,text){return [driver(c)?.full_name,driver(c)?.phone,vehicle(c)?.plate,vehicle(c)?.model,c.signed_reference].join(' ').toLocaleLowerCase().includes(text.toLocaleLowerCase());}
 function collectionCards(){
  const active=store.contracts.filter(c=>c.status==='active'&&searchable(c,collectionSearch));
  const due=active.filter(c=>collection(c).total>0).sort((a,b)=>collection(a).oldest.date.localeCompare(collection(b).oldest.date));
  return '<div class="collection-heading"><h3>À encaisser · '+due.length+'</h3><span class="muted">'+ctx.date(today())+'</span></div>'+(due.length?due.map(c=>{const b=collection(c),v=vehicle(c);return '<article class="collection-card"><div><strong>'+esc(driver(c)?.full_name)+'</strong><small>'+esc(v?.model)+' · '+esc(v?.plate)+'</small><span class="tag '+(b.arrears?'red':'')+'">'+(b.arrears?'Échéance dépassée depuis le '+ctx.date(b.oldest.date):'À régler aujourd’hui')+'</span><small>'+(c.payment_frequency==='weekly'?'Règlement hebdomadaire':'Règlement quotidien')+' · '+b.due.length+' échéance(s) à régler</small></div><div class="collection-amount"><small>Aujourd’hui '+money(b.today,c.currency)+' · Antérieur '+money(b.arrears,c.currency)+'</small><strong>'+money(b.total,c.currency)+'</strong>'+(cashier()?'<button class="primary" data-pay="'+c.id+'">Enregistrer le paiement</button>':'')+'</div></article>';}).join(''):'<p class="compact-empty">Aucun versement arrivé à échéance. Les véhicules réglés réapparaîtront à leur prochaine échéance.</p>')+
  '<details class="finance-upcoming"><summary>À jour / prochains règlements · '+active.filter(c=>collection(c).total===0).length+'</summary>'+active.filter(c=>collection(c).total===0).map(c=>{const n=collection(c).next;return '<div class="row"><div><strong>'+esc(driver(c)?.full_name)+'</strong><small>'+esc(vehicle(c)?.plate)+' · '+(n?'Prochain règlement : '+ctx.date(n.date)+' · '+money(n.amount,c.currency):'Contrat soldé')+'</small></div><span class="tag green">À jour</span></div>';}).join('')+'</details>';
 }
 function paintPayments(){
  let body='';
  if(cashView==='collection')body='<section class="card"><label>Rechercher un chauffeur ou véhicule<input id="collectionSearch" type="search" value="'+esc(collectionSearch)+'" placeholder="Nom, téléphone, plaque…"></label><div id="collectionResults">'+collectionCards()+'</div></section>';
  if(cashView==='cash')body='<section class="card finance-start"><span class="eyebrow">PAIEMENT AU BUREAU</span><h3>Recevoir un versement en espèces</h3><p class="muted">Choisissez le chauffeur. Son contrat, ses échéances et le partage LOLC / GML sont calculés automatiquement.</p>'+(cashier()?'<button class="primary" data-finance="payment">＋ Enregistrer des espèces</button>':'<p>Réservé à la caisse.</p>')+'</section>';
  if(cashView==='digital')body='<section class="card"><h3>Mobile Money / paiement digital</h3><p class="muted">Les paiements confirmés par le service sont enregistrés et répartis automatiquement. Aucun encaissement manuel supplémentaire.</p><details><summary>Créer un lien pour un chauffeur</summary>'+store.contracts.filter(c=>c.status==='active').map(c=>'<div class="row"><span>'+esc(driver(c)?.full_name)+' · '+esc(vehicle(c)?.plate)+'</span>'+(cashier()?'<button class="secondary" data-payment-link="'+c.id+'">Lien de paiement</button>':'')+'</div>').join('')+'</details>'+arakaTable()+'</section>';
  if(cashView==='history')body='<section class="card"><h3>Historique des encaissements</h3><label>Rechercher<input type="search" id="historySearch" value="'+esc(historySearch)+'" placeholder="Chauffeur ou référence"></label><div id="paymentHistory">'+historyTable()+'</div></section>';
  $('content').innerHTML=subtabs([['collection','À encaisser'],['cash','Espèces'],['digital','Paiement digital'],['history','Historique']],cashView,'data-cash-view')+body;
 }
 function historyTable(){const rows=store.payments.filter(p=>p.contract_id&&[p.driver_name,p.reference].join(' ').toLowerCase().includes(historySearch.toLowerCase())).slice().reverse();historyPage=Math.min(historyPage,Math.max(0,Math.ceil(rows.length/25)-1));return paymentsTable(rows.slice(historyPage*25,(historyPage+1)*25))+(rows.length>25?'<div class="card-heading"><button class="secondary" data-history-page="'+(historyPage-1)+'" '+(historyPage===0?'disabled':'')+'>Précédent</button><span>Page '+(historyPage+1)+' / '+Math.ceil(rows.length/25)+'</span><button class="secondary" data-history-page="'+(historyPage+1)+'" '+((historyPage+1)*25>=rows.length?'disabled':'')+'>Suivant</button></div>':'');}

 async function arakaCall(body){const {data,error}=await ctx.db.functions.invoke('araka-payments',{body});if(error){let message=error.message;try{message=(await error.context.json()).error||message;}catch{}throw new Error(message);}return data;}
 function arakaTable(){return store.araka_attempts.length?store.araka_attempts.slice().reverse().map(a=>'<div class="row"><div><strong>'+esc(driver(contract(a.contract_id))?.full_name)+' · '+money(a.total_charged??a.amount,a.currency)+'</strong><small>'+esc(a.provider)+' · '+esc(a.reference)+' · '+esc({pending:'En attente',approved:'Confirmé',declined:'Refusé',review:'À vérifier'}[a.state])+'</small><small>Versement '+money(a.amount,a.currency)+' · Frais '+money(a.transaction_fee||0,a.currency)+'</small></div>'+(a.receipt_id?'<button class="secondary" data-receipt="'+a.receipt_id+'">Voir le reçu</button>':cashier()&&a.state!=='declined'?'<button class="secondary" data-araka-check="'+a.id+'">Vérifier le statut</button>':'')+'</div>').join(''):'<p class="compact-empty">Aucun paiement digital.</p>';}

 async function paymentLink(id){
  try{const token=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b=>b.toString(16).padStart(2,'0')).join('');const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(b=>b.toString(16).padStart(2,'0')).join('');
   const {error}=await ctx.db.rpc('set_driver_payment_link',{p:{contract_id:id,token_hash:hash}});if(error)throw error;
   modal('Lien de paiement chauffeur','<p>Partagez ce lien uniquement avec le chauffeur. Le renouvellement invalide le lien précédent.</p><textarea id="driverPaymentLink" readonly rows="4"></textarea><button class="primary" id="copyDriverLink">Copier le lien</button>');
   const link='https://gmfleet.georgemichaellogistics.cd/payer.html#token='+token;$('driverPaymentLink').value=link;$('copyDriverLink').onclick=async()=>{try{await navigator.clipboard.writeText(link);$('copyDriverLink').textContent='Copié';}catch{$('driverPaymentLink').select();}};
  }catch(error){ctx.notify(error.message,true);}
 }
 function paymentsTable(payments){
  if(!payments.length)return '<p class="empty">Aucun versement enregistré.</p>';
  return `<div class="table-wrap"><table><thead><tr><th>Date / référence</th><th>Chauffeur</th><th>Montant</th><th>Caisse</th><th>Statut / action</th></tr></thead><tbody>${payments.map(p=>{const c=contract(p.contract_id);return `<tr><td>${ctx.date(p.paid_on)}<small>${esc(p.reference)} · ${esc(p.method.replace(/Araka/gi,'Mobile Money'))}</small></td><td>${esc(p.driver_name)}<small>${esc(p.reason)}</small></td><td>${p.entry_kind==='reversal'?'−':''}${money(p.amount,c.currency)}<small>Frais : ${money(p.transaction_fee||0,c.currency)} · Total : ${money(p.total_charged??p.amount,c.currency)}</small><small>Part LOLC : ${money(p.lolc_amount,c.currency)}</small></td><td>${esc(p.method.startsWith('Araka ')?'Paiement digital — confirmé automatiquement':ctx.person(p.recorded_by))}<small>${ctx.date(p.created_at,true)}</small></td><td><span class="tag ${p.entry_kind==='reversal'||reversed(p)?'red':'green'}">${p.entry_kind==='reversal'?'Annulation':reversed(p)?'Annulé':deposited(p)?'Déposé à LOLC':'Confirmé'}</span><button class="link-button" data-receipt="${p.id}">Reçu</button>${p.proof_path?`<button class="link-button" data-proof="${esc(p.proof_path)}">Justificatif</button>`:''}</td></tr>`;}).join('')}</tbody></table></div>`;
 }
 function paintDeposits(){
  const ps=validPayments().filter(p=>(!bilanFrom||p.paid_on>=bilanFrom)&&(!bilanTo||p.paid_on<=bilanTo));
  const equipment=store.lolc_case_payments.filter(p=>p.kind==='equipment_received'&&(!bilanFrom||p.paid_on>=bilanFrom)&&(!bilanTo||p.paid_on<=bilanTo));
  const currencies=[...new Set([...ps.map(p=>contract(p.contract_id).currency),...(equipment.length?['USD']:[])])];
  const summaries=currencies.map(currency=>{const rows=ps.filter(p=>contract(p.contract_id).currency===currency),l=sum(rows,'lolc_amount'),gross=sum(rows,'amount'),eq=currency==='USD'?sum(equipment,'amount'):0;return '<div class="stat"><span>'+(bilanView==='lolc'?'Part LOLC encaissée':'Part GML encaissée')+' · '+currency+'</span><strong>'+money(bilanView==='lolc'?l:gross-l+eq,currency)+'</strong><small>'+(bilanView==='lolc'?'Comptée dès réception du chauffeur':'Versements '+money(gross-l,currency)+' + équipement '+money(eq,currency))+'</small></div>';}).join('');
  const rows=ps.slice().reverse().map(p=>{const c=contract(p.contract_id);return '<tr><td>'+ctx.date(p.paid_on)+'</td><td>'+esc(p.driver_name)+'<small>'+esc(vehicle(c)?.model)+' · '+esc(vehicle(c)?.plate)+'</small></td><td>'+money(bilanView==='lolc'?p.lolc_amount:Number(p.amount)-Number(p.lolc_amount),c.currency)+'</td><td><button class="link-button" data-receipt="'+p.id+'">Voir le reçu</button></td></tr>';}).join('');
  const eqrows=bilanView==='gml'?equipment.slice().reverse().map(p=>'<tr><td>'+ctx.date(p.paid_on)+'</td><td>'+esc(ctx.apps.find(a=>a.id===p.application_id)?.name||'Dossier '+p.application_id)+'<small>Équipement Car na ngai · '+esc(p.reference)+'</small></td><td>'+money(p.amount,'USD')+'</td><td><button class="link-button" data-equipment-receipt="'+p.id+'">Voir le reçu</button></td></tr>').join(''):'';
  const deposits=store.lolc_case_payments.filter(p=>p.kind==='client_deposit_lolc');
  const expected=deposits.length*240,received=sum(store.lolc_case_payments.filter(p=>p.kind==='equipment_received'),'amount');
  $('content').innerHTML=subtabs([['lolc','LOLC'],['gml','GML']],bilanView,'data-bilan-view')+'<p class="muted">Répartition automatique des encaissements confirmés. La part LOLC est comptée dès réception à la caisse, même avant le dépôt bancaire.</p><div class="workspace-toolbar"><label>Du<input id="bilanFrom" type="date" value="'+esc(bilanFrom)+'"></label><label>Au<input id="bilanTo" type="date" value="'+esc(bilanTo)+'"></label></div><div class="stats">'+(summaries||'<p class="compact-empty">Aucun encaissement sur cette période.</p>')+'</div>'+(bilanView==='gml'?'<details class="card"><summary>Équipements Car na ngai · '+money(received,'USD')+' reçus / '+money(expected,'USD')+' attendus</summary><p>Par dossier : équipement 130 $ + installation 20 $ + service 7,50 $ × 12 = 240 $. Seuls les paiements réellement reçus entrent dans le bilan.</p><p>Reste à recevoir : '+money(Math.max(0,expected-received),'USD')+' · Toutes périodes</p></details>':'')+'<section class="card"><h3>Historique · '+(bilanView==='lolc'?'Part LOLC':'Part GML')+'</h3>'+(rows||eqrows?'<div class="table-wrap"><table><thead><tr><th>Date</th><th>Chauffeur / véhicule</th><th>Part '+(bilanView==='lolc'?'LOLC':'GML')+'</th><th>Reçu</th></tr></thead><tbody>'+rows+eqrows+'</tbody></table></div>':'<p class="compact-empty">Aucun encaissement.</p>')+'</section>';
 }
 function equipmentReceipt(id){const p=store.lolc_case_payments.find(p=>p.id===id);if(!p)return;modal('Reçu · équipement Car na ngai','<section class="receipt"><h2>GM FLEET</h2><p>'+esc(ctx.apps.find(a=>a.id===p.application_id)?.name||'Dossier '+p.application_id)+'</p><p>Reçu de LOLC : <strong>'+money(p.amount,'USD')+'</strong></p><p>'+ctx.date(p.paid_on)+' · Référence '+esc(p.reference)+'</p><p>Forfait : équipement 130 $ · installation 20 $ · service 90 $</p></section><button class="primary" data-print-receipt>Imprimer le reçu</button>');}

 function modal(title,body){
  let dialog=$('financeDialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='financeDialog';dialog.className='case-dialog';document.body.append(dialog);}
  dialog.innerHTML=`<div class="dialog-title"><div><span class="eyebrow">GM FLEET / FINANCES</span><h2>${esc(title)}</h2></div><button type="button" class="icon" data-finance-close aria-label="Fermer">×</button></div>${body}`;
  if(!dialog.open)dialog.showModal();return dialog;
 }
 function formFooter(label){return `<div class="form-error" role="alert"></div><div class="form-footer"><button type="submit" class="primary">${label}</button></div>`;}
 function activation(){
  const eligible=ctx.apps.filter(a=>!store.contracts.some(c=>c.application_id===a.id&&c.status==='active')&&((a.program_type==='DRIVE_TO_OWN'&&a.lolc_status==='approved'&&a.workflow_stage==='handed_over')||(a.program_type==='PARTNER_DRIVER'&&['approved','available'].includes(a.workflow_stage))));
  if(!eligible.length){modal('Activer un contrat','<p class="section-note">Aucun dossier éligible. Pour Drive to Own, enregistrez l’approbation LOLC et la remise du véhicule. Pour Chauffeur Partenaire, approuvez le candidat.</p>');return;}
  modal('Activer un contrat',`<p class="section-note">Vérifiez les conditions signées avant l’activation. Les montants et l’échéancier seront conservés tels quels. Les versements commencent à la première date de paiement.</p><form id="activateForm"><div class="fields"><label class="wide">Dossier approuvé<select name="application_id">${options(eligible,'id',a=>`${a.name} · ${a.program_type==='DRIVE_TO_OWN'?'Drive to Own':'Partenaire'}`)}</select></label><label>Référence du contrat<input id="systemContractReference" value="Attribuée automatiquement à l’activation" readonly></label><label>Devise<select name="currency"><option>USD</option><option>CDF</option></select></label><label class="wide">Véhicule disponible dans la flotte<select name="fleet_vehicle"><option value="">Véhicule du dossier / à compléter si nécessaire</option>${options(store.vehicles.filter(v=>v.status==='Disponible'&&!store.contracts.some(c=>c.vehicle_id===v.id&&c.status==='active')),'id',v=>`${v.plate} · ${v.model}`)}</select></label><p class="muted wide">Les informations déjà enregistrées sont reprises automatiquement. Complétez ou vérifiez la plaque définitive avant l’activation.</p><label>Modèle *<input name="model" required maxlength="200"></label><label>Plaque *<input name="plate" required maxlength="60"></label><label>Châssis / VIN *<input name="vin" required maxlength="100"></label><label>Identifiant tracker *<input name="tracker_id" required maxlength="150"></label><label>Démarrage contractuel *<input type="date" name="start_date" max="${today()}" required value="${today()}"></label><label>Fin du contrat *<input type="date" name="end_date" required></label><label>Premier paiement *<input type="date" name="first_payment_date" required value="${today()}"></label><label>Part quotidienne LOLC *<input name="daily_lolc" type="number" step="0.01" min="0" required></label><label>Part quotidienne GML *<input name="daily_gml" type="number" step="0.01" min="0" required></label><fieldset class="wide day-picker"><legend>Jours de versement *</legend>${['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map((d,i)=>`<label class="check"><input name="operating_days" type="checkbox" value="${i+1}">${d}</label>`).join('')}</fieldset><label class="wide">Dates exclues convenues (facultatif)<textarea name="excluded_dates" placeholder="AAAA-MM-JJ, AAAA-MM-JJ"></textarea></label></div><p id="contractPreview" class="section-note">Renseignez les dates, jours et montants pour voir l’échéancier.</p><label class="check"><input type="checkbox" required>Les conditions correspondent au contrat signé et le véhicule est prêt à démarrer.</label>${formFooter('Activer le contrat et générer les échéances')}</form>`);
  const form=$('activateForm');
  const selectApplication=()=>{
   const app=eligible.find(a=>String(a.id)===form.elements.application_id.value);
   const saved=app?.preparation?.purchased_vehicle||{},equipment=app?.preparation?.equipment||{};
   form.elements.fleet_vehicle.value='';form.elements.fleet_vehicle.closest('label').hidden=app?.program_type==='DRIVE_TO_OWN';
   for(const key of ['model','plate','vin','tracker_id']){const value=app?.program_type==='DRIVE_TO_OWN'?(key==='tracker_id'?equipment.tracker_id:saved[key]):'';form.elements[key].value=value||'';form.elements[key].readOnly=key!=='plate'&&!!value;}
   form.querySelectorAll('[name=operating_days]').forEach(box=>box.checked=false);form.elements.excluded_dates.value='';
   form.elements.daily_lolc.value=app?.program_type==='PARTNER_DRIVER'?'0':'';form.elements.daily_gml.value='';form.elements.end_date.value='';form.elements.start_date.value=today();
   if(app?.lifecycle_version===2&&app.program_type==='DRIVE_TO_OWN'&&app.preparation?.handover_on){
    const d=new Date(app.preparation.handover_on+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);
    form.elements.first_payment_date.value=d.toISOString().slice(0,10);form.elements.first_payment_date.readOnly=true;
    form.elements.start_date.value=app.preparation.handover_on;
   }else{form.elements.first_payment_date.readOnly=false;form.elements.first_payment_date.value=today();}
   form.elements.fleet_vehicle.required=app?.lifecycle_version===2&&app.program_type==='PARTNER_DRIVER';
  };
  form.elements.application_id.addEventListener('change',selectApplication);selectApplication();
  form.elements.fleet_vehicle.addEventListener('change',()=>{const v=store.vehicles.find(v=>String(v.id)===form.elements.fleet_vehicle.value);['model','plate','vin','tracker_id'].forEach(k=>{form.elements[k].value=v?.[k]||'';form.elements[k].readOnly=!!v;});});
  const preview=()=>{
   const f=new FormData(form),app=eligible.find(a=>String(a.id)===f.get('application_id'));
   const loan=form.elements.daily_lolc;loan.readOnly=app.program_type==='PARTNER_DRIVER';if(loan.readOnly)loan.value='0';
   const days=f.getAll('operating_days').map(Number),first=f.get('first_payment_date'),end=f.get('end_date');let count=0;
   const excluded=f.get('excluded_dates').split(/[\s,;]+/).filter(Boolean);
   if(first&&end&&first<=end){for(let d=new Date(first+'T12:00:00Z'),i=0;d<=new Date(end+'T12:00:00Z')&&i<3654;d.setUTCDate(d.getUTCDate()+1),i++){if(days.includes(d.getUTCDay()||7)&&!excluded.includes(d.toISOString().slice(0,10)))count++;}}
   const total=(cents(loan.value)+cents(f.get('daily_gml')))/100;
   $('contractPreview').textContent=`${count} échéances · LOLC ${money(loan.value,f.get('currency'))}/jour + GM Fleet ${money(f.get('daily_gml'),f.get('currency'))}/jour = ${money(total,f.get('currency'))}/jour. Total LOLC : ${money(count*cents(loan.value)/100,f.get('currency'))} · Total GM Fleet : ${money(count*cents(f.get('daily_gml'))/100,f.get('currency'))} · Total du remboursement : ${money(count*total,f.get('currency'))}. Ces montants seront conservés avec le contrat.`;
  };
  form.addEventListener('input',preview);form.addEventListener('change',preview);preview();
  submit(form,'activate_contract',f=>({application_id:Number(f.get('application_id')),currency:f.get('currency'),model:f.get('model').trim(),plate:f.get('plate').trim(),vin:f.get('vin').trim(),tracker_id:f.get('tracker_id').trim(),start_date:f.get('start_date'),end_date:f.get('end_date'),first_payment_date:f.get('first_payment_date'),daily_lolc:f.get('daily_lolc'),daily_gml:f.get('daily_gml'),operating_days:f.getAll('operating_days').map(Number),excluded_dates:f.get('excluded_dates').split(/[\s,;]+/).filter(Boolean)}));
 }
 function payment(id){
  const active=store.contracts.filter(c=>c.status==='active'&&balances(c).total>0);
  if(!active.length){modal('Versement','<p>Aucun contrat actif avec un solde à régler.</p>');return;}
  modal('Recevoir des espèces', '<form id="paymentForm"><div class="fields"><label class="wide">1 · Rechercher le chauffeur<input id="cashDriverSearch" type="search" placeholder="Nom, téléphone ou plaque"></label><label class="wide">Chauffeur / contrat<select name="contract_id">'+options(active,'id',c=>driver(c)?.full_name+' · '+vehicle(c)?.plate+' · '+c.signed_reference,id)+'</select></label><p id="paymentPreview" class="section-note wide"></p><label class="wide">2 · Montant reçu<select id="paymentChoice"></select></label><label id="manualAmountLabel" class="wide" hidden>Montant complet reçu *<input name="amount" type="number" min="0.01" step="0.01" required></label><p id="cashFeePreview" class="section-note wide" aria-live="polite"></p><details class="wide"><summary>3 · Date et référence du reçu</summary><div class="fields"><label>Date de réception<input name="paid_on" type="date" value="'+today()+'" max="'+today()+'" required></label><label>Référence du reçu<input name="reference" value="CAISSE-'+today().replaceAll('-','')+'-'+crypto.randomUUID().slice(0,8).toUpperCase()+'" required maxlength="150"></label><label class="wide">Observation<input name="reason" value="Versement en espèces reçu au bureau" required maxlength="1000"></label><label class="wide">Justificatif facultatif<input name="proof" type="file" accept="application/pdf,image/jpeg,image/png,image/webp"></label></div></details><input name="method" type="hidden" value="Espèces"></div>'+formFooter('Confirmer les espèces reçues')+'</form>');
  const form=$('paymentForm'),choice=$('paymentChoice'),amount=form.elements.amount;
  const fees=()=>{const c=contract(form.elements.contract_id.value);if(!c)return;const split=window.GMFleetPaymentCalendar.split(c,store.repayment_schedules,store.payment_allocations,amount.value);$('cashFeePreview').textContent='Total reçu : '+money(amount.value,c.currency)+' = LOLC '+money(split.lolc,c.currency)+' + GML '+money(split.gml,c.currency)+'. Sans frais de transaction.';};
  const choose=()=>{const manual=choice.value==='manual';$('manualAmountLabel').hidden=!manual;amount.readOnly=!manual;if(!manual)amount.value=choice.value;else amount.value='';fees();};
  const preview=()=>{const c=contract(form.elements.contract_id.value);if(!c)return;const b=balances(c),q=collection(c);$('paymentPreview').textContent=esc(c.signed_reference)+' · '+(c.payment_frequency==='weekly'?'Hebdomadaire':'Quotidien')+' · À régler : '+money(q.total,c.currency)+' (aujourd’hui '+money(q.today,c.currency)+' + antérieur '+money(q.arrears,c.currency)+').';
   const choices=[];if(q.total>0)choices.push([q.total,'Toutes les échéances dues · '+money(q.total,c.currency)]);if(q.oldest&&q.due.length>1)choices.push([q.oldest.amount,'Une échéance : la plus ancienne ('+ctx.date(q.oldest.date)+') · '+money(q.oldest.amount,c.currency)]);if(!q.total&&q.next)choices.push([q.next.amount,'Avance pour le '+ctx.date(q.next.date)+' · '+money(q.next.amount,c.currency)]);choices.push(['manual','Saisir un autre montant']);choice.innerHTML=choices.map(([value,label])=>'<option value="'+value+'">'+esc(label)+'</option>').join('');amount.max=b.total;choose();};
  $('cashDriverSearch').addEventListener('input',e=>{const found=active.filter(c=>searchable(c,e.target.value));form.elements.contract_id.innerHTML=options(found,'id',c=>driver(c)?.full_name+' · '+vehicle(c)?.plate+' · '+c.signed_reference);form.querySelector('[type="submit"]').disabled=!found.length;if(found.length)preview();else{$('paymentPreview').textContent='Aucun chauffeur trouvé.';choice.innerHTML='';$('cashFeePreview').textContent='';amount.value='';}});
  form.elements.contract_id.addEventListener('change',preview);choice.addEventListener('change',choose);amount.addEventListener('input',fees);preview();
  submit(form,'confirm_cash_payment',f=>({contract_id:f.get('contract_id'),amount:f.get('amount'),received_total:null,paid_on:f.get('paid_on'),method:'Espèces',reference:f.get('reference').trim(),reason:f.get('reason').trim()}));
 }

 function showContract(id){
  const c=contract(id),b=balances(c),d=driver(c),v=vehicle(c);
  modal('Contrat · '+d.full_name,`<div class="badge-line"><span class="tag">${esc(c.signed_reference)}</span><span class="tag">${esc(c.currency)}</span><span class="tag">${c.status==='active'?'Actif':'Annulé'}</span></div><div class="stats"><div class="stat"><span>Reste aujourd’hui</span><strong class="amount">${money(b.due,c.currency)}</strong></div><div class="stat"><span>Retard</span><strong class="amount">${money(b.arrears,c.currency)}</strong></div><div class="stat"><span>Solde contractuel</span><strong class="amount">${money(b.total,c.currency)}</strong></div></div><dl class="details"><div><dt>Véhicule / plaque</dt><dd>${esc(v.model)} · ${esc(v.plate)}</dd></div><div><dt>Châssis / tracker</dt><dd>${esc(v.vin)} · ${esc(v.tracker_id)}</dd></div><div><dt>Période contractuelle</dt><dd>${ctx.date(c.start_date)} – ${ctx.date(c.end_date)}</dd></div>${c.vehicle_snapshot?.equipment?.sim_number?`<div><dt>SIM du tracker à l’activation</dt><dd>${esc(c.vehicle_snapshot.equipment.sim_number)} · ${esc(c.vehicle_snapshot.equipment.sim_operator)}</dd></div>`:''}<div><dt>Premier paiement</dt><dd>${ctx.date(c.first_payment_date)}</dd></div><div><dt>Rythme de règlement</dt><dd>${c.payment_frequency==='weekly'?'Hebdomadaire · dimanche (retard à partir du lundi)':'Quotidien'}</dd></div><div><dt>Total du remboursement prévu</dt><dd>${money(c.repayment_total??b.schedule.reduce((n,s)=>n+Number(s.lolc_due)+Number(s.gml_due),0),c.currency)} · ${c.repayment_count??b.schedule.length} échéances</dd></div><div><dt>Base quotidienne</dt><dd>LOLC ${money(c.daily_lolc,c.currency)} + GML ${money(c.daily_gml,c.currency)}</dd></div><div><dt>Jours de versement</dt><dd>${c.operating_days.map(n=>['','Lun','Mar','Mer','Jeu','Ven','Sam','Dim'][n]).join(', ')}</dd></div></dl><h3 style="margin-top:24px">Échéancier · ${b.schedule.length} échéances</h3><div class="table-wrap schedule-table"><table><thead><tr><th>Date</th><th>Attendu</th><th>Payé</th><th>Reste</th></tr></thead><tbody>${b.schedule.map(s=>`<tr><td>${ctx.date(s.due_on)}</td><td>${money(Number(s.lolc_due)+Number(s.gml_due),c.currency)}</td><td>${money(s.paid,c.currency)}</td><td>${money(s.remaining,c.currency)}</td></tr>`).join('')}</tbody></table></div><h3 style="margin-top:24px">Versements</h3>${paymentsTable(store.payments.filter(p=>p.contract_id===c.id))}${c.status==='active'&&cashier()?`<button class="primary" data-pay="${c.id}">Enregistrer un versement</button>`:''}${c.status==='active'&&['super_admin','admin'].includes(role())?`<details style="margin-top:24px"><summary>Contrat créé par erreur</summary><p class="muted">Annulation possible uniquement sans encaissement net. Les conditions et l’affectation restent dans l’historique.</p><form id="voidForm"><label>Motif<textarea name="reason" required></textarea></label>${formFooter('Annuler ce contrat')}</form></details>`:''}`);
  if(c.status==='active'&&cashier()){
   const b=document.createElement('button');b.className='secondary';b.textContent='Créer / renouveler le lien de paiement chauffeur';b.onclick=()=>paymentLink(c.id);$('financeDialog').append(b);
  }
  if($('voidForm'))submit($('voidForm'),'void_contract',f=>({contract_id:c.id,reason:f.get('reason').trim()}));
 }

 function receipt(id){
  const p=store.payments.find(p=>p.id===Number(id)),c=contract(p.contract_id);
  modal(p.entry_kind==='reversal'?'Contre-écriture':'Reçu de versement',`<section class="receipt"><h2>GM FLEET</h2><p>Référence : <strong>${esc(p.reference)}</strong></p><dl class="details"><div><dt>Chauffeur</dt><dd>${esc(p.driver_name)}</dd></div><div><dt>Contrat / véhicule</dt><dd>${esc(c.signed_reference)} · ${esc(vehicle(c)?.plate)}</dd></div><div><dt>Montant</dt><dd>${p.entry_kind==='reversal'?'−':''}${money(p.amount,c.currency)}</dd></div><div><dt>Part LOLC</dt><dd>${money(p.lolc_amount,c.currency)}</dd></div><div><dt>Part GML</dt><dd>${money(Number(p.amount)-Number(p.lolc_amount),c.currency)}</dd></div><div><dt>Frais de transaction</dt><dd>${money(p.transaction_fee||0,c.currency)}</dd></div><div><dt>Total ${p.entry_kind==='reversal'?'annulé':'reçu'}</dt><dd>${money(p.total_charged??p.amount,c.currency)}</dd></div><div><dt>Date de réception</dt><dd>${ctx.date(p.paid_on)}</dd></div><div><dt>Méthode</dt><dd>${esc(p.method.replace(/Araka/gi,'Mobile Money'))}</dd></div><div><dt>Confirmé par</dt><dd>${esc(p.method.startsWith('Araka ')?'Paiement digital — confirmé automatiquement':ctx.person(p.recorded_by))}</dd></div></dl><p>${esc(p.reason)}</p>${reversed(p)?'<p class="form-error">Ce versement a été annulé par une contre-écriture.</p>':''}<small class="muted">Enregistré le ${ctx.date(p.created_at,true)} · GM Fleet</small></section><div class="form-footer no-print"><button class="primary" data-print-receipt>Imprimer le reçu</button></div>`);
 }

 async function submitProof(form,file){
  if(!file?.size)return null;
  if(form.proofFile===file&&form.proofPath)return form.proofPath;
  const ext={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
  if(!ext||file.size>10485760)throw Error('Justificatif : PDF, JPG, PNG ou WebP, 10 Mo maximum.');
  const path=crypto.randomUUID()+'.'+ext;
  const {error}=await ctx.db.storage.from('finance-proofs').upload(path,file,{contentType:file.type,upsert:false});if(error)throw error;
  form.proofFile=file;form.proofPath=path;return path;
 }
 function submit(form,rpc,payload){
  form.dataset.requestId=crypto.randomUUID();
  form.addEventListener('submit',async e=>{
   e.preventDefault();const button=form.querySelector('[type="submit"]'),error=form.querySelector('.form-error');button.disabled=true;error.textContent='';let committed=false;
   try{
    const f=new FormData(form),p={...payload(f),request_id:form.dataset.requestId};
    if(f.has('proof'))p.proof_path=await submitProof(form,form.elements.proof.files[0]);
    const result=await ctx.db.rpc(rpc,{p});if(result.error)throw result.error;committed=true;
    $('financeDialog').close();await load();paint();ctx.notify('Opération enregistrée et confirmée.');
   }catch(e){if(committed)ctx.notify('Opération enregistrée, mais actualisation indisponible. Cliquez sur Actualiser avant de continuer.',true);else error.textContent=e.message||'Impossible d’enregistrer. Réessayez.';}finally{button.disabled=false;}
  });
 }
 document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b||!ctx)return;
  if(b.dataset.arakaCheck){b.disabled=true;try{const result=await arakaCall(b.dataset.arakaCheck?{action:'staff-check',id:b.dataset.arakaCheck}:{action:'health'});ctx.notify(result.connected?'Paiement digital connecté':'Statut du paiement vérifié');await load();paint();}catch(error){ctx.notify(String(error.message).replace(/Araka/gi,'paiement digital'),true);}finally{b.disabled=false;}}
  if(b.hasAttribute('data-history-page')){historyPage=Math.max(0,Number(b.dataset.historyPage));$('paymentHistory').innerHTML=historyTable();}
  if(b.dataset.cashView){cashView=b.dataset.cashView;paintPayments();}
  if(b.dataset.bilanView){bilanView=b.dataset.bilanView;paintDeposits();}
  if(b.dataset.paymentLink)paymentLink(b.dataset.paymentLink);
  if(b.dataset.equipmentReceipt)equipmentReceipt(b.dataset.equipmentReceipt);
  if(b.hasAttribute('data-finance-close'))$('financeDialog').close();
  if(b.dataset.finance==='export-contracts')exportContracts();
  if(b.dataset.finance==='activate')activation();if(b.dataset.finance==='payment')payment();
  if(b.dataset.receipt)receipt(b.dataset.receipt);if(b.hasAttribute('data-print-receipt'))window.print();
  if(b.dataset.contract)showContract(b.dataset.contract);if(b.dataset.pay)payment(b.dataset.pay);
  if(b.dataset.proof){const tab=window.open('about:blank','_blank');if(tab)tab.opener=null;try{const {data,error}=await ctx.db.storage.from('finance-proofs').createSignedUrl(b.dataset.proof,120);if(error)throw error;if(tab)tab.location=data.signedUrl;else throw Error('Autorisez les fenêtres pour ouvrir le justificatif.');}catch(e){tab?.close();ctx.notify(e.message,true);}}
 });
 document.addEventListener('keydown',e=>{const tab=e.target.closest('.finance-tabs [role="tab"]');if(!tab||!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return;e.preventDefault();const buttons=[...tab.parentElement.querySelectorAll('[role="tab"]')],i=buttons.indexOf(tab),n=e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[n].click();document.querySelectorAll('.finance-tabs [role="tab"]')[n]?.focus();});
 document.addEventListener('input',e=>{if(e.target.id==='collectionSearch'){collectionSearch=e.target.value;$('collectionResults').innerHTML=collectionCards();}if(e.target.id==='historySearch'){historySearch=e.target.value;historyPage=0;$('paymentHistory').innerHTML=historyTable();}});
 document.addEventListener('change',e=>{if(e.target.id==='bilanFrom'||e.target.id==='bilanTo'){bilanFrom=$('bilanFrom').value;bilanTo=$('bilanTo').value;paintDeposits();}});
 return {render};
})();
