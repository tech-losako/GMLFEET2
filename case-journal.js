/* Notes and the server-owned dossier audit trail. */
(() => {
 'use strict';
 const reviews={pending:'\u00c0 examiner',accepted:'Retenue',rejected:'Refus\u00e9e'};
 const documentStates={pending:'\u00c0 v\u00e9rifier',approved:'Valid\u00e9',rejected:'Refus\u00e9'};
 const kinds={applications:'Dossier',documents:'Documents',appointments:'Rendez-vous',admin_notes:'Notes'};
 const icons={applications:'folder-clock',documents:'file-check-2',appointments:'calendar-clock',admin_notes:'message-square-text'};
 const roles={super_admin:'Super administrateur',admin:'Administrateur',agent:'Agent',cashier:'Caissier'};
 const labels={name:'Nom du candidat',phone:'T\u00e9l\u00e9phone',whatsapp:'WhatsApp',email:'E-mail',address:'Adresse',birth_date:'Date de naissance',experience:'Exp\u00e9rience',vehicle:'V\u00e9hicule',plan_duration_months:'Dur\u00e9e souhait\u00e9e (mois)',co_borrower_name:'Co-emprunteur',co_borrower_phone:'T\u00e9l\u00e9phone du co-emprunteur',co_borrower_address:'Adresse du co-emprunteur',license_file_name:'Permis d\u00e9clar\u00e9',note:'Note du candidat',review_status:'D\u00e9cision GML',review_reason:'Motif / observations',assigned_to:'Agent responsable',workflow_stage:'Statut du dossier',process_step:'\u00c9tape du parcours',lolc_status:'D\u00e9cision LOLC',lolc_reference:'R\u00e9f\u00e9rence LOLC',next_action:'Prochaine action',follow_up_on:'Date de relance',status:'Statut',purpose:'Objet',starts_at:'Date et heure',location:'Lieu',instructions:'Instructions',outcome:'R\u00e9sultat',outcome_notes:'Compte rendu',briefing_confirmed:'Informations v\u00e9rifi\u00e9es',body:'Note',category:'Type de pi\u00e8ce',replacement_note:'Motif du remplacement',model:'Mod\u00e8le',plate:'Plaque',vin:'Ch\u00e2ssis / VIN',color:'Couleur',purchase_date:'Date d\u2019achat',installation_date:'Date d\u2019installation',handover_date:'Date de remise',tracker_id:'Identifiant tracker',dashcam_id:'Identifiant dashcam',fuel_reference:'Re\u00e7u du plein initial',fuel_paid_on:'Date du plein initial',fleet_joined_on:'Entr\u00e9e dans la flotte',handover_on:'Date de remise',inspection_notes:'Observations d\u2019inspection',administrative:'Contr\u00f4le administratif',inspection_requested:'Inspection demand\u00e9e',inspection_completed:'Rapport d\u2019inspection re\u00e7u',paperwork:'Documents de remise',tracker:'Tracker install\u00e9',yango:'Int\u00e9gration Yango'};
 const outcomeLabels={lolc_approved:'Cr\u00e9dit approuv\u00e9 par LOLC',lolc_rejected:'Cr\u00e9dit refus\u00e9 par LOLC',information_required:'Compl\u00e9ment demand\u00e9',vehicle_bought:'V\u00e9hicule achet\u00e9',delayed:'Report\u00e9',installed:'Installation termin\u00e9e',installation_incomplete:'Installation incompl\u00e8te',handed_over:'V\u00e9hicule remis',completed:'Effectu\u00e9',missed:'Absent',cancelled:'Annul\u00e9'};
 const categories={identity:'Identit\u00e9',license:'Permis de conduire',residence:'Domicile',yango:'Exp\u00e9rience Yango',registration:'Carte rose',insurance:'Assurance',cv:'CV',vehicle_photo:'Photo du v\u00e9hicule',other:'Autre pi\u00e8ce'};
 const empty=value=>value===null||value===undefined||value==='';
 const same=(a,b)=>a===b||(empty(a)&&empty(b));
 const normalize=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr');
 function flatten(value,prefix='',result=Object.create(null)){
  if(value&&typeof value==='object'&&!Array.isArray(value))Object.entries(value).forEach(([key,item])=>flatten(item,prefix?prefix+'.'+key:key,result));
  else if(prefix)result[prefix]=value;
  return result;
 }
 function describeEvent(event,c){
  const before=event.changes?.before||{},after=event.changes?.after||{},insert=event.action==='INSERT',changes=[];
  const kind=event.entity,program=after.program_type||before.program_type||c.application.program_type;
  const fieldLabels={...labels,...c.detailLabels,...c.workflow.flows[program]?.checks};
  const format=(field,value)=>{
   if(empty(value))return field==='assigned_to'?'Non attribu\u00e9':'Non renseign\u00e9';
   if(field==='assigned_to')return c.person(value);
   if(field==='review_status')return (kind==='documents'?documentStates:reviews)[value]||value;
   if(field==='workflow_stage')return c.stages[value]||value;
   if(field==='process_step')return c.workflow.flows[program]?.steps[value]||(value==='review'?'Examen GML':value);
   if(field==='lolc_status')return c.lolc[value]||value;
   if(field==='status')return c.appointmentStates[value]||value;
   if(field==='purpose')return c.workflow.purposes[value]||value;
   if(field==='outcome')return outcomeLabels[value]||value;
   if(field==='category')return categories[value]||value;
   if(field==='starts_at')return c.date(value,true);
   if(['follow_up_on','birth_date','purchase_date','installation_date','handover_date','handover_on','fuel_paid_on','fleet_joined_on'].includes(field))return c.date(value);
   if(typeof value==='boolean')return value?'Oui':'Non';
   if(typeof value==='object')return JSON.stringify(value);
   return String(value);
  };
  const add=(field,label=fieldLabels[field]||field)=>{
   if(!same(before[field],after[field]))changes.push({label,before:insert?null:format(field,before[field]),after:format(field,after[field])});
  };
  const nested=(field,group)=>{
   const old=flatten(before[field]),next=flatten(after[field]);
   [...new Set([...Object.keys(old),...Object.keys(next)])].forEach(path=>{
    if(path.startsWith('last_decision.'))return;
    if(same(old[path],next[path]))return;
    const parts=path.split('.'),key=parts.at(-1),prefix={purchased_vehicle:'V\u00e9hicule achet\u00e9',equipment:'Installation',owner_vehicle:'V\u00e9hicule propri\u00e9taire'}[parts[0]];
    changes.push({label:[prefix||group,fieldLabels[key]||key.replaceAll('_',' ')].join(' \u00b7 '),before:insert?null:format(key,old[path]),after:format(key,next[path])});
   });
  };
  let title='Dossier actualis\u00e9',context='';
  if(kind==='applications'){
   if(insert){title='Candidature re\u00e7ue';context=after.name||c.application.name;add('assigned_to');add('review_status');}
   else{
    const fields=['assigned_to','review_status','process_step','workflow_stage','lolc_status','lolc_reference','review_reason','next_action','follow_up_on','name','phone','whatsapp','email','address','birth_date','experience','vehicle','plan_duration_months','co_borrower_name','co_borrower_phone','co_borrower_address','license_file_name','note'];
    fields.forEach(field=>add(field));nested('preparation','Contr\u00f4les');nested('service_details','Informations du candidat');
    const decision=after.preparation?.last_decision;
    if(decision&&decision.request_id!==before.preparation?.last_decision?.request_id){
     const spec=c.workflow.decisionSpec?.({program_type:program,process_step:decision.step});
     changes.unshift({label:spec?.title||'D\u00e9cision op\u00e9rationnelle',before:null,after:spec?.choices[decision.outcome]||outcomeLabels[decision.outcome]||decision.outcome.replaceAll('_',' ')});
     if(decision.notes)changes.push({label:'Compte rendu',before:null,after:decision.notes});
    }
    title=before.review_status!==after.review_status&&after.review_status?({accepted:'Candidature retenue par GML',rejected:'Candidature refus\u00e9e par GML',pending:'Dossier remis en examen'})[after.review_status]||title:
     before.assigned_to!==after.assigned_to?(before.assigned_to?'Responsable du dossier chang\u00e9':'Dossier pris en charge'):
     before.process_step!==after.process_step||before.workflow_stage!==after.workflow_stage?'\u00c9tape du dossier actualis\u00e9e':'Suivi du dossier actualis\u00e9';
   }
  }else if(kind==='documents'){
   context=after.name||before.name||'Document';
   title=insert?(after.replaces_document_id?'Document remplac\u00e9':'Document ajout\u00e9'):
    before.review_status!==after.review_status?({approved:'Document valid\u00e9',rejected:'Document refus\u00e9',pending:'Document remis en v\u00e9rification'})[after.review_status]||'Document actualis\u00e9':'V\u00e9rification du document actualis\u00e9e';
   ['category','review_status','review_reason','replacement_note'].forEach(field=>add(field));
  }else if(kind==='appointments'){
   title=insert?'Rendez-vous programm\u00e9':before.outcome!==after.outcome&&after.outcome?'Rendez-vous cl\u00f4tur\u00e9':before.starts_at!==after.starts_at?'Rendez-vous reprogramm\u00e9':'Rendez-vous actualis\u00e9';
   context=c.workflow.purposes[after.purpose||before.purpose]||'Rendez-vous';
   ['assigned_to','status','starts_at','location','instructions','outcome','outcome_notes','briefing_confirmed'].forEach(field=>add(field));nested('result','Compte rendu');
  }else if(kind==='admin_notes'){
   title=insert?'Note interne ajout\u00e9e':'Note interne actualis\u00e9e';context=after.body||before.body||'';
   if(context.length>220)context=context.slice(0,220)+'\u2026';
  }
  // The audit actor is the person who acted, not necessarily the dossier assignee.
  const actorId=event.actor_id||(kind==='admin_notes'?after.created_by:null);
  const actor=actorId?c.person(actorId):insert&&['applications','documents'].includes(kind)?'Candidat / site web':'Automatisation';
  return {...event,title,context,changes,actorId,actor,kind};
 }
 function mount(c){
  const {root,escape:e,date,person,staffMember,state,application}=c;
  if(state.caseActivity?.applicationId!==application.id)state.caseActivity={applicationId:application.id,tab:'notes',kind:'all',actor:'all',query:'',order:'desc',limit:30,draft:''};
  const ui=state.caseActivity;
  const events=c.audit.map(event=>describeEvent(event,c));
  const sortedNotes=[...c.notes].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))||String(b.id).localeCompare(String(a.id)));
  const icon=name=>`<i data-lucide="${name}" aria-hidden="true"></i>`;
  const authorMeta=id=>{const staff=staffMember(id);return [roles[staff?.role],staff?.deleted_at?'Ancien compte':staff?.active===false?'Compte d\u00e9sactiv\u00e9':null].filter(Boolean).join(' \u00b7 ');};
  const authorName=person(state.user.id);
  root.classList.add('case-activity');
  root.innerHTML=`<div class="case-activity-tabs" role="tablist" aria-label="Notes et journal du dossier"><button type="button" id="case-activity-tab-notes" role="tab" aria-controls="case-activity-notes" data-activity-tab="notes">${icon('message-square-text')}Notes internes <span>${c.notes.length}</span></button><button type="button" id="case-activity-tab-journal" role="tab" aria-controls="case-activity-journal" data-activity-tab="journal">${icon('history')}Journal du dossier <span>${events.length}</span></button></div>
   <section id="case-activity-notes" class="case-activity-view" role="tabpanel" aria-labelledby="case-activity-tab-notes"><div class="case-activity-heading"><h3>Notes internes</h3><span class="muted">${c.notes.length} note${c.notes.length!==1?'s':''}</span></div>
   <form id="noteForm" class="case-note-composer"><label>Nouvelle note<textarea name="body" required maxlength="10000" rows="4" placeholder="Compte rendu, observations, prochaine action\u2026">${e(ui.draft)}</textarea></label><div class="form-error" role="alert"></div><div class="case-note-composer-footer"><span>Auteur : <strong>${e(authorName)}</strong></span><button type="submit" class="primary">${icon('send')}Ajouter la note</button></div></form>
   <ol class="case-note-list">${sortedNotes.map(note=>`<li class="case-note-entry"><div class="case-note-head"><div class="case-note-author"><span class="case-author-initials" aria-hidden="true">${e(person(note.created_by).split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toLocaleUpperCase('fr'))}</span><div><strong>${e(person(note.created_by))}</strong><small>${e(authorMeta(note.created_by))}</small></div></div><time datetime="${e(note.created_at)}">${e(date(note.created_at,true))}</time></div><p>${e(note.body)}</p></li>`).join('')||'<li class="case-activity-empty">Aucune note interne.</li>'}</ol></section>
   <section id="case-activity-journal" class="case-activity-view" role="tabpanel" aria-labelledby="case-activity-tab-journal"><div class="case-activity-heading"><h3>Journal du dossier</h3><span class="muted">Heure de Kinshasa</span></div><div class="case-journal-filters"><label class="case-journal-search">Rechercher<div>${icon('search')}<input type="search" id="case-journal-query" maxlength="200" placeholder="Action, agent, document\u2026" value="${e(ui.query)}"></div></label><label>Activit\u00e9<select id="case-journal-kind"><option value="all">Toutes les activit\u00e9s</option>${Object.entries(kinds).map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label><label>Agent<select id="case-journal-actor"><option value="all">Tous les intervenants</option>${[...new Map(events.map(event=>[event.actorId||'system',event.actorId?person(event.actorId):'Site web / automatisation'])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'fr')).map(([id,label])=>`<option value="${e(id)}">${e(label)}</option>`).join('')}</select></label><label>Ordre<select id="case-journal-order"><option value="desc">Plus r\u00e9centes</option><option value="asc">Plus anciennes</option></select></label></div><p id="case-journal-count" class="muted" role="status"></p><div id="case-journal-log"></div><button type="button" class="secondary case-journal-more" hidden>${icon('chevron-down')}Afficher la suite</button></section>`;
  const tabs=root.querySelector('.case-activity-tabs');
  const selectTab=tab=>{
   ui.tab=tab;
   tabs.querySelectorAll('button').forEach(button=>{const active=button.dataset.activityTab===tab;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;});
   root.querySelectorAll('.case-activity-view').forEach(panel=>panel.hidden=panel.id!=='case-activity-'+tab);
  };
  tabs.onclick=event=>{const button=event.target.closest('[data-activity-tab]');if(button)selectTab(button.dataset.activityTab);};
  tabs.onkeydown=event=>{
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
   event.preventDefault();const buttons=[...tabs.children],index=buttons.indexOf(document.activeElement),next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
   buttons[next].click();buttons[next].focus();
  };
  selectTab(ui.tab);
  const form=root.querySelector('#noteForm');
  form.elements.body.addEventListener('input',()=>{ui.draft=form.elements.body.value;});
  c.submit(form,async data=>{
   const body=data.get('body').trim();if(!body)throw new Error('La note ne peut pas \u00eatre vide.');
   await c.check(await c.db.from('admin_notes').insert({application_id:application.id,body}));
   ui.draft='';ui.tab='notes';state.caseTab='history';await c.refreshCase(application.id);c.notify('Note enregistr\u00e9e.');
  });
  const changesHTML=changes=>`<dl class="case-journal-changes">${changes.map(change=>`<div><dt>${e(change.label)}</dt><dd>${change.before!==null?`<span class="case-journal-before">${e(change.before)}</span>${icon('arrow-right')}`:''}<span>${e(change.after)}</span></dd></div>`).join('')}</dl>`;
  const eventHTML=event=>`<li class="case-journal-entry" data-event-id="${e(event.id)}"><span class="case-journal-icon" aria-hidden="true">${icon(icons[event.kind]||'activity')}</span><article><div class="case-journal-entry-head"><strong>${e(event.title)}</strong><time datetime="${e(event.created_at)}">${e(new Intl.DateTimeFormat('fr-FR',{timeStyle:'short',timeZone:'Africa/Kinshasa'}).format(new Date(event.created_at)))}</time></div><div class="case-journal-byline"><strong>${e(event.actor)}</strong>${authorMeta(event.actorId)?`<span>${e(authorMeta(event.actorId))}</span>`:''}<span class="case-journal-kind">${e(kinds[event.kind]||'Dossier')}</span></div>${event.context?`<p class="case-journal-context">${e(event.context)}</p>`:''}${changesHTML(event.changes.slice(0,3))}${event.changes.length>3?`<details class="case-journal-details"><summary>${event.changes.length-3} autre${event.changes.length-3!==1?'s':''} changement${event.changes.length-3!==1?'s':''}</summary>${changesHTML(event.changes.slice(3))}</details>`:''}</article></li>`;
  const renderLog=()=>{
   const query=normalize(ui.query.trim());
   const filtered=events.filter(event=>(ui.kind==='all'||event.kind===ui.kind)&&(ui.actor==='all'||(event.actorId||'system')===ui.actor)&&(!query||normalize([event.title,event.context,event.actor,...event.changes.flatMap(change=>[change.label,change.before||'',change.after])].join(' ')).includes(query)));
   filtered.sort((a,b)=>(ui.order==='asc'?1:-1)*(String(a.created_at).localeCompare(String(b.created_at))||String(a.id).localeCompare(String(b.id),'en',{numeric:true})));
   const visible=filtered.slice(0,ui.limit),groups=new Map();
   visible.forEach(event=>{const key=date(event.created_at);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(event);});
   root.querySelector('#case-journal-log').innerHTML=[...groups].map(([day,items])=>`<section class="case-journal-day"><h4>${e(day)}</h4><ol>${items.map(eventHTML).join('')}</ol></section>`).join('')||'<p class="case-activity-empty">'+(events.length?'Aucune activit\u00e9 ne correspond aux filtres.':'Aucune activit\u00e9 enregistr\u00e9e.')+'</p>';
   root.querySelector('#case-journal-count').textContent=`${visible.length} / ${filtered.length} activit\u00e9${filtered.length!==1?'s':''}`;
   root.querySelector('.case-journal-more').hidden=visible.length>=filtered.length;
   window.lucide?.createIcons({attrs:{'aria-hidden':'true'}});
  };
  ['kind','actor','order'].forEach(key=>{
   const select=root.querySelector('#case-journal-'+key);select.value=ui[key];if(!select.value){ui[key]=key==='order'?'desc':'all';select.value=ui[key];}
   select.onchange=()=>{ui[key]=select.value;ui.limit=30;renderLog();};
  });
  root.querySelector('#case-journal-query').oninput=event=>{ui.query=event.target.value;ui.limit=30;renderLog();};
  root.querySelector('.case-journal-more').onclick=()=>{ui.limit+=30;renderLog();};
  renderLog();
 }
 window.GMFleetCaseJournal={mount,describeEvent};
})();
