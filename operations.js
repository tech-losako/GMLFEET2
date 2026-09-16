/* GM Fleet operations: all mutations are protected by Supabase staff policies. */
(() => {
 'use strict';
 const db = window.GMFleetBackend?.client;
 const $ = id => document.getElementById(id);
 const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const programs = {DRIVE_TO_OWN:'Drive to Own · LOLC',YANGO:'Agrégateur Yango',FLEET_OWNER:'Gestion de flotte',PARTNER_DRIVER:'Chauffeur Partenaire'};
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
 const detailLabels = {email:'E-mail',idNumber:'Pièce d’identité',carBrand:'Marque',carModel:'Modèle',carPlate:'Plaque',carYear:'Année',carChassis:'Châssis',permisFileName:'Permis (nom déclaré)',carteRoseFileName:'Carte rose (nom déclaré)',photosCount:'Photos déclarées',cvFileName:'CV (nom déclaré)',licenseNumber:'Numéro de permis',yangoStatus:'Statut Yango'};
 const state = {apps:[],appointments:[],staff:[],user:null,view:'overview',current:null,detailToken:0,filters:{query:'',program:'',stage:''}};
 const date = (value, time=false) => value ? new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium',...(time?{timeStyle:'short'}:{}),timeZone:'Africa/Kinshasa'}).format(new Date(value.length===10?value+'T12:00:00+01:00':value)) : '—';
 const todayKey = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Kinshasa',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const person = id => state.staff.find(s=>s.user_id===id)?.display_name || 'Équipe GM Fleet';
 const isOpen = app => !['rejected','withdrawn','handed_over'].includes(app.workflow_stage);
 const options = (map,selected) => Object.entries(map).map(([v,l])=>`<option value="${escape(v)}" ${v===selected?'selected':''}>${escape(l)}</option>`).join('');
 function notify(message,error=false) { $('notice').hidden=false; $('notice').textContent=message; $('notice').className=error?'error':''; }
 function tag(app) { const tone=['approved','ready','handed_over','available'].includes(app.workflow_stage)?'green':['rejected','withdrawn'].includes(app.workflow_stage)?'red':''; return `<span class="tag ${tone}">${escape(stages[app.workflow_stage]||app.workflow_stage)}</span>`; }
 function link(app) { return `<button class="link-button" data-case="${app.id}">${escape(app.name)}</button>`; }
 function fail(error) { console.error(error); return error.message || 'Une erreur est survenue. Réessayez.'; }
 async function rows(table, modify=query=>query) {
  let all=[];
  for(let offset=0;;offset+=500) {
   const {data,error}=await modify(db.from(table).select('*')).range(offset,offset+499);
   if(error) throw error;
   all.push(...data); if(data.length<500) return all;
  }
 }
 async function reload() {
  const [apps,appointments,staff] = await Promise.all([
   rows('applications',q=>q.order('created_at',{ascending:false}).order('id')),
   rows('appointments',q=>q.order('starts_at').order('id')),
   rows('staff_members',q=>q.eq('active',true).order('display_name').order('user_id'))]);
  Object.assign(state,{apps,appointments,staff});
  $('navCount').textContent=apps.filter(a=>a.workflow_stage==='new').length;
  $('syncStatus').textContent='Dernière actualisation : '+date(new Date().toISOString(),true)+' · Heure de Kinshasa';
  render();
 }
 function render() {
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===state.view));
  $('pageTitle').textContent={overview:'Tableau de bord',applications:'Candidatures',appointments:'Rendez-vous',contracts:'Contrats & véhicules',payments:'Caisse / versements',reconciliation:'Rapprochement LOLC'}[state.view];
  document.getElementById('newApplication').hidden=['contracts','payments','reconciliation'].includes(state.view);
  if(['contracts','payments','reconciliation'].includes(state.view)) { window.GMFleetFinance.render(state.view,{db,escape,date,person,notify,rows,staff:state.staff,user:state.user,apps:state.apps}); return; }
  if(state.view==='overview') renderOverview();
  else if(state.view==='applications') renderApplications();
  else renderAppointments();
 }
 function renderOverview() {
  const today=todayKey(), pending=state.apps.filter(isOpen), overdue=pending.filter(a=>a.follow_up_on&&a.follow_up_on<today);
  const appointments=state.appointments.filter(a=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Kinshasa',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(a.starts_at))===today&&!['cancelled','rescheduled'].includes(a.status));
  const waiting=pending.filter(a=>a.lolc_status==='pending');
  const work=[...overdue,...pending.filter(a=>a.workflow_stage==='new'&&!overdue.includes(a))].slice(0,8);
  $('content').innerHTML=`<div class="stats">${[
   ['Nouvelles candidatures',pending.filter(a=>a.workflow_stage==='new').length,'À prendre en charge'],['Rendez-vous aujourd’hui',appointments.length,'Accueil et suivi'],['Relances en retard',overdue.length,'Une action est attendue'],['En attente de LOLC',waiting.length,'Décision de financement']
  ].map(([l,n,s])=>`<div class="stat"><span>${l}</span><strong>${n}</strong><small>${s}</small></div>`).join('')}</div>
  <div class="grid-two"><section class="card"><div class="card-heading"><h3>À traiter en priorité</h3><span class="tag">${pending.length} dossiers ouverts</span></div>${work.length?work.map(a=>`<div class="row"><div>${link(a)}<small>${escape(programs[a.program_type])} · ${escape(a.next_action||'Prendre contact avec le candidat')}</small></div><div>${a.follow_up_on&&a.follow_up_on<today?'<span class="tag orange">Relance '+date(a.follow_up_on)+'</span>':tag(a)}</div></div>`).join(''):'<div class="empty">Aucune nouvelle candidature ou relance en retard.</div>'}</section>
  <section class="card"><h3>Les quatre programmes</h3>${Object.entries(programs).map(([p,l])=>`<div class="program-row"><span>${escape(l)}</span><strong>${pending.filter(a=>a.program_type===p).length}</strong></div>`).join('')}<p class="muted">Dossiers ouverts, toutes origines confondues.</p></section></div>
  <section class="card"><div class="card-heading"><h3>Les rendez-vous du jour</h3><button class="link-button" data-view="appointments">Voir l’agenda →</button></div>${appointments.length?appointments.map(a=>appointmentRow(a)).join(''):'<div class="empty">Aucun rendez-vous prévu aujourd’hui.</div>'}</section>`;
 }
 function renderApplications() {
  $('content').innerHTML=`<div class="filters"><input id="search" type="search" placeholder="Rechercher un nom, téléphone ou numéro de dossier…" aria-label="Rechercher" value="${escape(state.filters.query)}"><select id="programFilter" aria-label="Programme"><option value="">Tous les programmes</option>${options(programs,state.filters.program)}</select><select id="stageFilter" aria-label="Étape"><option value="">Toutes les étapes</option>${options(stages,state.filters.stage)}</select></div><section class="card"><div id="applicationTable"></div></section>`;
  $('search').addEventListener('input',e=>{state.filters.query=e.target.value;renderTable();});
  $('programFilter').addEventListener('change',e=>{state.filters.program=e.target.value;renderTable();});
  $('stageFilter').addEventListener('change',e=>{state.filters.stage=e.target.value;renderTable();});
  renderTable();
 }
 function renderTable() {
  const q=state.filters.query.toLocaleLowerCase('fr').trim();
  const apps=state.apps.filter(a=>(!state.filters.program||a.program_type===state.filters.program)&&(!state.filters.stage||a.workflow_stage===state.filters.stage)&&(!q||`${a.id} ${a.name} ${a.phone}`.toLocaleLowerCase('fr').includes(q)));
  $('applicationTable').innerHTML=`<div class="card-heading"><h3>${apps.length} candidature${apps.length!==1?'s':''}</h3><span class="muted">Cliquez sur un nom pour ouvrir le dossier</span></div>${apps.length?`<div class="table-wrap"><table><thead><tr><th>Candidat</th><th>Programme</th><th>Étape</th><th>Suivi</th><th>Origine</th></tr></thead><tbody>${apps.map(a=>`<tr><td>${link(a)}<small>#${a.id} · ${escape(a.phone)}</small></td><td>${escape(programs[a.program_type])}<small>${date(a.created_on)}</small></td><td>${tag(a)}</td><td>${escape(a.assigned_to?person(a.assigned_to):'Non attribué')}<small>${a.follow_up_on?'Relance : '+date(a.follow_up_on):'Aucune relance planifiée'}</small></td><td>${escape(sources[a.source])}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Aucun dossier ne correspond à ces filtres.</div>'}`;
 }
 function appointmentRow(a) {
  const app=state.apps.find(x=>x.id===a.application_id);
  return `<div class="appointment"><time>${date(a.starts_at,true)}</time><div class="grow">${app?link(app):'Dossier #'+a.application_id}<small class="muted"> · ${escape(a.location)} · ${escape(person(a.assigned_to))}</small><p class="muted">${escape(a.instructions)}</p></div><span class="tag">${escape(appointmentStates[a.status])}</span></div>`;
 }
 function renderAppointments() {
  const upcoming=state.appointments.filter(a=>!['completed','missed','cancelled','rescheduled'].includes(a.status));
  const past=state.appointments.filter(a=>!upcoming.includes(a)).reverse();
  $('content').innerHTML=`<section><h3>À venir / à clôturer · ${upcoming.length}</h3>${upcoming.length?upcoming.map(appointmentRow).join(''):'<div class="card empty">Planifiez un rendez-vous depuis le dossier du candidat.</div>'}</section><section class="card"><h3>Historique</h3>${past.length?past.slice(0,50).map(appointmentRow).join(''):'<p class="muted">Aucun rendez-vous clôturé.</p>'}</section>`;
 }
 function detailsHTML(a) {
  const fields=[['Téléphone',a.phone],['WhatsApp',a.whatsapp],['E-mail',a.email],['Date de naissance',a.birth_date?date(a.birth_date):null],['Adresse',a.address],['Expérience',a.experience],['Véhicule',a.vehicle],['Durée souhaitée',a.plan_duration_months?`${a.plan_duration_months} mois`:null],['Co-emprunteur',a.co_borrower_name],['Téléphone co-emprunteur',a.co_borrower_phone],['Adresse co-emprunteur',a.co_borrower_address],['Permis déclaré',a.license_file_name],...Object.entries(a.service_details||{}).map(([k,v])=>[detailLabels[k]||k,v])];
  return `<dl class="details">${fields.filter(([,v])=>v!==null&&v!==undefined&&v!=='').map(([k,v])=>`<div><dt>${escape(k)}</dt><dd>${escape(typeof v==='object'?JSON.stringify(v):v)}</dd></div>`).join('')}</dl>`;
 }
 async function openCase(id) {
  const token=++state.detailToken;
  state.current=state.apps.find(a=>a.id===Number(id)); if(!state.current) return;
  const a=state.current;
  $('caseRef').textContent=`DOSSIER #${a.id} / ${programs[a.program_type]}`;
  $('caseName').textContent=a.name;
  $('caseBody').innerHTML='<p class="muted">Chargement du dossier…</p>';
  if(!$('caseDialog').open) $('caseDialog').showModal();
  try {
   const [notes,documents,audit]=await Promise.all(['admin_notes','documents','audit_logs'].map(t=>rows(t,q=>q.eq('application_id',a.id).order('created_at',{ascending:false}).order('id'))));
   if(token!==state.detailToken) return;
   const appointments=state.appointments.filter(x=>x.application_id===a.id);
   const staffOptions=Object.fromEntries(state.staff.map(s=>[s.user_id,s.display_name]));
   const drive=a.program_type==='DRIVE_TO_OWN';
   $('caseBody').innerHTML=`<div class="badge-line">${tag(a)}<span class="tag">${escape(sources[a.source])}</span><span class="tag">Reçu le ${date(a.created_on)}</span></div><div class="case-grid"><div>
   <section class="card"><h3>Informations du candidat</h3>${detailsHTML(a)}${a.note?`<p class="note">${escape(a.note)}</p>`:''}</section>
   <section class="card"><h3>Parcours du dossier</h3><form id="workflowForm"><div class="fields"><label>Étape<select name="workflow_stage">${options(Object.fromEntries(stageSets[a.program_type].map(s=>[s,stages[s]])),a.workflow_stage)}</select></label><label>Agent responsable<select name="assigned_to"><option value="">Non attribué</option>${options(staffOptions,a.assigned_to)}</select></label>${drive?`<label>Décision LOLC<select name="lolc_status">${options(lolc,a.lolc_status)}</select></label><label>Référence LOLC<input name="lolc_reference" value="${escape(a.lolc_reference)}" maxlength="200"></label>`:''}<label class="wide">Prochaine action<input name="next_action" value="${escape(a.next_action)}" maxlength="1000" placeholder="Appeler le candidat, compléter les pièces…"></label><label>Relance prévue<input name="follow_up_on" type="date" value="${escape(a.follow_up_on)}"></label></div>${drive?'<p class="section-note">LOLC décide du financement. L’approbation ne déclenche aucun échéancier de paiement.</p>':''}<h3 style="margin-top:22px">Préparation et contrôles</h3><div class="checklist">${Object.entries({administrative:'Contrôle administratif effectué',inspection_requested:'Inspection mécanique demandée par le client',inspection_completed:'Rapport de l’atelier reçu',paperwork:'Documents de remise finalisés',tracker:'Tracker installé',yango:'Intégration Yango terminée'}).map(([key,label])=>`<label class="check"><input type="checkbox" name="${key}" ${a.preparation?.[key]?'checked':''}>${label}</label>`).join('')}</div><label style="margin-top:16px">Atelier choisi / observations d’inspection<textarea name="inspection_notes" maxlength="3000">${escape(a.preparation?.inspection_notes)}</textarea></label><div class="form-error" role="alert"></div><button class="primary">Enregistrer le suivi</button></form></section>
   <section class="card"><h3>Notes internes</h3><form id="noteForm"><label>Ajouter une note<textarea name="body" required maxlength="10000" placeholder="Compte rendu d’appel, pièces manquantes, prochaine démarche…"></textarea></label><div class="form-error" role="alert"></div><button class="secondary">Ajouter la note</button></form>${notes.map(n=>`<div class="row"><div><p class="note">${escape(n.body)}</p><small>${escape(person(n.created_by))} · ${date(n.created_at,true)}</small></div></div>`).join('')}</section></div><div>
   <section class="card"><h3>Rendez-vous</h3>${appointments.map(p=>`<div class="row"><div><strong>${date(p.starts_at,true)}</strong><small>${escape(p.location)} · ${escape(person(p.assigned_to))}</small><small>${escape(p.instructions)}</small><label style="margin-top:8px">Statut<select data-appointment="${p.id}" data-original="${p.status}">${options(appointmentStates,p.status)}</select></label></div></div>`).join('')}<details style="margin-top:16px"><summary>＋ Programmer un rendez-vous</summary><form id="appointmentForm" style="margin-top:16px"><div class="fields"><label>Date et heure · Kinshasa<input name="starts_at" type="datetime-local" required></label><label>Agent<select name="assigned_to">${options(staffOptions,a.assigned_to||state.user.id)}</select></label><label class="wide">Lieu<input name="location" required maxlength="500" placeholder="Bureau GM Fleet — adresse"></label><label class="wide">Instructions<textarea name="instructions" maxlength="3000"></textarea></label><label class="check wide"><input type="checkbox" name="briefing_confirmed" required>Le candidat a été informé des conditions, documents et apports requis.</label></div><div class="form-error" role="alert"></div><button class="primary">Programmer</button><p class="muted">Les notifications WhatsApp automatiques ne sont pas encore connectées.</p></form></details></section>
   <section class="card"><h3>Documents privés</h3><p class="muted">PDF, JPG, PNG ou WebP · 10 Mo maximum par fichier. Accès réservé au personnel.</p>${documents.length?documents.map(d=>`<div class="row"><div><strong>${escape(d.name)}</strong><small>${Math.ceil(d.size_bytes/1024)} Ko · ${date(d.created_at)}</small></div><button class="link-button" data-document="${escape(d.storage_path)}">Ouvrir</button></div>`).join(''):'<p class="muted">Aucun document téléversé. Les noms déclarés sur le site ne sont pas des fichiers reçus.</p>'}<form id="documentForm"><label>Ajouter une pièce<input type="file" name="file" accept="application/pdf,image/jpeg,image/png,image/webp" required></label><div class="form-error" role="alert"></div><button class="secondary">Téléverser</button></form></section>
   <section class="card"><h3>Historique du dossier</h3><div class="timeline">${audit.length?audit.slice(0,60).map(eventHTML).join(''):'<p class="muted">Les nouvelles actions seront enregistrées ici.</p>'}</div></section></div></div>`;
   bindCase(a);
  } catch(error) {$('caseBody').innerHTML=`<p class="form-error">${escape(fail(error))}</p><button class="secondary" data-case="${a.id}">Réessayer</button>`;}
 }
 function eventHTML(e) {
  const old=e.changes.before||{}, next=e.changes.after||{};
  let title={applications:'Dossier',appointments:'Rendez-vous',admin_notes:'Note interne',documents:'Document'}[e.entity]||e.entity;
  title+=e.action==='INSERT'?' ajouté':' modifié';
  const lines=[];
  if(e.entity==='applications') {
   if(old.workflow_stage!==next.workflow_stage) lines.push(stages[next.workflow_stage]||next.workflow_stage);
   if(old.lolc_status!==next.lolc_status&&next.lolc_status!=='not_submitted') lines.push(lolc[next.lolc_status]);
   if(old.next_action!==next.next_action&&next.next_action) lines.push(next.next_action);
   if(old.follow_up_on!==next.follow_up_on&&next.follow_up_on) lines.push('Relance : '+date(next.follow_up_on));
   if(old.assigned_to!==next.assigned_to) lines.push('Agent : '+(next.assigned_to?person(next.assigned_to):'Non attribué'));
   if(e.action==='UPDATE'&&JSON.stringify(old.preparation)!==JSON.stringify(next.preparation)) lines.push('Checklist de préparation mise à jour');
  } else if(e.entity==='appointments') lines.push(appointmentStates[next.status]+' · '+date(next.starts_at,true));
  else if(e.entity==='documents') lines.push(next.name);
  else if(e.entity==='admin_notes') lines.push(next.body);
  return `<div class="event"><strong>${escape(title)}</strong><p>${escape(lines.join('\n'))}</p><small>${date(e.created_at,true)} · ${e.actor_id?escape(person(e.actor_id)):'Site web'}</small></div>`;
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
  submit($('workflowForm'),async f=>{
   const preparation={...a.preparation,inspection_notes:f.get('inspection_notes').trim()};
   ['administrative','inspection_requested','inspection_completed','paperwork','tracker','yango'].forEach(k=>preparation[k]=f.has(k));
   const payload={workflow_stage:f.get('workflow_stage'),assigned_to:f.get('assigned_to')||null,next_action:f.get('next_action').trim()||null,follow_up_on:f.get('follow_up_on')||null,preparation};
   if(a.program_type==='DRIVE_TO_OWN') Object.assign(payload,{lolc_status:f.get('lolc_status'),lolc_reference:f.get('lolc_reference').trim()||null});
   const data=await check(await db.from('applications').update(payload).eq('id',a.id).eq('revision',a.revision).select('id'));
   if(!data.length) throw new Error('Ce dossier a changé depuis son ouverture. Fermez-le puis ouvrez-le à nouveau avant de modifier le suivi.');
   await refreshCase(a.id);notify('Suivi du dossier enregistré.');
  });
  submit($('noteForm'),async f=>{await check(await db.from('admin_notes').insert({application_id:a.id,body:f.get('body').trim()}));await refreshCase(a.id);});
  submit($('appointmentForm'),async f=>{
   const starts_at=new Date(f.get('starts_at')+':00+01:00').toISOString();
   await check(await db.from('appointments').insert({application_id:a.id,starts_at,location:f.get('location').trim(),assigned_to:f.get('assigned_to'),instructions:f.get('instructions').trim(),briefing_confirmed:f.has('briefing_confirmed')}));
   await refreshCase(a.id);notify('Rendez-vous enregistré. Contactez le candidat pour confirmer les détails.');
  });
  submit($('documentForm'),async f=>{
   const file=f.get('file'); const ext={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
   if(!ext||file.size===0||file.size>10485760) throw new Error('Choisissez un PDF ou une image JPG, PNG ou WebP de moins de 10 Mo.');
   const path=`${a.id}/${crypto.randomUUID()}.${ext}`;
   await check(await db.storage.from('application-documents').upload(path,file,{contentType:file.type,upsert:false}));
   try {await check(await db.from('documents').insert({application_id:a.id,name:file.name,storage_path:path,mime_type:file.type,size_bytes:file.size}));}
   catch(e) {await db.storage.from('application-documents').remove([path]);throw e;}
   await refreshCase(a.id);notify('Document enregistré dans le dossier privé.');
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
 document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b) return;
  if(b.dataset.view) {state.view=b.dataset.view;render();}
  if(b.dataset.case) await openCase(b.dataset.case);
  if(b.dataset.close) $(b.dataset.close).close();
  if(b.dataset.document) {
   const preview=window.open('about:blank','_blank'); if(preview) preview.opener=null;
   b.disabled=true;
   try {const data=await check(await db.storage.from('application-documents').createSignedUrl(b.dataset.document,120));if(preview) preview.location.href=data.signedUrl;else throw new Error('Autorisez les fenêtres pour ouvrir le document.');}
   catch(error) {preview?.close();notify(fail(error),true);} finally {b.disabled=false;}
  }
 });
 $('newApplication').addEventListener('click',()=>{$('intakeForm').reset();$('intakeForm').querySelector('.form-error').textContent='';$('intake').showModal();});
 submit($('intakeForm'),async f=>{
  const program=f.get('program'),service=services[program];
  const payload={name:f.get('name').trim(),phone:f.get('phone').trim(),source:f.get('source'),vehicle:f.get('vehicle').trim()||service||'À préciser',service,application_type:service?'service':'vehicle',assigned_to:state.user.id,service_details:{licenseNumber:f.get('licenseNumber').trim(),carPlate:f.get('carPlate').trim(),carModel:f.get('vehicle').trim(),yangoStatus:f.get('yangoStatus').trim()}};
  ['whatsapp','email','birth_date','address','experience','co_borrower_name','co_borrower_phone','co_borrower_address'].forEach(k=>payload[k]=f.get(k).trim()||null);
  payload.plan_duration_months=program==='DRIVE_TO_OWN'&&f.get('duration')?Number(f.get('duration')):null;
  const data=await check(await db.from('applications').insert(payload).select('id').single());
  $('intake').close();await reload();await openCase(data.id);notify('Candidature créée. Vous pouvez ajouter les pièces et planifier le rendez-vous.');
 });
 $('refresh').addEventListener('click',async()=>{try{await reload();notify('Données actualisées.');}catch(e){notify(fail(e),true);}});
 $('logout').addEventListener('click',async()=>{await db.auth.signOut();location.href='/login.html';});
 async function init() {
  try {
   if(!db) throw new Error('Le service de connexion est indisponible. Réessayez plus tard.');
   const {data,error}=await db.auth.getUser();if(error||!data.user){location.replace('/login.html');return;}
   state.user=data.user;
   const staff=await check(await db.from('staff_members').select('*').eq('user_id',data.user.id).eq('active',true).maybeSingle());
   if(!staff) {$('access').innerHTML='<h1>Accès réservé au personnel</h1><p>Ce compte ne dispose pas d’un accès aux opérations GM Fleet.</p><button id="accessLogout" class="secondary">Changer de compte</button>';$('accessLogout').onclick=async()=>{await db.auth.signOut();location.replace('/login.html');};return;}
   $('staffName').textContent=staff.display_name;
   $('today').textContent=new Intl.DateTimeFormat('fr-FR',{dateStyle:'full',timeZone:'Africa/Kinshasa'}).format(new Date());
   await reload();$('access').hidden=true;$('workspace').hidden=false;
   db.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')location.replace('/login.html');});
   setInterval(async()=>{if(document.hidden||document.querySelector('dialog[open]'))return;try{await reload();}catch(e){notify('Actualisation interrompue. '+fail(e),true);}},60000);
  } catch(e) {$('access').innerHTML=`<h1>Connexion indisponible</h1><p>${escape(fail(e))}</p><button class="secondary" id="retry">Réessayer</button>`;$('retry').onclick=()=>location.reload();}
 }
 init();
})();
