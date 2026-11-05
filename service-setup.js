/* A single review joins identity, known costs and the actual service assignment. */
window.GMFleetServiceSetup=(()=>{
 const money=n=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'USD'}).format(Number(n||0));
 function wizard(form,groups){
  const pages=groups.map(([title,nodes])=>{const page=document.createElement('section');page.className='setup-page';page.innerHTML='<h3>'+title+'</h3>';nodes.filter(Boolean).forEach(n=>page.append(n));return page;});
  const nav=document.createElement('ol');nav.className='setup-progress';nav.innerHTML=groups.map(([title],i)=>'<li><span>'+(i+1)+'</span>'+title+'</li>').join('');
  const controls=document.createElement('div');controls.className='form-footer setup-navigation';controls.innerHTML='<button type="button" class="secondary" data-setup-back>Retour</button><button type="button" class="primary" data-setup-next>Continuer →</button>';
  const save=form.querySelector('[type=submit]');const footer=save.closest('.form-footer')||save;
  form.prepend(nav);footer.before(...pages,controls);let step=0;
  const show=async n=>{step=n;pages.forEach((p,i)=>p.hidden=i!==n);[...nav.children].forEach((li,i)=>{li.classList.toggle('current',i===n);li.classList.toggle('done',i<n);li.setAttribute('aria-current',i===n?'step':'false');});controls.querySelector('[data-setup-back]').hidden=n===0;controls.querySelector('[data-setup-next]').hidden=n===pages.length-1;save.hidden=n!==pages.length-1;if(n===pages.length-1&&form.refreshOwnerReview)await form.refreshOwnerReview();pages[n].querySelector('input:not([readonly]),select,button')?.focus();};
  controls.querySelector('[data-setup-next]').onclick=()=>{for(const f of pages[step].querySelectorAll('input,select,textarea'))if(!f.disabled&&!f.reportValidity())return;show(step+1);};controls.querySelector('[data-setup-back]').onclick=()=>show(step-1);
  form.addEventListener('invalid',event=>{const i=pages.findIndex(p=>p.contains(event.target));if(i>=0&&i!==step)show(i);},true);
  form.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.tagName!=='TEXTAREA'&&step<pages.length-1){event.preventDefault();controls.querySelector('[data-setup-next]').click();}});
  show(0);return {show,pages};
 }
 function costRows(costs,e){return costs.length?'<div class="setup-costs">'+costs.map(x=>'<div><span><strong>'+e(x.description)+'</strong><small>'+e({fuel:'Carburant',repair:'Réparation',document:'Document'}[x.kind]||x.kind)+' · '+x.months+' mois à partir du '+e(x.recovery_start)+'</small></span><span><strong>'+money(x.total)+'</strong><small>'+money(x.principal)+' + '+money(x.fee)+' (15 % uniques)</small></span></div>').join('')+'</div>':'<p class="compact-empty">Aucune avance propriétaire.</p>';}
 function activation(form,store,c){
  const host=document.createElement('section');host.className='setup-review';host.dataset.ownerReview='';
  const labels=names=>names.map(n=>form.elements.namedItem(n)?.closest('label')).filter(Boolean),fields=form.querySelector('.fields');
  const vehicleDetails=document.createElement('details');vehicleDetails.className='setup-vehicle-details';vehicleDetails.open=true;vehicleDetails.innerHTML='<summary>Détails du véhicule · repris automatiquement</summary>';labels(['model','plate','vin','tracker_id']).forEach(l=>vehicleDetails.append(l));
  const identity=[...labels(['application_id','fleet_vehicle']),vehicleDetails];
  const dates=labels(['start_date','end_date','first_payment_date','currency','daily_lolc','daily_gml','excluded_dates']);dates.push(form.querySelector('.day-picker'),form.querySelector('[data-contract-condition]'));
  const confirm=form.querySelector('#contractPreview')?.nextElementSibling;
  wizard(form,[['Chauffeur & véhicule',identity],['Dates & état du véhicule',dates],['Bilan avant départ',[host,form.querySelector('#contractPreview'),confirm]]]);fields?.remove();
  const terms=document.createElement('p');terms.className='setup-auto-terms';form.querySelectorAll('.setup-page')[1].querySelector('h3').after(terms);
  const simplify=()=>{const v=store.vehicles.find(v=>String(v.id)===form.elements.fleet_vehicle.value),managed=!!v?.owner_application_id;vehicleDetails.open=!v;for(const n of ['currency','daily_lolc','daily_gml'])form.elements[n].closest('label').hidden=managed;form.querySelector('.day-picker').hidden=managed;terms.hidden=!managed;terms.textContent=managed?'31 USD par jour · lundi à vendredi · premier versement le '+form.elements.first_payment_date.value:'';};simplify();form.addEventListener('change',simplify);
  let sequence=0;
  form.refreshOwnerReview=async()=>{
   const seq=++sequence,v=store.vehicles.find(v=>String(v.id)===form.elements.fleet_vehicle.value);form.ownerSetupReview=null;
   const save=form.querySelector('[type=submit]');
   if(!v?.owner_application_id){host.innerHTML='';save.disabled=false;return;}
   save.disabled=true;
   host.innerHTML='<p class="muted">Vérification du dossier propriétaire…</p>';
   try{
    const {data:r,error}=await c.db.rpc('get_owner_service_setup',{p:{vehicle_id:v.id,driver_application_id:Number(form.elements.application_id.value),start_date:form.elements.start_date.value}});if(error)throw error;if(seq!==sequence)return;
    const e=c.escape;
    host.innerHTML='<div class="setup-heading"><span class="eyebrow">PROPRIÉTAIRE</span><h3>'+e(r.owner_name)+'</h3><p>'+e(r.vehicle)+'</p></div><h4>Avances GML à rembourser</h4>'+costRows(r.costs,e)+'<div class="setup-totals"><div><span>Dette totale restante</span><strong>'+money(r.recap.remaining)+'</strong></div><div><span>Prochaine retenue</span><strong>'+money(r.recap.next_deduction)+'</strong></div><div><span>Net prévisionnel propriétaire</span><strong>'+money(r.recap.projected_net)+'</strong></div></div>'+(r.blockers.length?'<div class="setup-blockers" role="alert"><strong>À compléter avant activation</strong><ul>'+r.blockers.map(x=>'<li>'+e(x)+'</li>').join('')+'</ul><p>Ouvrez la fiche concernée pour compléter les informations ou terminer la réparation.</p></div>':'<label class="check setup-confirm"><input name="owner_setup_reviewed" type="checkbox" required>J’ai vérifié tous les frais connus, les retenues et les informations des deux contrats. Le véhicule est prêt.</label>')+'<p class="muted">Un seul SMS financier récapitulera le départ, les avances et la prochaine retenue. Les copies juridiques sont envoyées par lien séparé.</p>';
    form.ownerSetupReview=r;
    const tick=host.querySelector('[name=owner_setup_reviewed]');if(tick)tick.onchange=()=>save.disabled=!tick.checked;
   }catch(error){host.innerHTML='<p class="form-error">'+c.escape(error.message||'Bilan indisponible. Réessayez.')+'</p>';}
  };
  form.addEventListener('change',event=>{if(['application_id','fleet_vehicle','start_date'].includes(event.target.name)){sequence++;form.ownerSetupReview=null;if(!host.closest('.setup-page').hidden)form.refreshOwnerReview();}});
 }
 function payload(form,store){const v=store.vehicles.find(v=>String(v.id)===form.elements.fleet_vehicle.value);if(!v?.owner_application_id)return {};const r=form.ownerSetupReview;if(!r||r.blockers.length)throw Error('Complétez le bilan propriétaire avant activation.');if(!form.elements.owner_setup_reviewed?.checked)throw Error('Confirmez le bilan propriétaire.');return {owner_setup_reviewed:true,owner_setup_fingerprint:r.fingerprint};}
 async function mountCase(host,a,c){
  if(!['FLEET_OWNER','PARTNER_DRIVER'].includes(a.program_type))return;
  const box=document.createElement('section');box.className='card service-status';host.prepend(box);
  try{
   const [vehicles,contracts,mandates]=await Promise.all([c.rows('vehicles'),c.rows('contracts'),c.rows('fleet_mandates')]);
   const v=a.program_type==='FLEET_OWNER'?vehicles.find(v=>v.owner_application_id===a.id):vehicles.find(v=>contracts.some(ct=>ct.vehicle_id===v.id&&ct.application_id===a.id&&ct.status==='active'));
   const ct=contracts.find(ct=>ct.status==='active'&&(a.program_type==='FLEET_OWNER'?ct.vehicle_id===v?.id:ct.application_id===a.id)),m=mandates.find(m=>m.vehicle_id===v?.id&&m.status!=='ended'),e=c.escape;
   box.innerHTML='<span class="service-pill '+(ct?'live':'')+'">'+(ct?'● En service':m?'Mandat signé · chauffeur à affecter':v?'Véhicule prêt · mandat à signer':'Préparation du véhicule')+'</span><h3>'+e(ct?'Contrat actif':a.program_type==='FLEET_OWNER'?'Prochaine étape':'Affectation du chauffeur')+'</h3>'+(v?'<p>'+e(v.model)+' · <strong>'+e(v.plate)+'</strong></p>':'')+(ct?'<div class="setup-totals"><div><span>Début du service</span><strong>'+c.date(ct.start_date)+'</strong></div><div><span>Premier versement</span><strong>'+c.date(ct.first_payment_date)+'</strong></div><div><span>Versement chauffeur</span><strong>'+money(Number(ct.daily_gml)+Number(ct.daily_lolc))+'/jour</strong></div></div><p>'+e(c.apps.find(x=>x.id===ct.application_id)?.name||v.driver||a.name)+' · '+e(ct.signed_reference)+'</p>':'<p>'+e(m?'Vérifiez les frais et choisissez un chauffeur inscrit avant le départ.':v?'Complétez les frais et signez le mandat propriétaire.':'Terminez les contrôles, les équipements et les photos.')+'</p>')+'<div class="setup-actions">'+(v&&!ct?'<button type="button" class="primary" data-service-next>'+(m?'Affecter un chauffeur':'Signer le mandat propriétaire')+'</button>':'')+'<button type="button" class="secondary" data-service-contract>Contrat & copie PDF</button>'+(a.program_type==='FLEET_OWNER'?'<button type="button" class="secondary" data-service-costs>Frais & réparations</button>':'')+'</div>';
   box.querySelector('[data-service-next]')?.addEventListener('click',()=>{document.getElementById('caseDialog')?.close();if(!m)c.state.fleetTab='mandates';document.querySelector('nav [data-view="'+(m?'contracts':'fleet')+'"]').click();});box.querySelector('[data-service-contract]').onclick=()=>c.selectTab('contract');box.querySelector('[data-service-costs]')?.addEventListener('click',()=>c.selectTab('management'));
  }catch(error){box.innerHTML='<p class="form-error">'+c.escape(error.message)+'</p>';}
 }
 return {wizard,activation,payload,mountCase};
})();
