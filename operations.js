/* GM Fleet operations: all mutations are protected by Supabase staff policies. */
(() => {
 'use strict';
 const db = window.GMFleetBackend?.client;
 const workflow=window.GMFleetWorkflow;
 const $ = id => document.getElementById(id);
 const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const programs = {DRIVE_TO_OWN:'Car na ngai · LOLC',YANGO:'Partenaire Yango',FLEET_OWNER:'Gestion de flotte',PARTNER_DRIVER:'Chauffeur Partenaire'};
 const services = {DRIVE_TO_OWN:null,YANGO:'Chauffeur Yango',FLEET_OWNER:'Gestion de flotte',PARTNER_DRIVER:'Recrutement Chauffeur'};
 const stages = {new:'Nouvelle candidature',to_contact:'À contacter',contacted:'Contacté',appointment:'Rendez-vous fixé',screening:'En vérification',kyc:'Dossier / KYC LOLC',lolc_pending:'Décision LOLC attendue',approved:'Approuvé',vehicle_arrangements:'Arrivée du véhicule',paperwork_check:'Contrôle administratif',inspection:'Inspection mécanique',preparation:'Préparation GML',ready:'Prêt pour remise',handed_over:'Véhicule remis',available:'Chauffeur disponible',on_hold:'En attente',rejected:'Refusé',withdrawn:'Retiré'};
 const commonStages = ['new','to_contact','contacted','appointment','screening'];
 const stageSets = {
  DRIVE_TO_OWN:[...commonStages,'kyc','lolc_pending','approved','vehicle_arrangements','paperwork_check','inspection','preparation','ready','handed_over','on_hold','rejected','withdrawn'],
  YANGO:[...commonStages,'approved','preparation','ready','on_hold','rejected','withdrawn'],
  FLEET_OWNER:[...commonStages,'inspection','approved','preparation','ready','on_hold','rejected','withdrawn'],
  PARTNER_DRIVER:[...commonStages,'approved','available','on_hold','rejected','withdrawn']
 };
 const lolc = {not_submitted:'Non soumis',pending:'En attente de décision',information_required:'Complément demandé',approved:'Approuvé par LOLC',rejected:'Refusé par LOLC'};
 const sources = {website:'Site web',office:'Accueil au bureau',agent:'Agent',referral:'Recommandation'};
 const appointmentStates = {scheduled:'Programmé',confirmed:'Confirmé',completed:'Effectué',missed:'Absent',cancelled:'Annulé',rescheduled:'Reprogrammé'};
 const OFFICE_ADDRESS='Bureau GM Fleet, 01 Ngongo Lutete, Kinshasa, Gombe';
 const detailLabels = {email:'E-mail',idNumber:'Pièce d’identité',carBrand:'Marque',carModel:'Modèle',carPlate:'Plaque',carYear:'Année',carChassis:'Châssis',permisFileName:'Permis (nom déclaré)',carteRoseFileName:'Carte rose (nom déclaré)',photosCount:'Photos déclarées',cvFileName:'CV (nom déclaré)',licenseNumber:'Numéro de permis',yangoStatus:'Statut Yango'};
 const state = {apps:[],appointments:[],staff:[],user:null,view:'overview',current:null,detailToken:0,filters:{query:'',program:'',stage:'',queue:'pending'}};
 $('caseDialog').addEventListener('close',()=>{state.detailToken++;state.documentReview?.destroy();state.documentReview=null;if(state.documentUi)state.documentUi.selectedId=null;});
 const ADMIN_IDLE_MS=30*60*1000,ACTIVITY_KEY='gmfleet-admin-last-activity';let idleTimer,activityWrite=0;
 const date = (value, time=false) => value ? new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium',...(time?{timeStyle:'short'}:{}),timeZone:'Africa/Kinshasa'}).format(new Date(value.length===10?value+'T12:00:00+01:00':value)) : '—';
 const todayKey = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Kinshasa',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const staffMember = id => state.staffDirectory?.find(s=>s.user_id===id);
 const person = id => staffMember(id)?.display_name || (id?'Agent non identifié':'Équipe GM Fleet');
 const isOpen = app => !['rejected','withdrawn','handed_over'].includes(app.workflow_stage);
 const options = (map,selected) => Object.entries(map).map(([v,l])=>`<option value="${escape(v)}" ${v===selected?'selected':''}>${escape(l)}</option>`).join('');
 function notify(message,error=false) { $('notice').hidden=false; $('notice').textContent=message; $('notice').className=error?'error':''; }
 function tag(app) { const tone=['approved','ready','handed_over','available'].includes(app.workflow_stage)?'green':['rejected','withdrawn'].includes(app.workflow_stage)?'red':''; return `<span class="tag ${tone}">${escape(stages[app.workflow_stage]||app.workflow_stage)}</span>`; }
 function link(app) { return `<button class="link-button" data-case="${app.id}">${escape(app.name)}</button>`; }
 const reference=app=>app.case_reference||`DOSSIER-${app.id}`;
 function fail(error) { console.error(error); return error.message || 'Une erreur est survenue. Réessayez.'; }
 async function expireSession(){clearTimeout(idleTimer);try{await db?.auth.signOut();}finally{localStorage.removeItem(ACTIVITY_KEY);location.replace('/login.html?reason=inactivity');}}
 function armIdleTimer(){clearTimeout(idleTimer);const last=Number(localStorage.getItem(ACTIVITY_KEY)||Date.now()),remaining=ADMIN_IDLE_MS-(Date.now()-last);if(remaining<=0){expireSession();return;}idleTimer=setTimeout(expireSession,remaining+250);}
 function noteActivity(){if(document.hidden)return;const now=Date.now();if(now-activityWrite<15000)return;activityWrite=now;localStorage.setItem(ACTIVITY_KEY,String(now));armIdleTimer();}
 function enforceIdle(){const last=Number(localStorage.getItem(ACTIVITY_KEY)||0);if(last&&Date.now()-last>=ADMIN_IDLE_MS){expireSession();return false;}return true;}
 async function rows(table, modify=query=>query) {
  let all=[];
  for(let offset=0;;offset+=500) {
   const {data,error}=await modify(db.from(table).select('*')).range(offset,offset+499);
   if(error) throw error;
   all.push(...data); if(data.length<500) return all;
  }
 }
 let reloadPending=null;
 function reload(){if(reloadPending)return reloadPending;reloadPending=refreshData().finally(()=>{reloadPending=null;});return reloadPending;}
 async function refreshData() {
  $('refresh').disabled=true;
  $('syncStatus').textContent='Synchronisation en cours…';
  try {
  const [apps,appointments,staffDirectory,notifications,quotes] = await Promise.all([
   rows('applications',q=>q.order('created_at',{ascending:false}).order('id')),
   rows('appointments',q=>q.order('starts_at').order('id')),
   rows('staff_members',q=>q.order('display_name').order('user_id')),rows('operations_notifications',q=>q.order('created_at',{ascending:false}).order('id')),rows('equipment_quotes',q=>q.order('created_at',{ascending:false}).order('id'))]);
  const staff=staffDirectory.filter(s=>s.active&&!s.deleted_at);
  Object.assign(state,{apps,appointments,staff,staffDirectory,notifications,quotes});
  $('usersNav').hidden=!staff.some(s=>s.user_id===state.user.id&&s.role==='super_admin');
  $('modelSpecsNav').hidden=!staff.some(s=>s.user_id===state.user.id&&['admin','super_admin'].includes(s.role));
  $('navCount').textContent=apps.filter(a=>workflow.review(a)==='pending').length+quotes.filter(q=>q.status==='new').length;
  const complete=await render();
  $('today').textContent=new Intl.DateTimeFormat('fr-FR',{dateStyle:'full',timeZone:'Africa/Kinshasa'}).format(new Date());
  $('syncStatus').textContent=complete===false?'Actualisation partielle — finances à vérifier.':'Dernière actualisation : '+date(new Date().toISOString(),true)+' · Heure de Kinshasa';
  }catch(error){$('syncStatus').textContent='Synchronisation interrompue — les données affichées peuvent être anciennes.';throw error;}finally{$('refresh').disabled=false;}
 }
 function render() {
  if(state.view!=='overview')window.GMFleetDashboard.cancel();
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===state.view));
  $('newApplication').textContent=state.view==='appointments'?'＋ Programmer un rendez-vous':'＋ Nouvelle candidature';
  $('pageTitle').textContent={overview:'Tableau de bord',applications:'Candidatures',appointments:'Rendez-vous',contracts:'Contrats & véhicules',payments:'Caisse / versements',reconciliation:'Rapprochement LOLC',users:'Utilisateurs',preparation:'Préparation & remises',fleet:'Flotte & partenaires',modelSpecs:'Fiches véhicules'}[state.view];
  document.getElementById('newApplication').hidden=['users','contracts','payments','reconciliation','preparation','fleet','modelSpecs'].includes(state.view);
  if(['contracts','payments','reconciliation'].includes(state.view)) { const rendering=window.GMFleetFinance.render(state.view,{db,escape,date,person,notify,rows,staff:state.staff,user:state.user,apps:state.apps,openContract:state.dashboardContract});state.dashboardContract=null; return rendering; }
  if(state.view==='modelSpecs')return window.GMFleetModelAdmin.render({db,escape,notify,user:state.user,staff:state.staff,isCurrent:()=>state.view==='modelSpecs'});
  if(state.view==='users') {window.GMFleetUsers.render({db,escape,notify,staff:state.staff,user:state.user});return;}
  if(state.view==='overview') return renderOverview();
  else if(state.view==='applications') renderApplications();
  else if(state.view==='preparation'||state.view==='fleet')return renderFleetQueues();
  else renderAppointments();
 }
 async function renderOverview(){
  const result=await window.GMFleetDashboard.render({db,escape,date,apps:state.apps,appointments:state.appointments,programs,stages,person,isCurrent:()=>state.view==='overview'});
  if(state.view==='overview'){
   const pending=state.apps.filter(a=>workflow.review(a)==='pending');
   $('content').insertAdjacentHTML('afterbegin',`<section class="intake-notice"><div><span class="eyebrow">À EXAMINER</span><h3>${pending.length} candidature${pending.length!==1?'s':''} en attente de décision</h3><p>Demandes du site et de l’agence · alertes internes, SMS admin et notifications push selon configuration</p></div><button class="secondary" data-view="applications">Ouvrir les candidatures →</button></section>`);
  }
  return result;
 }
 async function renderFleetQueues(){
  const selected=state.view;$('content').innerHTML='<p class="muted">Chargement de la flotte…</p>';
  try{
   const [vehicles,contracts,drivers]=await Promise.all(['vehicles','contracts','drivers'].map(t=>rows(t,q=>q.order('id'))));
   if(state.view!==selected)return;
   if(selected==='preparation'){
    const apps=state.apps.filter(a=>workflow.review(a)==='accepted'&&!contracts.some(c=>c.application_id===a.id&&c.status==='active')&&!vehicles.some(v=>v.owner_application_id===a.id)&&!(a.program_type==='YANGO'&&a.process_step==='joined'));
$('content').innerHTML=`<p class="section-note">Dossiers retenus par GML : suivez les contrôles, les décisions LOLC, les installations et les remises. Les contrats actifs et véhicules intégrés se retrouvent dans la flotte.</p>${Object.entries(programs).map(([key,label])=>{const group=apps.filter(a=>a.program_type===key);return `<section class="card"><h3>${escape(label)} · ${group.length}</h3>${group.length?group.map(a=>`<div class="row"><div>${link(a)}<small>${escape(workflow.step(a))}</small><small>${escape(a.next_action||'Ouvrir le dossier pour poursuivre')}</small></div><button class="secondary" data-case="${a.id}" data-open-tab="appointments">Poursuivre →</button></div>`).join(''):'<p class="muted">Aucun dossier en préparation.</p>'}</section>`;}).join('')}`;
    return;
   }
   const partners=state.apps.filter(a=>a.program_type==='YANGO'&&a.process_step==='joined'&&workflow.review(a)==='accepted');
   $('content').innerHTML=`<div class="stats"><div class="stat"><span>Véhicules en flotte</span><strong>${vehicles.length}</strong></div><div class="stat"><span>Disponibles</span><strong>${vehicles.filter(v=>v.status==='Disponible').length}</strong></div><div class="stat"><span>Partenaires Yango confirmés</span><strong>${partners.length}</strong></div></div><section class="card"><div class="card-heading"><h3>Véhicules et affectations</h3><button class="secondary" data-view="contracts">Affecter avec un contrat →</button></div><div class="table-wrap"><table><thead><tr><th>Véhicule</th><th>Propriétaire / origine</th><th>Chauffeur</th><th>Statut</th></tr></thead><tbody>${vehicles.map(v=>{const c=contracts.find(c=>c.vehicle_id===v.id&&c.status==='active'),d=drivers.find(d=>d.id===c?.driver_id),owner=state.apps.find(a=>a.id===v.owner_application_id);return `<tr><td><strong>${escape(v.plate)}</strong><small>${escape(v.model)}</small></td><td>${owner?link(owner):'Flotte / contrat GML'}</td><td>${d?escape(d.full_name):'Non affecté'}${c?`<small><button class="link-button" data-dashboard-contract="${c.id}">Voir le contrat</button></small>`:''}</td><td><span class="tag">${escape(v.status)}</span></td></tr>`;}).join('')||'<tr><td colspan="4">Aucun véhicule enregistré.</td></tr>'}</tbody></table></div></section><section class="card"><h3>Chauffeurs partenaires Yango · ${partners.length}</h3>${partners.map(a=>`<div class="row"><div>${link(a)}<small>${escape(a.phone)}</small></div><span class="tag green">Rattachement confirmé</span></div>`).join('')||'<p class="muted">Aucun rattachement confirmé pour le moment.</p>'}</section><section class="intake-notice"><div><h3>Revenus Yango</h3><p>API Yango non connectée. Les recettes journalières, courses et performances seront disponibles après connexion et rapprochement des chauffeurs.</p></div><span class="tag">Données indisponibles</span></section>`;
  }catch(e){if(state.view===selected)$('content').innerHTML=`<p class="form-error">${escape(fail(e))}</p><button class="secondary" data-view="${selected}">Réessayer</button>`;}
 }
 function renderQuotes(){
  const target=$('quoteInbox');if(!target)return;
  const labels={gps:'Tracker GPS',dashcam:'Dashcam',both:'Tracker GPS + dashcam'},statuses={new:'Nouvelle demande',contacted:'Client contacté',quoted:'Devis envoyé',closed:'Clôturée'};
  target.innerHTML='<h3>Demandes de devis · '+state.quotes.length+'</h3><p class="muted">Préparez votre devis professionnel et envoyez-le à l’adresse indiquée. Aucun e-mail automatique n’est envoyé.</p>'+state.quotes.map(q=>{const p=q.payload;return `<details class="card"><summary><strong>${escape(p.name)}</strong> · ${escape(labels[p.equipment])} · ${escape(statuses[q.status])}</summary><div class="fields" style="margin-top:16px"><div><strong>Contact</strong><p>${escape(p.email)}</p><p>${escape(p.phone)}</p><p>${escape(p.city)}</p></div><div><strong>Véhicule</strong><p>${escape(p.vehicle_type)} · ${escape(p.model)}</p><p>Quantité : ${escape(p.quantity)}</p><p>${date(q.created_at,true)}</p></div><p class="wide">${escape(p.message||'Aucune précision supplémentaire.')}</p></div><label>Suivi<select data-quote-status="${escape(q.id)}">${options(statuses,q.status)}</select></label><a class="secondary" href="mailto:${encodeURIComponent(p.email)}?subject=${encodeURIComponent('Votre devis GM Fleet — '+labels[p.equipment])}">Préparer un e-mail →</a></details>`;}).join('');
  target.querySelectorAll('[data-quote-status]').forEach(select=>select.onchange=async()=>{select.disabled=true;const q=state.quotes.find(q=>q.id===select.dataset.quoteStatus);const {error}=await db.from('equipment_quotes').update({status:select.value}).eq('id',q.id);if(error){select.value=q.status;notify(fail(error),true);}else{q.status=select.value;notify('Suivi du devis enregistré.');}select.disabled=false;});
 }
 function renderApplications() {
  $('content').innerHTML=`<div class="program-tabs" aria-label="Catégories de candidature">${Object.entries({'':'Toutes les demandes',...programs}).map(([key,label])=>`<button class="${state.filters.program===key?'active':''}" data-program-key="${key}" aria-pressed="${state.filters.program===key}">${escape(label)} <span>${state.apps.filter(a=>(!key||a.program_type===key)&&workflow.review(a)==='pending').length}</span></button>`).join('')}</div><div class="queue-tabs">${Object.entries({pending:'À examiner',accepted:'Retenues · suivi',rejected:'Refusées',all:'Tout l’historique'}).map(([key,label])=>`<button data-queue="${key}" class="${(state.filters.queue||'pending')===key?'active':''}">${label}</button>`).join('')}</div><div class="filters"><input id="search" type="search" placeholder="Rechercher un nom, téléphone ou numéro de dossier…" aria-label="Rechercher" value="${escape(state.filters.query)}"><select id="programFilter" aria-label="Programme" hidden><option value="">Tous les programmes</option>${options(programs,state.filters.program)}</select><select id="stageFilter" aria-label="Étape"><option value="">Toutes les étapes</option>${options(stages,state.filters.stage)}</select></div><section class="card"><div id="applicationTable"></div></section>`;
  const quoteTab=document.createElement('button');quoteTab.textContent='Équipements · devis '+(state.quotes||[]).filter(q=>q.status==='new').length;quoteTab.type='button';quoteTab.setAttribute('aria-pressed','false');$('content').querySelector('.program-tabs').append(quoteTab);
  quoteTab.onclick=()=>{const content=$('content');content.querySelectorAll('.program-tabs button').forEach(b=>{b.classList.toggle('active',b===quoteTab);b.setAttribute('aria-pressed',String(b===quoteTab));});content.querySelector('.queue-tabs').hidden=true;content.querySelector('.filters').hidden=true;content.querySelector('#applicationTable').parentElement.hidden=true;let inbox=$('quoteInbox');if(!inbox){inbox=document.createElement('section');inbox.id='quoteInbox';inbox.className='card';content.append(inbox);}renderQuotes();};
  $('search').addEventListener('input',e=>{state.filters.query=e.target.value;renderTable();});
  $('programFilter').addEventListener('change',e=>{state.filters.program=e.target.value;renderTable();});
  $('stageFilter').addEventListener('change',e=>{state.filters.followups=false;state.filters.stage=e.target.value;renderTable();});
  renderTable();
 }
 function renderTable() {
  const q=state.filters.query.toLocaleLowerCase('fr').trim();
  const apps=state.apps.filter(a=>((state.filters.queue||'pending')==='all'||workflow.review(a)===(state.filters.queue||'pending'))&&(!state.filters.followups||(isOpen(a)&&a.follow_up_on&&a.follow_up_on<=todayKey()))&&(!state.filters.program||a.program_type===state.filters.program)&&(!state.filters.stage||a.workflow_stage===state.filters.stage)&&(!q||`${a.id} ${a.case_reference||''} ${a.name} ${a.phone}`.toLocaleLowerCase('fr').includes(q)));
  $('applicationTable').innerHTML=`<div class="card-heading"><h3>${apps.length} candidature${apps.length!==1?'s':''}</h3><span class="muted">${state.filters.followups?'Relances dues aujourd’hui ou avant · changez le filtre Étape pour tout voir':'Cliquez sur un nom pour ouvrir le dossier'}</span></div>${apps.length?`<div class="table-wrap"><table><thead><tr><th>Candidat</th><th>Programme</th><th>Étape</th><th>Suivi</th><th>Origine</th></tr></thead><tbody>${apps.map(a=>`<tr><td>${link(a)}<small>${escape(reference(a))} · ${escape(a.phone)}</small></td><td>${escape(programs[a.program_type])}<small>${date(a.created_on)}</small></td><td>${tag(a)}</td><td>${escape(a.assigned_to?person(a.assigned_to):'Attribué à la première ouverture')}<small>${a.follow_up_on?'Relance : '+date(a.follow_up_on):'Aucune relance planifiée'}</small></td><td>${escape(sources[a.source])}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Aucun dossier ne correspond à ces filtres.</div>'}`;
 }
 function appointmentRow(a) {
  const app=state.apps.find(x=>x.id===a.application_id);
  return `<div class="appointment"><time>${date(a.starts_at,true)}</time><div class="grow">${app?link(app):'Dossier #'+a.application_id}<small class="muted">${a.sequence_no?'Étape '+a.sequence_no+' · ':''}${escape(workflow.purposes[a.purpose]||'Rendez-vous')} · ${escape(a.location)} · ${escape(person(a.assigned_to))}</small><p class="muted">${escape(a.outcome_notes||a.instructions)}</p></div><span class="tag">${escape(appointmentStates[a.status])}</span>${app&&['scheduled','confirmed'].includes(a.status)?`<button class="secondary" data-case="${app.id}" data-open-tab="appointments">Traiter</button>`:''}</div>`;
 }
 function caseAppointmentsHTML(appointments,a){
  const outcomeLabels={lolc_approved:'Crédit approuvé',lolc_rejected:'Crédit refusé',information_required:'Complément demandé',vehicle_bought:'Véhicule acheté',delayed:'Reporté',installed:'Installation terminée',installation_incomplete:'Installation incomplète',handed_over:'Véhicule remis',completed:'Effectué',missed:'Absent',cancelled:'Annulé'};
  const expectedPurpose=workflow.nextPurpose(a);
  const cards=appointments.map(p=>`<div class="appointment-card" data-appointment-card="${escape(p.id)}"><div class="appointment-card-head"><div><span class="eyebrow">RENDEZ-VOUS ${p.sequence_no||''}</span><h4>${escape(workflow.purposes[p.purpose]||'Rendez-vous')}</h4><p>${date(p.starts_at,true)} · ${escape(p.location)}</p><small>${escape(person(p.assigned_to))}${p.instructions?' · '+escape(p.instructions):''}</small></div><span class="tag ${p.status==='completed'?'green':''}">${escape(appointmentStates[p.status])}</span></div>${p.outcome?`<p class="appointment-result"><strong>${escape(outcomeLabels[p.outcome]||p.outcome)}</strong>${p.outcome_notes?' · '+escape(p.outcome_notes):''}</p>`:''}</div>`).join('');
  const active=appointments.some(p=>['scheduled','confirmed'].includes(p.status));
  const scheduler=expectedPurpose&&!active?`<section class="appointment-scheduler"><h3>Fixer le rendez-vous</h3><form id="appointmentForm"><div class="fields"><label>Date<input name="meeting_date" type="date" required min="${todayKey()}"></label><label>Heure · Kinshasa<input name="meeting_time" type="time" required></label><label class="wide">Adresse du rendez-vous<input name="location" required maxlength="500" value="${escape(OFFICE_ADDRESS)}"></label></div><div class="form-error" role="alert"></div><div class="appointment-confirm-actions"><button type="submit" class="primary"><i data-lucide="calendar-check" aria-hidden="true"></i>Confirmer et envoyer le SMS</button><span class="muted">${escape(a.phone)}</span></div></form></section>`:'';
  return `${cards||'<p class="muted">Aucun rendez-vous enregistré.</p>'}${scheduler}`;
 }
 function renderAppointments() {
  const upcoming=state.appointments.filter(a=>!['completed','missed','cancelled','rescheduled'].includes(a.status));
  const past=state.appointments.filter(a=>!upcoming.includes(a)).reverse();
  const awaiting=state.apps.filter(a=>workflow.review(a)==='accepted'&&workflow.nextPurpose(a)&&!upcoming.some(p=>p.application_id===a.id));
  $('content').innerHTML=`<section class="card"><h3>À programmer · ${awaiting.length}</h3>${awaiting.map(a=>`<div class="row"><div>${link(a)}<small>${escape(workflow.step(a))}</small></div><button class="secondary" data-case="${a.id}" data-open-tab="appointments">Programmer →</button></div>`).join('')||'<p class="muted">Aucun rendez-vous à programmer.</p>'}</section><section><h3>À venir / à clôturer · ${upcoming.length}</h3>${upcoming.length?upcoming.map(appointmentRow).join(''):'<div class="card empty">Planifiez un rendez-vous depuis le dossier du candidat.</div>'}</section><section class="card"><h3>Historique</h3>${past.length?past.slice(0,50).map(appointmentRow).join(''):'<p class="muted">Aucun rendez-vous clôturé.</p>'}</section>`;
 }
 function detailsHTML(a) {
  const fields=[['Téléphone',a.phone],['WhatsApp',a.whatsapp],['E-mail',a.email],['Date de naissance',a.birth_date?date(a.birth_date):null],['Adresse',a.address],['Expérience',a.experience],['Véhicule',a.vehicle],['Durée souhaitée',a.plan_duration_months?`${a.plan_duration_months} mois`:null],['Co-emprunteur',a.co_borrower_name],['Téléphone co-emprunteur',a.co_borrower_phone],['Adresse co-emprunteur',a.co_borrower_address],['Permis déclaré',a.license_file_name],...Object.entries(a.service_details||{}).map(([k,v])=>[detailLabels[k]||k,v])];
  return `<dl class="details">${fields.filter(([,v])=>v!==null&&v!==undefined&&v!=='').map(([k,v])=>`<div><dt>${escape(k)}</dt><dd>${escape(typeof v==='object'?JSON.stringify(v):v)}</dd></div>`).join('')}</dl>`;
 }
 async function openCase(id) {
  const token=++state.detailToken;
  state.documentReview?.destroy();state.documentReview=null;
  if(state.current?.id!==Number(id))state.caseTab='summary';
  let a=state.apps.find(item=>item.id===Number(id)); if(!a) return;
  if(!a.assigned_to){
   const claimed=await check(await db.from('applications').update({assigned_to:state.user.id,claimed_at:new Date().toISOString()}).eq('id',a.id).eq('revision',a.revision).select('*'));
   if(claimed.length)Object.assign(a,claimed[0]);else{await reload();a=state.apps.find(item=>item.id===Number(id));if(!a)return;}
  }
  state.current=a;
  $('caseRef').textContent=`${reference(a)} / ${programs[a.program_type]}`;
  $('caseName').textContent=a.name;
  $('caseBody').innerHTML='<p class="muted">Chargement du dossier…</p>';
  if(!$('caseDialog').open) $('caseDialog').showModal();
  try {
   const [notes,documents,audit]=await Promise.all(['admin_notes','documents','audit_logs'].map(t=>rows(t,q=>q.eq('application_id',a.id).order('created_at',{ascending:false}).order('id'))));
   if(token!==state.detailToken) return;
   const appointments=state.appointments.filter(x=>x.application_id===a.id);
   const staffOptions=Object.fromEntries(state.staff.map(s=>[s.user_id,s.display_name]));
   const drive=a.program_type==='DRIVE_TO_OWN';
   $('caseBody').innerHTML=`<div class="badge-line">${tag(a)}<span class="tag">${escape(sources[a.source])}</span><span class="tag">${escape(reference(a))}</span><span class="tag">Agent : ${escape(person(a.assigned_to))}</span><span class="tag">Reçu le ${date(a.created_on)}</span></div><div class="case-grid"><div>
   <section class="card"><h3>Informations du candidat</h3>${detailsHTML(a)}${a.note?`<p class="note">${escape(a.note)}</p>`:''}</section>
<section class="card">${a.lifecycle_version===1?`<h3>Parcours du dossier</h3><form id="workflowForm"><div class="fields"><label>Étape<select name="workflow_stage">${options(Object.fromEntries(stageSets[a.program_type].map(s=>[s,stages[s]])),a.workflow_stage)}</select></label><label>Agent responsable<select name="assigned_to"><option value="">Non attribué</option>${options(staffOptions,a.assigned_to)}</select></label>${drive?`<label>Décision LOLC<select name="lolc_status">${options(lolc,a.lolc_status)}</select></label><label>Référence de suivi LOLC<input value="${escape(a.lolc_reference||'Automatique après approbation')}" readonly></label>`:''}<label class="wide">Prochaine action<input name="next_action" value="${escape(a.next_action)}" maxlength="1000" placeholder="Appeler le candidat, compléter les pièces…"></label><label>Relance prévue<input name="follow_up_on" type="date" value="${escape(a.follow_up_on)}"></label></div>${drive?'<p class="section-note">LOLC décide du financement. L’approbation ne déclenche aucun échéancier de paiement.</p>':''}<h3 style="margin-top:22px">Préparation et contrôles</h3><div class="checklist">${Object.entries({administrative:'Contrôle administratif effectué',inspection_requested:'Inspection mécanique demandée par le client',inspection_completed:'Rapport de l’atelier reçu',paperwork:'Documents de remise finalisés',tracker:'Tracker installé',yango:'Intégration Yango terminée'}).map(([key,label])=>`<label class="check"><input type="checkbox" name="${key}" ${a.preparation?.[key]?'checked':''}>${label}</label>`).join('')}</div><label style="margin-top:16px">Atelier choisi / observations d’inspection<textarea name="inspection_notes" maxlength="3000">${escape(a.preparation?.inspection_notes)}</textarea></label><div class="form-error" role="alert"></div><button class="primary">Enregistrer le suivi</button></form>`:workflow.form(a,{escape,options,staffOptions,lolc})}</section>
   <section id="caseNotes"></section></div><div>
   <section class="card"><h3>Rendez-vous et décisions</h3>${caseAppointmentsHTML(appointments,a)}</section>
   <section id="caseDocuments" class="document-section"></section>
   <section id="caseJournal"></section></div></div>`;
   bindCase(a);
   workflow.mount(a,{escape,options,submit,check,db,refreshCase,reload,notify,state,notifications:state.notifications,appointments});
   window.GMFleetCaseJournal.mount({root:$('case-panel-history'),notes,audit,application:a,escape,date,person,staffMember,workflow,stages,lolc,appointmentStates,detailLabels,submit,check,db,refreshCase,notify,state});
   state.documentReview=window.GMFleetDocuments.mount({root:$('caseDocuments'),documents,application:a,db,escape,date,person,notify,refreshCase,state});
  } catch(error) {$('caseBody').innerHTML=`<p class="form-error">${escape(fail(error))}</p><button class="secondary" data-case="${a.id}">Réessayer</button>`;}
 }
 function submit(form,action) {
  form.addEventListener('submit',async event=>{
   event.preventDefault();const btn=form.querySelector('button[type="submit"],button:not([type])'); const error=form.querySelector('.form-error');
   btn.disabled=true;error.textContent='';
   try {await action(new FormData(form));} catch(e) {error.textContent=fail(e);} finally {btn.disabled=false;}
  });
 }
 async function check(result) {if(result.error) throw result.error;return result.data;}
 async function refreshCase(id) {await reload();await openCase(id);}
 function bindCase(a) {
  if($('workflowForm'))submit($('workflowForm'),async f=>{
   const preparation={...a.preparation};
   if(f.has('inspection_notes'))preparation.inspection_notes=f.get('inspection_notes').trim();
   const keys=a.lifecycle_version===1?['administrative','inspection_requested','inspection_completed','paperwork','tracker','yango']:Object.keys(workflow.flows[a.program_type].checks);
   if(a.lifecycle_version===1||workflow.review(a)==='accepted')keys.forEach(k=>{if($('workflowForm').elements.namedItem(k))preparation[k]=f.has(k);});
   if(f.has('handover_on'))preparation.handover_on=f.get('handover_on')||null;
   const payload={assigned_to:a.assigned_to||state.user.id,next_action:f.get('next_action').trim()||null,follow_up_on:f.get('follow_up_on')||null,preparation};
   if(f.has('workflow_stage'))payload.workflow_stage=f.get('workflow_stage');
   if(f.has('process_step'))payload.process_step=f.get('process_step');
   if(f.has('lolc_status'))payload.lolc_status=f.get('lolc_status');
   const data=await check(await db.from('applications').update(payload).eq('id',a.id).eq('revision',a.revision).select('id'));
   if(!data.length) throw new Error('Ce dossier a changé depuis son ouverture. Fermez-le puis ouvrez-le à nouveau avant de modifier le suivi.');
   await refreshCase(a.id);notify('Suivi du dossier enregistré.');
  });
  if($('appointmentForm'))submit($('appointmentForm'),async f=>{
   const local=f.get('meeting_date')+'T'+f.get('meeting_time')+':00+01:00',starts_at=new Date(local).toISOString(),location=f.get('location').trim();
   if(workflow.nextPurpose(a)!=='vehicle_purchase'&&new Date(starts_at)<=new Date())throw new Error('Choisissez une date et une heure futures.');
   const fingerprint=JSON.stringify({application_id:a.id,starts_at,location});
   if(state.appointmentRequest?.fingerprint!==fingerprint)state.appointmentRequest={fingerprint,id:crypto.randomUUID()};
   const result=await db.functions.invoke('schedule-appointment',{body:{application_id:a.id,revision:a.revision,starts_at,location,request_id:state.appointmentRequest.id}});
   if(result.error){let message='Confirmation interrompue. Réessayez sans modifier les informations.';try{message=(await result.error.context.json()).error||message;}catch{}throw new Error(message);}
   if(!result.data?.success)throw new Error(result.data?.error||'Confirmation interrompue. Réessayez.');
   state.appointmentRequest=null;
   if(result.data.sms_status==='sent'&&!result.data.sms_error){$('caseDialog').close();await reload();notify('Rendez-vous fixé. SMS envoyé au candidat.');}
   else{await refreshCase(a.id);notify(result.data.sms_error||'Rendez-vous fixé. Vérifiez l’état du SMS avant de fermer.',true);}
  });
  $('caseBody').querySelectorAll('[data-appointment]').forEach(select=>select.addEventListener('change',async()=>{
   select.disabled=true;
   try {
    const changed=await check(await db.from('appointments').update({status:select.value}).eq('id',select.dataset.appointment).eq('status',select.dataset.original).select('id'));
    if(!changed.length) throw new Error('Ce rendez-vous a changé. Rouvrez le dossier.');
    await refreshCase(a.id);
   } catch(e) {select.value=select.dataset.original;notify(fail(e),true);} finally {select.disabled=false;}
  }));
 }
 function chooseAppointment(){
  let dialog=$('appointmentPicker');if(!dialog){dialog=document.createElement('dialog');dialog.id='appointmentPicker';document.body.append(dialog);}
  const awaiting=state.apps.filter(a=>workflow.review(a)==='accepted'&&workflow.nextPurpose(a)&&!state.appointments.some(p=>p.application_id===a.id&&['scheduled','confirmed'].includes(p.status)));
  dialog.innerHTML='<div class="dialog-title"><h2>Programmer un rendez-vous</h2><button class="icon" data-close="appointmentPicker" aria-label="Fermer">×</button></div>'+(awaiting.length?'<form id="chooseAppointmentForm"><label>Candidat<select name="application_id">'+awaiting.map(a=>'<option value="'+a.id+'">'+escape(a.name)+' · '+escape(a.phone)+'</option>').join('')+'</select></label><button class="primary">Continuer</button></form>':'<p>Aucun rendez-vous à programmer.</p>');
  dialog.showModal();
  if($('chooseAppointmentForm'))$('chooseAppointmentForm').onsubmit=async event=>{event.preventDefault();const id=event.currentTarget.elements.application_id.value;dialog.close();state.current=null;await openCase(id);$('case-tab-appointments')?.click();const form=$('appointmentForm');if(form){form.scrollIntoView({block:'center'});form.elements.meeting_date.focus();}};
 }
 document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b) return;
  if(b.hasAttribute('data-dashboard-refresh')){try{await reload();}catch(error){notify(fail(error),true);}return;}
  if(b.dataset.dashboardContract){state.dashboardContract=b.dataset.dashboardContract;state.view='contracts';render();return;}
  if(b.hasAttribute('data-program-key')){state.filters.program=b.dataset.programKey;renderApplications();return;}
  if(b.dataset.queue){state.filters.queue=b.dataset.queue;renderApplications();return;}
  if(b.dataset.view) {
   state.filters.followups=b.hasAttribute('data-followups');
   if(b.dataset.view==='applications')state.filters={query:'',program:'',stage:b.dataset.stageFilter||'',followups:state.filters.followups,queue:b.hasAttribute('data-followups')?'all':'pending'};
   state.view=b.dataset.view;
   if(state.view==='overview'){try{if(reloadPending)await reloadPending;await reload();}catch(error){notify(fail(error),true);}}else render();
  }
  if(b.dataset.case){await openCase(b.dataset.case);if(b.dataset.openTab)$('case-tab-'+b.dataset.openTab)?.click();}
  if(b.dataset.close) $(b.dataset.close).close();
  if(b.dataset.document) {
   const preview=window.open('about:blank','_blank'); if(preview) preview.opener=null;
   b.disabled=true;
   try {const data=await check(await db.storage.from('application-documents').createSignedUrl(b.dataset.document,120));if(preview) preview.location.href=data.signedUrl;else throw new Error('Autorisez les fenêtres pour ouvrir le document.');}
   catch(error) {preview?.close();notify(fail(error),true);} finally {b.disabled=false;}
  }
 });
 $('newApplication').addEventListener('click',()=>{if(state.view==='appointments'){chooseAppointment();return;}$('intakeForm').reset();$('intakeForm').querySelector('.form-error').textContent='';$('intake').showModal();});
 submit($('intakeForm'),async f=>{
  const program=f.get('program'),service=services[program];
  const payload={name:f.get('name').trim(),phone:f.get('phone').trim(),source:f.get('source'),vehicle:f.get('vehicle').trim()||service||'À préciser',service,application_type:service?'service':'vehicle',assigned_to:state.user.id,service_details:{licenseNumber:f.get('licenseNumber').trim(),carPlate:f.get('carPlate').trim(),carModel:f.get('vehicle').trim(),yangoStatus:f.get('yangoStatus').trim()}};
  ['whatsapp','email','birth_date','address','experience','co_borrower_name','co_borrower_phone','co_borrower_address'].forEach(k=>payload[k]=f.get(k).trim()||null);
  payload.plan_duration_months=program==='DRIVE_TO_OWN'&&f.get('duration')?Number(f.get('duration')):null;
  const data=await check(await db.from('applications').insert(payload).select('id').single());
  $('intake').close();await reload();await openCase(data.id);notify('Candidature créée. Vous pouvez ajouter les pièces et planifier le rendez-vous.');
 });
 $('refresh').addEventListener('click',async()=>{try{await reload();if(!$('syncStatus').textContent.includes('partielle'))notify('Données actualisées.');}catch(e){notify(fail(e),true);}});
 $('logout').addEventListener('click',async()=>{await db.auth.signOut();location.href='/login.html';});
 async function init() {
  try {
   if(!db) throw new Error('Le service de connexion est indisponible. Réessayez plus tard.');
   if(!enforceIdle())return;
   const {data,error}=await db.auth.getUser();if(error||!data.user){location.replace('/login.html');return;}
   state.user=data.user;
   const staff=await check(await db.from('staff_members').select('*').eq('user_id',data.user.id).eq('active',true).maybeSingle());
   if(!staff) {$('access').innerHTML='<h1>Accès réservé au personnel</h1><p>Ce compte ne dispose pas d’un accès aux opérations GM Fleet.</p><button id="accessLogout" class="secondary">Changer de compte</button>';$('accessLogout').onclick=async()=>{await db.auth.signOut();location.replace('/login.html');};return;}
   $('staffName').textContent=staff.display_name;
   window.GMFleetAdminNotifications?.mount({db,user:state.user,staff,notify});
   localStorage.setItem(ACTIVITY_KEY,String(Date.now()));activityWrite=Date.now();armIdleTimer();
   ['pointerdown','keydown','touchstart'].forEach(event=>window.addEventListener(event,noteActivity,{passive:true}));
   $('today').textContent=new Intl.DateTimeFormat('fr-FR',{dateStyle:'full',timeZone:'Africa/Kinshasa'}).format(new Date());
   await reload();$('access').hidden=true;$('workspace').hidden=false;
   db.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')location.replace('/login.html');});
   const refreshVisible=async()=>{if(!enforceIdle()||document.hidden||state.view!=='overview'||document.querySelector('dialog[open]'))return;try{await reload();}catch(e){notify('Actualisation interrompue. '+fail(e),true);}};
   setInterval(refreshVisible,60000);window.addEventListener('focus',refreshVisible);window.addEventListener('online',refreshVisible);document.addEventListener('visibilitychange',refreshVisible);
  } catch(e) {$('access').innerHTML=`<h1>Connexion indisponible</h1><p>${escape(fail(e))}</p><button class="secondary" id="retry">Réessayer</button>`;$('retry').onclick=()=>location.reload();}
 }
 init();
})();
