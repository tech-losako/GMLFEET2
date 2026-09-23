/* Contract terms and money movements are validated atomically by database RPCs. */
window.GMFleetFinance = (() => {
 'use strict';
 let ctx,view,store={};
 const $=id=>document.getElementById(id),esc=v=>ctx.escape(v),money=(n,c)=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:c}).format(Number(n||0));
 const cents=n=>Math.round(Number(n||0)*100),sum=(rows,key)=>rows.reduce((n,r)=>n+cents(r[key]),0)/100;
 const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Kinshasa',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const role=()=>ctx.staff.find(s=>s.user_id===ctx.user.id)?.role;
 const cashier=()=>['super_admin','admin','cashier'].includes(role());
 const contract=id=>store.contracts.find(c=>c.id===id),driver=c=>store.drivers.find(d=>d.id===c.driver_id),vehicle=c=>store.vehicles.find(v=>v.id===c.vehicle_id);
 const reversed=p=>store.payments.some(r=>r.reverses_payment_id===p.id),deposited=p=>store.lolc_deposit_items.some(i=>i.payment_id===p.id);
 const validPayments=()=>store.payments.filter(p=>p.contract_id&&p.entry_kind==='payment'&&!reversed(p));
 const pending=()=>validPayments().filter(p=>Number(p.lolc_amount)>0&&!deposited(p));
 const options=(list,key,label,selected)=>list.map(x=>`<option value="${esc(x[key])}" ${x[key]===selected?'selected':''}>${esc(label(x))}</option>`).join('');
 function balances(c) {
  let due=0,arrears=0,total=0;const date=today();
  const schedule=store.repayment_schedules.filter(s=>s.contract_id===c.id).map(s=>{
   const paid=store.payment_allocations.filter(a=>a.schedule_id===s.id).reduce((n,a)=>n+cents(a.amount),0);
   const remaining=cents(s.lolc_due)+cents(s.gml_due)-paid;
   total+=remaining;if(s.due_on===date)due+=remaining;if(s.due_on<date)arrears+=remaining;
   return {...s,paid:paid/100,remaining:remaining/100};
  });
  return {due:c.status==='active'?due/100:0,arrears:c.status==='active'?arrears/100:0,total:c.status==='active'?total/100:0,schedule};
 }
 async function load(){
  const names=['contracts','drivers','vehicles','repayment_schedules','payments','payment_allocations','lolc_deposits','lolc_deposit_items','finance_events','araka_attempts'];
  const data=await Promise.all(names.map(t=>ctx.rows(t,q=>t==='araka_attempts'?q.select('id,contract_id,reference,amount,transaction_fee,total_charged,currency,provider,state,transaction_id,receipt_id,created_at,last_checked_at,verified_at,review_reason').order('created_at'):t==='payment_allocations'?q.order('payment_id').order('schedule_id'):t==='lolc_deposit_items'?q.order('deposit_id').order('payment_id'):q.order('id'))));
  store=Object.fromEntries(names.map((n,i)=>[n,data[i]]));
 }
 async function render(selected,context){
  view=selected;ctx=context;
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
  $('content').innerHTML=`<div class="card-heading"><p class="muted">Les échéances commencent à la date prévue au contrat, jamais à la candidature.</p><div class="header-actions"><button class="secondary" data-finance="export-contracts" ${store.contracts.length?'':'disabled'}>Exporter les contrats (CSV)</button><button class="primary" data-finance="activate">＋ Activer un contrat</button></div></div><div class="stats"><div class="stat"><span>Contrats actifs</span><strong>${active.length}</strong><small>Chauffeurs et véhicules affectés</small></div><div class="stat"><span>Drive to Own</span><strong>${active.filter(c=>c.contract_type==='DRIVE_TO_OWN').length}</strong><small>Remboursement LOLC + frais GML</small></div><div class="stat"><span>Chauffeurs Partenaires</span><strong>${active.filter(c=>c.contract_type==='PARTNER_DRIVER').length}</strong><small>Versements selon contrat</small></div><div class="stat"><span>Contrats avec retard</span><strong>${active.filter(c=>balances(c).arrears>0).length}</strong><small>Échéances antérieures à aujourd’hui</small></div></div><section class="card"><h3>Contrats et affectations</h3>${store.contracts.length?`<div class="table-wrap"><table><thead><tr><th>Chauffeur / contrat</th><th>Véhicule</th><th>Versement par jour</th><th>Retard</th><th>Statut</th></tr></thead><tbody>${store.contracts.map(c=>`<tr><td><button class="link-button" data-contract="${c.id}">${esc(driver(c)?.full_name)}</button><small>${esc(c.signed_reference)} · ${ctx.date(c.start_date)}</small></td><td>${esc(vehicle(c)?.model)}<small>${esc(vehicle(c)?.plate)}</small></td><td>${money(Number(c.daily_lolc)+Number(c.daily_gml),c.currency)}<small>LOLC ${money(c.daily_lolc,c.currency)} · GML ${money(c.daily_gml,c.currency)}</small></td><td>${c.status==='active'?money(balances(c).arrears,c.currency):'—'}</td><td><span class="tag ${c.status==='active'?'green':''}">${c.status==='active'?'Actif':'Annulé'}</span></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Aucun contrat. Terminez le dossier et la remise du véhicule avant l’activation.</div>'}</section>`;
 }
 function paintPayments(){
  const active=store.contracts.filter(c=>c.status==='active');
  $('content').innerHTML=`<div class="card-heading"><p class="muted">Le caissier confirme lui-même les versements reçus. Les montants sont affectés aux échéances les plus anciennes.</p>${cashier()?'<button class="primary" data-finance="payment">＋ Enregistrer un versement</button>':''}</div><div class="stats">${['USD','CDF'].map(currency=>{
   const cs=active.filter(c=>c.currency===currency);const ps=store.payments.filter(p=>contract(p.contract_id)?.currency===currency&&p.paid_on===today());const net=ps.reduce((n,p)=>n+(p.entry_kind==='reversal'?-1:1)*cents(p.amount),0)/100;
   return `<div class="stat"><span>Net encaissé aujourd’hui · ${currency}</span><strong class="amount">${money(net,currency)}</strong><small>Versements moins annulations du jour</small></div><div class="stat"><span>Retards · ${currency}</span><strong class="amount">${money(cs.reduce((n,c)=>n+cents(balances(c).arrears),0)/100,currency)}</strong><small>Aucune conversion de devise</small></div>`;
  }).join('')}</div><section class="card"><h3>Paiements Araka</h3>${arakaTable()}</section><section class="card"><h3>À encaisser / à relancer</h3>${active.length?active.map(c=>{const b=balances(c);return `<div class="row"><div><button class="link-button" data-contract="${c.id}">${esc(driver(c)?.full_name)}</button><small>${esc(vehicle(c)?.plate)} · Aujourd’hui ${money(b.due,c.currency)} · Retard ${money(b.arrears,c.currency)}</small></div>${cashier()?`<button class="secondary" data-pay="${c.id}">Encaisser</button>`:''}</div>`;}).join(''):'<p class="empty">Aucun contrat actif.</p>'}</section><section class="card"><h3>Historique des encaissements</h3>${paymentsTable(store.payments.filter(p=>p.contract_id).slice().reverse())}</section>`;
 }
 async function arakaCall(body){const {data,error}=await ctx.db.functions.invoke('araka-payments',{body});if(error){let message=error.message;try{message=(await error.context.json()).error||message;}catch{}throw new Error(message);}return data;}
 function arakaTable(){return `${cashier()?'<button class="secondary" data-araka-health>Vérifier la connexion Araka</button>':''}${store.araka_attempts.length?store.araka_attempts.slice().reverse().map(a=>`<div class="row"><div><strong>${esc(driver(contract(a.contract_id))?.full_name)} · ${money(a.total_charged??a.amount,a.currency)}</strong><small>Versement : ${money(a.amount,a.currency)} · Frais : ${money(a.transaction_fee||0,a.currency)}</small><small>${esc(a.reference)} · ${esc({pending:'En attente',approved:'Confirmé',declined:'Refusé',review:'À rapprocher par la caisse'}[a.state])}</small>${a.review_reason?`<small>${esc(a.review_reason)}</small>`:''}</div>${cashier()&&a.state!=='approved'?`<button class="secondary" data-araka-check="${a.id}">Vérifier Araka</button>`:''}</div>`).join(''):'<p class="muted">Aucun paiement Araka.</p>'}`;}
 async function paymentLink(id){
  try{const token=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b=>b.toString(16).padStart(2,'0')).join('');const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(b=>b.toString(16).padStart(2,'0')).join('');
   const {error}=await ctx.db.rpc('set_driver_payment_link',{p:{contract_id:id,token_hash:hash}});if(error)throw error;
   modal('Lien de paiement chauffeur','<p>Partagez ce lien uniquement avec le chauffeur. Le renouvellement invalide le lien précédent.</p><textarea id="driverPaymentLink" readonly rows="4"></textarea><button class="primary" id="copyDriverLink">Copier le lien</button>');
   const link='https://gmfleet.georgemichaellogistics.cd/payer.html#token='+token;$('driverPaymentLink').value=link;$('copyDriverLink').onclick=async()=>{try{await navigator.clipboard.writeText(link);$('copyDriverLink').textContent='Copié';}catch{$('driverPaymentLink').select();}};
  }catch(error){ctx.notify(error.message,true);}
 }
 function paymentsTable(payments){
  if(!payments.length)return '<p class="empty">Aucun versement enregistré.</p>';
  return `<div class="table-wrap"><table><thead><tr><th>Date / référence</th><th>Chauffeur</th><th>Montant</th><th>Caisse</th><th>Statut / action</th></tr></thead><tbody>${payments.map(p=>{const c=contract(p.contract_id);return `<tr><td>${ctx.date(p.paid_on)}<small>${esc(p.reference)} · ${esc(p.method)}</small></td><td>${esc(p.driver_name)}<small>${esc(p.reason)}</small></td><td>${p.entry_kind==='reversal'?'−':''}${money(p.amount,c.currency)}<small>Frais : ${money(p.transaction_fee||0,c.currency)} · Total : ${money(p.total_charged??p.amount,c.currency)}</small><small>Part LOLC : ${money(p.lolc_amount,c.currency)}</small></td><td>${esc(p.method.startsWith('Araka ')?'Araka — vérifié automatiquement':ctx.person(p.recorded_by))}<small>${ctx.date(p.created_at,true)}</small></td><td><span class="tag ${p.entry_kind==='reversal'||reversed(p)?'red':'green'}">${p.entry_kind==='reversal'?'Annulation':reversed(p)?'Annulé':deposited(p)?'Déposé à LOLC':'Confirmé'}</span><button class="link-button" data-receipt="${p.id}">Reçu</button>${p.proof_path?`<button class="link-button" data-proof="${esc(p.proof_path)}">Justificatif</button>`:''}${cashier()&&!p.method.startsWith('Araka ')&&p.entry_kind==='payment'&&!reversed(p)&&!deposited(p)?`<button class="link-button" data-reverse="${p.id}">Annuler avec motif</button>`:''}</td></tr>`;}).join('')}</tbody></table></div>`;
 }
 function paintDeposits(){
  const outstanding=pending();
  $('content').innerHTML=`<div class="card-heading"><p class="muted">Enregistrez un dépôt bancaire déjà effectué. Cette action ne transfère pas d’argent et ne modifie pas le solde des chauffeurs.</p>${cashier()?'<button class="primary" data-finance="deposit">＋ Enregistrer le dépôt LOLC</button>':''}</div><div class="stats">${['USD','CDF'].map(currency=>`<div class="stat"><span>Part LOLC à déposer · ${currency}</span><strong class="amount">${money(sum(outstanding.filter(p=>contract(p.contract_id)?.currency===currency),'lolc_amount'),currency)}</strong><small>Encaissements confirmés non rapprochés</small></div>`).join('')}</div><section class="card"><h3>Versements en attente de rapprochement</h3>${outstanding.length?paymentsTable(outstanding):'<p class="empty">Aucun versement à rapprocher.</p>'}</section><section class="card"><h3>Dépôts enregistrés</h3>${store.lolc_deposits.length?store.lolc_deposits.slice().reverse().map(d=>`<div class="row"><div><button class="link-button" data-deposit="${d.id}">${money(d.amount,d.currency)} · ${esc(d.bank_reference)}</button><small>Période ${ctx.date(d.period_start)} – ${ctx.date(d.period_end)} · Dépôt ${ctx.date(d.deposited_on)}</small><small>${store.lolc_deposit_items.filter(i=>i.deposit_id===d.id).length} versement(s) · ${esc(ctx.person(d.recorded_by))}</small></div><button class="link-button" data-proof="${esc(d.proof_path)}">Justificatif</button></div>`).join(''):'<p class="empty">Aucun dépôt enregistré.</p>'}</section>`;
 }
 function modal(title,body){
  let dialog=$('financeDialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='financeDialog';dialog.className='case-dialog';document.body.append(dialog);}
  dialog.innerHTML=`<div class="dialog-title"><div><span class="eyebrow">GM FLEET / FINANCES</span><h2>${esc(title)}</h2></div><button type="button" class="icon" data-finance-close aria-label="Fermer">×</button></div>${body}`;
  if(!dialog.open)dialog.showModal();return dialog;
 }
 function formFooter(label){return `<div class="form-error" role="alert"></div><div class="form-footer"><button type="submit" class="primary">${label}</button></div>`;}
 function activation(){
  const eligible=ctx.apps.filter(a=>!store.contracts.some(c=>c.application_id===a.id&&c.status==='active')&&((a.program_type==='DRIVE_TO_OWN'&&a.lolc_status==='approved'&&a.workflow_stage==='handed_over')||(a.program_type==='PARTNER_DRIVER'&&['approved','available'].includes(a.workflow_stage))));
  if(!eligible.length){modal('Activer un contrat','<p class="section-note">Aucun dossier éligible. Pour Drive to Own, enregistrez l’approbation LOLC et la remise du véhicule. Pour Chauffeur Partenaire, approuvez le candidat.</p>');return;}
  modal('Activer un contrat',`<p class="section-note">Vérifiez les conditions signées avant l’activation. Les montants et l’échéancier seront conservés tels quels. Les versements commencent à la première date de paiement.</p><form id="activateForm"><div class="fields"><label class="wide">Dossier approuvé<select name="application_id">${options(eligible,'id',a=>`${a.name} · ${a.program_type==='DRIVE_TO_OWN'?'Drive to Own':'Partenaire'}`)}</select></label><label>Référence du contrat signé *<input name="signed_reference" required maxlength="150"></label><label>Devise<select name="currency"><option>USD</option><option>CDF</option></select></label><label>Modèle *<input name="model" required maxlength="200"></label><label>Plaque *<input name="plate" required maxlength="60"></label><label>Châssis / VIN *<input name="vin" required maxlength="100"></label><label>Identifiant tracker *<input name="tracker_id" required maxlength="150"></label><label>Démarrage contractuel *<input type="date" name="start_date" max="${today()}" required value="${today()}"></label><label>Fin du contrat *<input type="date" name="end_date" required></label><label>Premier paiement *<input type="date" name="first_payment_date" required value="${today()}"></label><label>Part quotidienne LOLC *<input name="daily_lolc" type="number" step="0.01" min="0" required></label><label>Part quotidienne GML *<input name="daily_gml" type="number" step="0.01" min="0" required></label><fieldset class="wide day-picker"><legend>Jours de versement *</legend>${['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map((d,i)=>`<label class="check"><input name="operating_days" type="checkbox" value="${i+1}">${d}</label>`).join('')}</fieldset><label class="wide">Dates exclues convenues (facultatif)<textarea name="excluded_dates" placeholder="AAAA-MM-JJ, AAAA-MM-JJ"></textarea></label></div><p id="contractPreview" class="section-note">Renseignez les dates, jours et montants pour voir l’échéancier.</p><label class="check"><input type="checkbox" required>Les conditions correspondent au contrat signé et le véhicule est prêt à démarrer.</label>${formFooter('Activer le contrat et générer les échéances')}</form>`);
  const form=$('activateForm');
  const preview=()=>{
   const f=new FormData(form),app=eligible.find(a=>String(a.id)===f.get('application_id'));
   const loan=form.elements.daily_lolc;loan.readOnly=app.program_type==='PARTNER_DRIVER';if(loan.readOnly)loan.value='0';
   const days=f.getAll('operating_days').map(Number),first=f.get('first_payment_date'),end=f.get('end_date');let count=0;
   const excluded=f.get('excluded_dates').split(/[\s,;]+/).filter(Boolean);
   if(first&&end&&first<=end){for(let d=new Date(first+'T12:00:00Z'),i=0;d<=new Date(end+'T12:00:00Z')&&i<3654;d.setUTCDate(d.getUTCDate()+1),i++){if(days.includes(d.getUTCDay()||7)&&!excluded.includes(d.toISOString().slice(0,10)))count++;}}
   const total=(cents(loan.value)+cents(f.get('daily_gml')))/100;
   $('contractPreview').textContent=`${count} échéances × ${money(total,f.get('currency'))} = ${money(count*total,f.get('currency'))}. Répartition proportionnelle LOLC/GML lors des paiements partiels.`;
  };
  form.addEventListener('input',preview);form.addEventListener('change',preview);preview();
  submit(form,'activate_contract',f=>({application_id:Number(f.get('application_id')),signed_reference:f.get('signed_reference').trim(),currency:f.get('currency'),model:f.get('model').trim(),plate:f.get('plate').trim(),vin:f.get('vin').trim(),tracker_id:f.get('tracker_id').trim(),start_date:f.get('start_date'),end_date:f.get('end_date'),first_payment_date:f.get('first_payment_date'),daily_lolc:f.get('daily_lolc'),daily_gml:f.get('daily_gml'),operating_days:f.getAll('operating_days').map(Number),excluded_dates:f.get('excluded_dates').split(/[\s,;]+/).filter(Boolean)}));
 }
 function payment(id){
  const active=store.contracts.filter(c=>c.status==='active'&&balances(c).total>0);
  if(!active.length){modal('Versement','<p class="section-note">Aucun contrat actif avec un solde à régler.</p>');return;}
  modal('Confirmer un versement reçu',`<p class="section-note">Confirmez uniquement l’argent réellement reçu ou vérifié. Votre identité et l’heure de confirmation seront enregistrées.</p><form id="paymentForm"><div class="fields"><label class="wide">Contrat<select name="contract_id">${options(active,'id',c=>`${driver(c)?.full_name} · ${vehicle(c)?.plate} · ${c.currency}`,id)}</select></label><label>Versement au contrat (hors frais) *<input name="amount" type="number" min="0.01" step="0.01" required></label><label>Date de réception *<input name="paid_on" type="date" value="${today()}" max="${today()}" required></label><label>Méthode<select name="method">${['Espèces','M-Pesa','Orange Money','Airtel Money','Afrimoney','Virement'].map(x=>`<option>${x}</option>`).join('')}</select></label><label>Numéro de reçu / référence *<input name="reference" required maxlength="150"></label><label class="wide">Motif / observation *<input name="reason" required maxlength="1000" placeholder="Versement reçu à la caisse"></label><label class="wide">Justificatif (facultatif)<input name="proof" type="file" accept="application/pdf,image/jpeg,image/png,image/webp"></label></div><p id="paymentPreview" class="section-note"></p><p id="cashFeePreview" class="section-note" aria-live="polite"></p><label id="receivedTotalLabel" hidden>Total Mobile Money réellement reçu (frais inclus) *<input name="received_total" type="number" step="0.01" min="0.01"></label>${formFooter('Confirmer l’encaissement')}</form>`);
  const form=$('paymentForm');const preview=()=>{const c=contract(form.elements.contract_id.value),b=balances(c);$('paymentPreview').textContent=`${c.currency} · Aujourd’hui : ${money(b.due,c.currency)} · Retard : ${money(b.arrears,c.currency)} · Solde total : ${money(b.total,c.currency)}. Les avances sont possibles dans la limite du solde.`;};form.elements.contract_id.addEventListener('change',preview);preview();
  const fees=()=>{const mobile=['M-Pesa','Orange Money','Airtel Money','Afrimoney'].includes(form.elements.method.value),c=contract(form.elements.contract_id.value),cents=Math.round(Number(form.elements.amount.value)*100),fee=mobile?Math.round(cents*3/100):0; $('cashFeePreview').textContent='Frais Mobile Money : '+money(fee/100,c.currency)+' · Total à recevoir : '+money((cents+fee)/100,c.currency);$('receivedTotalLabel').hidden=!mobile;form.elements.received_total.required=mobile;};
  form.addEventListener('input',fees);form.addEventListener('change',fees);fees();
  submit(form,'confirm_cash_payment',f=>({contract_id:f.get('contract_id'),amount:f.get('amount'),received_total:f.get('received_total')||null,paid_on:f.get('paid_on'),method:f.get('method'),reference:f.get('reference').trim(),reason:f.get('reason').trim()}));
 }
 function deposit(){
  modal('Enregistrer un dépôt hebdomadaire LOLC',`<form id="depositForm"><div class="fields"><label>Devise<select name="currency"><option>USD</option><option>CDF</option></select></label><label>Date du dépôt effectué *<input name="deposited_on" type="date" value="${today()}" max="${today()}" required></label><label>Versements reçus du *<input name="period_start" type="date" required></label><label>Au *<input name="period_end" type="date" value="${today()}" required></label></div><div id="depositChoices" class="section-note">Choisissez une période.</div><div class="fields"><label>Montant réellement déposé *<input name="amount" type="number" step="0.01" min="0.01" required></label><label>Référence bancaire *<input name="bank_reference" required maxlength="200"></label><label class="wide">Justificatif bancaire *<input name="proof" type="file" required accept="application/pdf,image/jpeg,image/png,image/webp"></label></div><p class="muted">Le montant doit correspondre exactement à la part LOLC des versements cochés. Les frais GML restent exclus.</p>${formFooter('Confirmer le rapprochement')}</form>`);
  const form=$('depositForm');
  const refresh=()=>{const f=new FormData(form),items=pending().filter(p=>contract(p.contract_id)?.currency===f.get('currency')&&p.paid_on>=f.get('period_start')&&p.paid_on<=f.get('period_end')&&p.paid_on<=f.get('deposited_on'));$('depositChoices').innerHTML=items.length?items.map(p=>`<label class="check"><input type="checkbox" name="payment_ids" value="${p.id}" checked>${esc(p.driver_name)} · ${ctx.date(p.paid_on)} · ${esc(p.reference)} · LOLC ${money(p.lolc_amount,f.get('currency'))}</label>`).join(''):'Aucun versement disponible pour cette période.';updateTotal();};
  const updateTotal=()=>{const f=new FormData(form),ids=f.getAll('payment_ids').map(Number);let total=sum(pending().filter(p=>ids.includes(p.id)),'lolc_amount');let element=$('depositTotal');if(!element){element=document.createElement('p');element.id='depositTotal';$('depositChoices').append(element);}element.textContent='Part LOLC sélectionnée : '+money(total,f.get('currency'));};
  ['currency','period_start','period_end','deposited_on'].forEach(k=>form.elements[k].addEventListener('change',refresh));$('depositChoices').addEventListener('change',updateTotal);
  submit(form,'record_lolc_deposit',f=>({currency:f.get('currency'),period_start:f.get('period_start'),period_end:f.get('period_end'),deposited_on:f.get('deposited_on'),amount:f.get('amount'),bank_reference:f.get('bank_reference').trim(),payment_ids:f.getAll('payment_ids').map(Number)}));
 }
 function reverse(id){const p=store.payments.find(p=>p.id===Number(id));modal('Annuler un encaissement',`<p>${esc(p.driver_name)} · ${money(p.amount,contract(p.contract_id).currency)} · ${esc(p.reference)}</p><p class="section-note">L’écriture d’origine reste conservée. Une contre-écriture rétablira les échéances correspondantes.</p><form id="reverseForm"><label>Motif obligatoire<textarea name="reason" required maxlength="2000"></textarea></label>${formFooter('Confirmer l’annulation')}</form>`);submit($('reverseForm'),'reverse_cash_payment',f=>({payment_id:p.id,reason:f.get('reason').trim()}));}
 function showContract(id){
  const c=contract(id),b=balances(c),d=driver(c),v=vehicle(c);
  modal('Contrat · '+d.full_name,`<div class="badge-line"><span class="tag">${esc(c.signed_reference)}</span><span class="tag">${esc(c.currency)}</span><span class="tag">${c.status==='active'?'Actif':'Annulé'}</span></div><div class="stats"><div class="stat"><span>Reste aujourd’hui</span><strong class="amount">${money(b.due,c.currency)}</strong></div><div class="stat"><span>Retard</span><strong class="amount">${money(b.arrears,c.currency)}</strong></div><div class="stat"><span>Solde contractuel</span><strong class="amount">${money(b.total,c.currency)}</strong></div></div><dl class="details"><div><dt>Véhicule / plaque</dt><dd>${esc(v.model)} · ${esc(v.plate)}</dd></div><div><dt>Châssis / tracker</dt><dd>${esc(v.vin)} · ${esc(v.tracker_id)}</dd></div><div><dt>Période contractuelle</dt><dd>${ctx.date(c.start_date)} – ${ctx.date(c.end_date)}</dd></div><div><dt>Premier paiement</dt><dd>${ctx.date(c.first_payment_date)}</dd></div><div><dt>Versement quotidien</dt><dd>LOLC ${money(c.daily_lolc,c.currency)} + GML ${money(c.daily_gml,c.currency)}</dd></div><div><dt>Jours de versement</dt><dd>${c.operating_days.map(n=>['','Lun','Mar','Mer','Jeu','Ven','Sam','Dim'][n]).join(', ')}</dd></div></dl><h3 style="margin-top:24px">Échéancier · ${b.schedule.length} échéances</h3><div class="table-wrap schedule-table"><table><thead><tr><th>Date</th><th>Attendu</th><th>Payé</th><th>Reste</th></tr></thead><tbody>${b.schedule.map(s=>`<tr><td>${ctx.date(s.due_on)}</td><td>${money(Number(s.lolc_due)+Number(s.gml_due),c.currency)}</td><td>${money(s.paid,c.currency)}</td><td>${money(s.remaining,c.currency)}</td></tr>`).join('')}</tbody></table></div><h3 style="margin-top:24px">Versements</h3>${paymentsTable(store.payments.filter(p=>p.contract_id===c.id))}${c.status==='active'&&cashier()?`<button class="primary" data-pay="${c.id}">Enregistrer un versement</button>`:''}${c.status==='active'&&['super_admin','admin'].includes(role())?`<details style="margin-top:24px"><summary>Contrat créé par erreur</summary><p class="muted">Annulation possible uniquement sans encaissement net. Les conditions et l’affectation restent dans l’historique.</p><form id="voidForm"><label>Motif<textarea name="reason" required></textarea></label>${formFooter('Annuler ce contrat')}</form></details>`:''}`);
  if(c.status==='active'&&cashier()){
   const b=document.createElement('button');b.className='secondary';b.textContent='Créer / renouveler le lien de paiement chauffeur';b.onclick=()=>paymentLink(c.id);$('financeDialog').append(b);
  }
  if($('voidForm'))submit($('voidForm'),'void_contract',f=>({contract_id:c.id,reason:f.get('reason').trim()}));
 }

 function showDeposit(id){
  const d=store.lolc_deposits.find(d=>d.id===id),ids=store.lolc_deposit_items.filter(i=>i.deposit_id===id).map(i=>i.payment_id);
  modal('Dépôt LOLC · '+d.bank_reference,`<p><strong>${money(d.amount,d.currency)}</strong> · Déposé le ${ctx.date(d.deposited_on)}</p><p class="muted">Versements du ${ctx.date(d.period_start)} au ${ctx.date(d.period_end)} · Enregistré par ${esc(ctx.person(d.recorded_by))}</p>${paymentsTable(store.payments.filter(p=>ids.includes(p.id)))}<button class="secondary" data-proof="${esc(d.proof_path)}">Ouvrir le justificatif bancaire</button>`);
 }
 function receipt(id){
  const p=store.payments.find(p=>p.id===Number(id)),c=contract(p.contract_id);
  modal(p.entry_kind==='reversal'?'Contre-écriture':'Reçu de versement',`<section class="receipt"><h2>GM FLEET</h2><p>Référence : <strong>${esc(p.reference)}</strong></p><dl class="details"><div><dt>Chauffeur</dt><dd>${esc(p.driver_name)}</dd></div><div><dt>Contrat / véhicule</dt><dd>${esc(c.signed_reference)} · ${esc(vehicle(c)?.plate)}</dd></div><div><dt>Montant</dt><dd>${p.entry_kind==='reversal'?'−':''}${money(p.amount,c.currency)}</dd></div><div><dt>Frais de transaction</dt><dd>${money(p.transaction_fee||0,c.currency)}</dd></div><div><dt>Total ${p.entry_kind==='reversal'?'annulé':'reçu'}</dt><dd>${money(p.total_charged??p.amount,c.currency)}</dd></div><div><dt>Date de réception</dt><dd>${ctx.date(p.paid_on)}</dd></div><div><dt>Méthode</dt><dd>${esc(p.method)}</dd></div><div><dt>Confirmé par</dt><dd>${esc(p.method.startsWith('Araka ')?'Araka — vérifié automatiquement':ctx.person(p.recorded_by))}</dd></div></dl><p>${esc(p.reason)}</p>${reversed(p)?'<p class="form-error">Ce versement a été annulé par une contre-écriture.</p>':''}<small class="muted">Enregistré le ${ctx.date(p.created_at,true)} · GM Fleet</small></section><div class="form-footer no-print"><button class="primary" data-print-receipt>Imprimer le reçu</button></div>`);
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
  if(b.hasAttribute('data-araka-health')||b.dataset.arakaCheck){b.disabled=true;try{const result=await arakaCall(b.dataset.arakaCheck?{action:'staff-check',id:b.dataset.arakaCheck}:{action:'health'});ctx.notify(result.connected?'Araka connecté · '+result.environment:'Statut Araka vérifié');await load();paint();}catch(error){ctx.notify(error.message,true);}finally{b.disabled=false;}}
  if(b.hasAttribute('data-finance-close'))$('financeDialog').close();
  if(b.dataset.finance==='export-contracts')exportContracts();
  if(b.dataset.finance==='activate')activation();if(b.dataset.finance==='payment')payment();if(b.dataset.finance==='deposit')deposit();
  if(b.dataset.deposit)showDeposit(b.dataset.deposit);if(b.dataset.receipt)receipt(b.dataset.receipt);if(b.hasAttribute('data-print-receipt'))window.print();
  if(b.dataset.contract)showContract(b.dataset.contract);if(b.dataset.pay)payment(b.dataset.pay);if(b.dataset.reverse)reverse(b.dataset.reverse);
  if(b.dataset.proof){const tab=window.open('about:blank','_blank');if(tab)tab.opener=null;try{const {data,error}=await ctx.db.storage.from('finance-proofs').createSignedUrl(b.dataset.proof,120);if(error)throw error;if(tab)tab.location=data.signedUrl;else throw Error('Autorisez les fenêtres pour ouvrir le justificatif.');}catch(e){tab?.close();ctx.notify(e.message,true);}}
 });
 return {render};
})();
