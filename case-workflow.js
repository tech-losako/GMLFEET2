/* Programme-specific decisions, backed by guarded database transitions. */
(() => {
 'use strict';
 const flows={
  DRIVE_TO_OWN:{steps:{appointment:'Rendez-vous : ouverture du compte',account:'Compte ouvert · accord LOLC attendu',sourcing:'Éligible · recherche du véhicule',gml_inspection:'Véhicule trouvé · inspection GML',lolc_inspection:'Inspection GML faite · contrôle LOLC',client_validation:'Contrôle LOLC fait · validation client',custody:'Client d’accord · acheminement LOLC',equipment:'Véhicule chez GML · équipements',documents:'Tracker installé · documents de remise',handover:'Véhicule remis'},checks:{account_opened:'Compte ouvert lors du rendez-vous',lolc_eligible:'Éligibilité confirmée par LOLC',vehicle_found:'Véhicule identifié',gml_inspected:'Inspection GML favorable',lolc_inspected:'Inspection LOLC favorable',client_validated:'Véhicule validé par le client',vehicle_received:'Véhicule reçu chez GML via LOLC',tracker:'Tracker installé',paperwork:'Documents de remise disponibles',yango:'Intégration Yango terminée'},hint:'GML retient le dossier ; LOLC décide de l’éligibilité. Après remise, le premier versement est attendu le lendemain en fin de journée.',purpose:'account'},
  PARTNER_DRIVER:{steps:{appointment:'Rendez-vous : entretien et conduite',interview:'Entretien réussi · test de conduite',test:'Test réussi · intégration',allocation:'Prêt pour affectation'},checks:{interview_passed:'Entretien favorable',driving_test_passed:'Test de conduite réussi',training_completed:'Formation / intégration effectuée'},hint:'Après l’entretien et le test, affectez un véhicule disponible avec les conditions du contrat signé.',purpose:'driving_test'},
  FLEET_OWNER:{steps:{appointment:'Rendez-vous : propriétaire et véhicule',inspection:'Inspection et documents',repairs:'Réparations demandées au propriétaire',equipment:'Contrôles favorables · installation',ready:'Équipé · entrée dans la flotte'},checks:{roadworthy:'Véhicule roulant, sans problème mécanique',carte_rose:'Carte rose valide',insurance:'Assurance valide',transport_authorization:'Autorisation de transport valide',vignette:'Vignette valide',technical_control:'Contrôle technique valide',tracker:'Tracker installé',dashcam:'Dashcam installée'},hint:'Si le véhicule présente un problème, indiquez les réparations nécessaires. L’entrée dans la flotte exige les documents, les équipements et la réception des 70 USD pour le plein initial.',purpose:'vehicle_inspection'},
  YANGO:{steps:{appointment:'Validation GML faite · contacter le chauffeur',invited:'Invité à choisir GM Fleet dans Yango',joined:'Rattachement à GML confirmé'},checks:{invitation_explained:'Le chauffeur a reçu les instructions après validation GML',yango_joined:'Rattachement effectif à GM Fleet vérifié'},hint:'Le chauffeur transmet ses informations avant de choisir GML dans Yango. Comptez-le comme partenaire uniquement après confirmation de son rattachement.',purpose:'meeting'}
 };
 const purposes={account:'Ouverture du compte LOLC',driving_test:'Entretien et test de conduite',vehicle_inspection:'Inspection du véhicule propriétaire',vehicle_purchase:'Achat et réception du véhicule',handover:'Remise du véhicule',installation:'Installation des équipements',meeting:'Échange / accompagnement'};
 const review=a=>a.review_status||(['rejected','withdrawn'].includes(a.workflow_stage)?'rejected':['new','to_contact','contacted','screening'].includes(a.workflow_stage)?'pending':'accepted');
 const step=a=>flows[a.program_type]?.steps[a.process_step]||'Suivi existant';
 const nextPurpose=a=>a.process_step==='appointment'?flows[a.program_type]?.purpose:null;
 function form(a,{escape:e,options,staffOptions,lolc}){
  const f=flows[a.program_type],accepted=review(a)==='accepted';
  if(a.lifecycle_version!==1&&accepted){
   if(a.program_type==='DRIVE_TO_OWN'&&a.process_step==='handover')return '<h3>Véhicule remis</h3><button class="primary" data-case-contracts>Activer le contrat signé</button>';
   if(a.program_type==='PARTNER_DRIVER'&&a.process_step==='allocation')return '<h3>Chauffeur prêt pour affectation</h3><button class="primary" data-case-contracts>Ouvrir les contrats et affectations</button>';
   if(a.program_type==='YANGO'&&a.process_step==='joined')return '<h3>Rattachement Yango confirmé</h3>';
   return '';
  }
  const agent=staffOptions[a.assigned_to]||'Agent non attribué';
  if(a.program_type==='DRIVE_TO_OWN')return `<h3>Responsable et prochaine action</h3><form id="workflowForm"><div class="fields"><label>Agent attribué<input value="${e(agent)}" disabled><input type="hidden" name="assigned_to" value="${e(a.assigned_to||'')}"></label><label>Relance prévue<input name="follow_up_on" type="date" value="${e(a.follow_up_on||'')}"></label><label class="wide">Prochaine action<input name="next_action" value="${e(a.next_action||'')}" maxlength="1000"></label></div><p class="section-note">L’avancement est mis à jour automatiquement lorsque chaque rendez-vous est clôturé.</p><div class="form-error" role="alert"></div><button class="secondary">Enregistrer le suivi</button></form>${accepted&&a.process_step==='handover'?'<div class="next-action"><p>La remise est terminée. Le contrat reste volontairement à valider par un administrateur avant la création des échéances.</p><button class="primary" data-case-contracts>Activer le contrat signé</button></div>':''}`;
  return `<h3>Suivi · ${e(a.program_type==='YANGO'?'Partenaire Yango':a.program_type==='FLEET_OWNER'?'Véhicule propriétaire':'Chauffeur GML')}</h3><p class="section-note">${e(f.hint)}</p><form id="workflowForm"><div class="fields"><label>Agent attribué<input value="${e(agent)}" disabled><input type="hidden" name="assigned_to" value="${e(a.assigned_to||'')}"></label><label>Relance prévue<input name="follow_up_on" type="date" value="${e(a.follow_up_on||'')}"></label><label class="wide">Prochaine action<input name="next_action" value="${e(a.next_action||'')}" maxlength="1000"></label></div>${accepted?`<fieldset class="process-fields"><legend>Avancement du projet</legend><label>Situation actuelle<select name="process_step">${options(f.steps,a.process_step in f.steps?a.process_step:'appointment')}</select></label><div class="process-checks">${Object.entries(f.checks).map(([k,label])=>`<label class="check"><input type="checkbox" name="${k}" ${a.preparation?.[k]?'checked':''}>${e(label)}</label>`).join('')}</div><label>Observations<textarea name="inspection_notes" maxlength="3000">${e(a.preparation?.inspection_notes||'')}</textarea></label></fieldset>`:'<p class="section-note">Examinez le récapitulatif et les documents avant de prendre une décision.</p>'}<div class="form-error" role="alert"></div><button class="primary">Enregistrer le suivi</button></form>${accepted&&a.program_type==='PARTNER_DRIVER'&&a.process_step==='allocation'?'<div class="next-action"><p>Le chauffeur est prêt. Sélectionnez un véhicule disponible et enregistrez son contrat signé.</p><button class="secondary" data-case-contracts>Ouvrir les contrats et affectations →</button></div>':''}`;
 }
 const decisions={
  DRIVE_TO_OWN:{
   appointment:{title:'Décision LOLC',choices:{lolc_approved:'Dossier approuvé par LOLC',information_required:'Complément demandé par LOLC',lolc_rejected:'Dossier refusé par LOLC'}},
   sourcing:{title:'Identification du véhicule',choices:{vehicle_selected:'Véhicule identifié',deferred:'Recherche à poursuivre'},fields:[['model','Modèle'],['plate','Plaque'],['vin','Châssis / VIN'],['color','Couleur','text',false]]},
   gml_inspection:{title:'Contrôle GML',choices:{inspection_passed:'Contrôle GML favorable',deferred:'Contrôle non favorable / à compléter'}},
   lolc_inspection:{title:'Contrôle LOLC',choices:{inspection_passed:'Contrôle LOLC favorable',deferred:'Contrôle non favorable / à compléter'}},
   client_validation:{title:'Validation du candidat',choices:{vehicle_accepted:'Véhicule accepté par le candidat',deferred:'Véhicule refusé / décision attendue'}},
   custody:{title:'Achat et réception',choices:{vehicle_received:'Véhicule acheté et reçu chez GML',deferred:'Réception en attente'},fields:[['purchase_date','Date réelle d’achat / réception','date']]},
   equipment:{title:'Installation des équipements',choices:{installed:'Installation terminée',deferred:'Installation à terminer'},fields:[['tracker_id','Identifiant tracker'],['dashcam_id','Identifiant dashcam','text',false]]},
   documents:{title:'Remise du véhicule',choices:{handed_over:'Véhicule remis au candidat',deferred:'Remise reportée'},fields:[['handover_date','Date réelle de remise','date']],checks:{paperwork:'Documents de remise finalisés',yango:'Intégration Yango confirmée'}}
  },
  PARTNER_DRIVER:{appointment:{title:'Décision entretien',choices:{interview_passed:'Entretien favorable',deferred:'Entretien non favorable / à reprendre'}},interview:{title:'Test de conduite',choices:{driving_test_passed:'Test de conduite réussi',deferred:'Test non réussi / à reprendre'}},test:{title:'Formation et intégration',choices:{training_completed:'Formation et intégration terminées',deferred:'Intégration à compléter'}}},
  FLEET_OWNER:{appointment:{title:'Décision inspection propriétaire',choices:{inspection_passed:'Véhicule et documents conformes',repairs_required:'Réparations / documents à compléter'},checks:Object.fromEntries(Object.entries(flows.FLEET_OWNER.checks).filter(([k])=>!['tracker','dashcam'].includes(k)))},equipment:{title:'Installation propriétaire',choices:{installed:'Tracker et dashcam installés',deferred:'Installation à terminer'},fields:[['tracker_id','Identifiant tracker'],['dashcam_id','Identifiant dashcam']]}},
  YANGO:{appointment:{title:'Accompagnement Yango',choices:{invitation_explained:'Instructions de rattachement transmises',deferred:'Accompagnement à reprendre'}},invited:{title:'Confirmation du rattachement',choices:{yango_joined:'Rattachement GM Fleet vérifié',deferred:'Rattachement non confirmé'}}}
 };
 decisions.DRIVE_TO_OWN.account=decisions.DRIVE_TO_OWN.appointment;
 decisions.FLEET_OWNER.inspection=decisions.FLEET_OWNER.appointment;
 decisions.FLEET_OWNER.repairs={...decisions.FLEET_OWNER.appointment,title:'Contrôle après réparations'};
 const decisionSpec=a=>decisions[a.program_type]?.[a.process_step];
 const kinshasaDay=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Kinshasa',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
 function decisionForm(a,ap,e){
  const spec=decisionSpec(a),today=kinshasaDay(new Date()),future=ap&&kinshasaDay(ap.starts_at)>today;
  if(!spec)return '';
  const choices={...spec.choices,...(ap?{missed:'Le candidat ne s’est pas présenté',cancelled:'Annuler le rendez-vous'}:{})};
  const values={...a.preparation?.purchased_vehicle,...a.preparation?.equipment};
  return `<form id="caseStepForm" class="case-step-form"><div class="case-step-heading"><span class="eyebrow">${e(a.case_reference||'')}</span><h3>${e(spec.title)}</h3></div>${a.program_type==='DRIVE_TO_OWN'&&['appointment','account'].includes(a.process_step)?`<label>Référence de suivi LOLC<input data-lolc-reference value="${e(a.lolc_reference||'Attribuée automatiquement après approbation')}" readonly></label>`:''}<label>Décision<select name="outcome" required><option value="">Sélectionner la décision</option>${Object.entries(choices).map(([value,label])=>`<option value="${value}" ${future&&value!=='cancelled'?'disabled':''}>${e(label)}</option>`).join('')}</select></label><div data-decision-fields hidden><div class="fields">${(spec.fields||[]).map(([key,label,type='text',required=true])=>`<label>${e(label)}<input name="${key}" type="${type}" ${type==='date'?`max="${today}"`:'maxlength="200"'} data-decision-required="${required}" value="${e(type==='date'?today:values[key]||'')}"></label>`).join('')}</div>${spec.checks?`<fieldset class="process-fields"><legend>Contrôles à confirmer</legend><div class="process-checks">${Object.entries(spec.checks).map(([key,label])=>`<label class="check"><input type="checkbox" name="${key}" data-decision-required="true">${e(label)}</label>`).join('')}</div></fieldset>`:''}</div><label>Compte rendu<textarea name="notes" maxlength="2000" rows="3"></textarea></label><div class="form-error" role="alert"></div><button type="submit" class="primary"><i data-lucide="check-check" aria-hidden="true"></i>Confirmer la décision</button></form>`;
 }
 function mount(a,c){
  const {escape:e,submit,check,db,refreshCase,notify}=c,body=document.getElementById('caseBody');
  const sections=[...body.querySelectorAll('.case-grid > div > section')];
  if(sections.length<6)throw new Error(`Structure du dossier incomplète (${sections.length}/6 sections).`);
  const status=review(a),decision=document.createElement('section');decision.className='card decision-card';
  const panels=[{id:'summary',label:'Informations du candidat',nodes:[sections[0]]},{id:'documents',label:'Documents',nodes:[sections[4]]}];
  const activeAppointments=(c.appointments||[]).filter(p=>['scheduled','confirmed'].includes(p.status));
  const spec=decisionSpec(a),future=activeAppointments.some(p=>kinshasaDay(p.starts_at)>kinshasaDay(new Date()));
  if(status==='accepted')panels.push({id:'appointments',label:spec&&(a.process_step!=='appointment'||activeAppointments.length&&!future)?spec.title:a.process_step==='appointment'?'Rendez-vous':'Parcours terminé',nodes:[sections[3],...(!spec?[sections[1]]:[])]});
  panels.push({id:'history',label:'Notes & journal',nodes:[sections[2],sections[5]]},{id:'decision',label:'Décision GML',nodes:[decision]});
  const nav=document.createElement('div');nav.className='case-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Dossier candidat');
  const container=document.createElement('div');container.className='case-panels';
  panels.forEach(p=>{const panel=document.createElement('section');panel.id='case-panel-'+p.id;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','case-tab-'+p.id);panel.append(...p.nodes);container.append(panel);const b=document.createElement('button');b.type='button';b.id='case-tab-'+p.id;b.dataset.caseTab=p.id;b.textContent=p.label;b.setAttribute('role','tab');b.setAttribute('aria-controls',panel.id);nav.append(b);});
  body.querySelector('.case-grid').replaceWith(nav,container);
  c.selectTab=id=>{c.state.caseTab=id;nav.querySelectorAll('button').forEach(b=>{const on=b.dataset.caseTab===id;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;});[...container.children].forEach(p=>p.hidden=p.id!=='case-panel-'+id);};
  nav.onclick=ev=>{const b=ev.target.closest('[data-case-tab]');if(b)c.selectTab(b.dataset.caseTab);};
  nav.onkeydown=ev=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(ev.key))return;ev.preventDefault();const bs=[...nav.children],i=bs.indexOf(document.activeElement),n=ev.key==='Home'?0:ev.key==='End'?bs.length-1:(i+(ev.key==='ArrowRight'?1:-1)+bs.length)%bs.length;bs[n].click();bs[n].focus();};
  c.selectTab(panels.some(p=>p.id===c.state.caseTab)?c.state.caseTab:'summary');
  decision.innerHTML=`<div class="review-banner"><span class="eyebrow">DÉCISION GML</span><h3>${status==='pending'?'Dossier à examiner':status==='accepted'?'Candidature retenue':'Candidature refusée'}</h3><p>${status==='pending'?'Vérifiez les informations du candidat et ses documents, puis prenez une décision.':status==='accepted'?`Décision enregistrée. ${e(step(a))}`:e(a.review_reason||'Consultez l’historique du dossier.')}</p></div>`;
  if(status==='pending'){
   decision.insertAdjacentHTML('beforeend','<form id="reviewForm" class="review-actions"><label>Décision<select name="review_status"><option value="accepted">Accepter le dossier</option><option value="rejected">Refuser le dossier</option></select></label><label>Motif / observations<textarea name="review_reason" maxlength="2000" placeholder="Motif obligatoire en cas de refus"></textarea></label><p class="muted">L’acceptation ouvre la première étape opérationnelle. Aucun contrat ni échéancier n’est créé à ce stade.</p><div class="form-error" role="alert"></div><button class="primary">Confirmer la décision GML</button></form>');
   submit(document.getElementById('reviewForm'),async f=>{const decisionValue=f.get('review_status'),reason=f.get('review_reason').trim();if(decisionValue==='rejected'&&reason.length<3)throw new Error('Indiquez le motif du refus.');const result=await check(await db.from('applications').update({review_status:decisionValue,review_reason:reason||null}).eq('id',a.id).eq('revision',a.revision).select('id'));if(!result.length)throw new Error('Le dossier a changé. Actualisez-le avant de décider.');c.state.caseTab=decisionValue==='accepted'?'appointments':'decision';await refreshCase(a.id);notify('Décision enregistrée. Le message client est prêt.');});
  }
  const expected=nextPurpose(a);
  const appointment=document.getElementById('appointmentForm');
  if(status==='accepted'&&expected&&!appointment&&!activeAppointments.length)throw new Error('Formulaire de rendez-vous introuvable dans le dossier.');
  if(status==='accepted'){
  sections[3].classList.remove('card');
  sections[3].querySelector('h3')?.remove();
  const steps=Object.keys(flows[a.program_type].steps),index=steps.indexOf(a.process_step);
  sections[3].insertAdjacentHTML('afterbegin',`<div class="case-progress"><span>Étape ${index+1} sur ${steps.length}</span><progress max="${steps.length}" value="${index+1}" aria-label="Avancement du dossier"></progress>${a.lolc_reference?`<span class="muted">Référence de suivi LOLC : ${e(a.lolc_reference)}</span>`:''}</div>`);
  activeAppointments.forEach(p=>{
   const card=sections[3].querySelector(`[data-appointment-card="${CSS.escape(String(p.id))}"]`);if(!card)return;
   const notification=(c.notifications||[]).find(n=>n.appointment_id===p.id&&n.kind==='appointment');
   const smsStatus=notification?.delivery_status||'pending',smsLabels={sent:'SMS envoyé au candidat',pending:'SMS non envoyé',failed:'Échec de l’envoi SMS',not_configured:'Service SMS indisponible',sending:'Envoi SMS en cours / à vérifier',unknown:'Envoi SMS à vérifier'};
   card.insertAdjacentHTML('beforeend',`<div class="appointment-sms-state" data-sms-state="${e(smsStatus)}"><span>${e(smsLabels[smsStatus]||smsLabels.pending)}</span>${['pending','failed','not_configured'].includes(smsStatus)?`<button type="button" class="secondary" data-retry-appointment-sms="${e(p.id)}"><i data-lucide="send" aria-hidden="true"></i>Envoyer le SMS</button>`:''}</div>`);
  });
  body.querySelectorAll('[data-retry-appointment-sms]').forEach(button=>button.onclick=async()=>{
   button.disabled=true;
   try{
    const result=await db.functions.invoke('schedule-appointment',{body:{appointment_id:button.dataset.retryAppointmentSms}});
    if(result.error||!result.data?.success)throw new Error('Envoi interrompu. Réessayez.');
    if(result.data.sms_status==='sent'&&!result.data.sms_error){document.getElementById('caseDialog').close();await c.reload();notify('Rendez-vous fixé. SMS envoyé au candidat.');}
    else{await refreshCase(a.id);notify(result.data.sms_error||'Vérifiez l’état du SMS avant de réessayer.',true);}
   }catch(error){notify(error.message,true);}finally{button.disabled=false;}
  });
  if(spec&&(a.process_step!=='appointment'||activeAppointments.length)){
   sections[3].insertAdjacentHTML('beforeend',decisionForm(a,activeAppointments[0],e));
   const form=document.getElementById('caseStepForm'),positive=Object.keys(spec.choices)[0];
   form.elements.outcome.onchange=()=>{const approved=form.elements.outcome.value===positive;form.querySelector('[data-decision-fields]').hidden=!approved;form.querySelectorAll('[data-decision-required]').forEach(input=>{input.disabled=!approved;input.required=approved&&input.dataset.decisionRequired==='true';});form.elements.notes.required=!!form.elements.outcome.value&&!approved;};
   form.elements.outcome.onchange();
   submit(form,async f=>{
    const result={};for(const [key,value] of f.entries())if(!['outcome','notes'].includes(key))result[key]=form.elements.namedItem(key).type==='checkbox'?true:value;
    const p={application_id:a.id,revision:a.revision,step:a.process_step,appointment_id:activeAppointments[0]?.id||null,outcome:f.get('outcome'),notes:f.get('notes').trim(),result};
    const fingerprint=JSON.stringify(p);if(c.state.decisionRequest?.fingerprint!==fingerprint)c.state.decisionRequest={fingerprint,id:crypto.randomUUID()};
    await check(await db.rpc('record_case_step',{p:{...p,request_id:c.state.decisionRequest.id}}));c.state.decisionRequest=null;c.state.caseTab='appointments';await refreshCase(a.id);notify('Décision enregistrée. Le parcours du dossier est actualisé.');
   });
  }
  const archived=[...sections[3].querySelectorAll('[data-appointment-card]')].filter(card=>!activeAppointments.some(ap=>String(ap.id)===card.dataset.appointmentCard));
  if(archived.length){const history=document.createElement('details');history.className='appointment-archive';history.innerHTML=`<summary>Rendez-vous passés · ${archived.length}</summary>`;history.append(...archived);sections[3].append(history);}
  window.lucide?.createIcons({attrs:{'aria-hidden':'true'}});
  }
  if(a.program_type==='FLEET_OWNER'&&a.process_step==='ready'){
   if(a.preparation?.fleet_joined_on)sections[1].insertAdjacentHTML('beforeend','<p class="section-note">Véhicule intégré. Retrouvez-le dans Flotte & partenaires.</p>');
   else {
    sections[1].insertAdjacentHTML('beforeend',`<form id="ownerFleetForm" class="next-action"><h3>Entrée du véhicule dans la flotte</h3><div class="fields">${[['model','Modèle',a.service_details?.carModel],['plate','Plaque',a.service_details?.carPlate],['vin','Châssis',a.service_details?.carChassis],['tracker_id','Identifiant tracker',''],['fuel_reference','Référence du reçu : 70 USD pour le plein','']].map(([k,l,v])=>`<label>${e(l)}<input name="${k}" required maxlength="200" value="${e(v||'')}"></label>`).join('')}<label>Date de réception des 70 USD<input name="fuel_paid_on" type="date" required></label></div><label class="check"><input type="checkbox" required>Je confirme avoir reçu les 70 USD du propriétaire pour le plein initial.</label><div class="form-error" role="alert"></div><button class="primary">Ajouter le véhicule disponible</button></form>`);
    submit(document.getElementById('ownerFleetForm'),async f=>{await check(await db.rpc('onboard_owner_vehicle',{p:{...Object.fromEntries(f),application_id:a.id,revision:a.revision}}));await refreshCase(a.id);notify('Véhicule disponible dans la flotte. Réception des 70 USD consignée dans le dossier.');});
   }
  }
  body.querySelectorAll('[data-case-contracts]').forEach(b=>b.onclick=()=>{document.getElementById('caseDialog').close();document.querySelector('nav [data-view="contracts"]').click();});
 }
 window.GMFleetWorkflow={flows,purposes,review,step,nextPurpose,decisionSpec,form,mount};
})();
