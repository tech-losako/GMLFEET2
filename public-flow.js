/* Separate service discovery from the application task; preserve existing form nodes. */
(() => {
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const names={'vehicule-credit.html':'Drive to Own','recrutement-chauffeurs.html':'Chauffeur partenaire','agregateur-yango.html':'Partenaire Yango','gestion-flotte.html':'Gestion de flotte'};
 // Rebuild informational content from semantic text, without legacy presentation wrappers.
 window.buildPublicInformation=section=>{
  const content=document.createElement('div');content.className='service-information';
  if(section.id==='app-mockup'){
   content.innerHTML='<p>Avec GML Mobile, suivez votre véhicule et son exploitation depuis votre téléphone.</p><ul class="information-checklist">'+['Localisation et alertes','Revenus, historique et retraits','Maintenance et réparations','Vidéo embarquée'].map(t=>'<li>'+t+'</li>').join('')+'</ul><a class="pub-button" href="#evaluer-form">Demander un accès à GML Mobile ↗</a>';return content;
  }
  let group=content;
  for(const node of section.querySelectorAll('h3,h4,p,li,a')){
   if(node.closest('li')&&node.tagName!=='LI')continue;
   if(node.tagName==='A'&&node.closest('p'))continue;
   if(!node.textContent.trim())continue;
   if(/^H[34]$/.test(node.tagName)){
    if(node.textContent.trim()===section.querySelector('h2,h3')?.textContent.trim())continue;
    group=document.createElement('article');group.className='information-item';const h=document.createElement('h3');h.textContent=node.textContent.trim();group.append(h);content.append(group);
   }else{
    const el=document.createElement(node.tagName==='LI'?'p':node.tagName.toLowerCase());el.textContent=node.textContent.trim();
    if(node.tagName==='LI')el.className='information-condition';
    if(node.tagName==='A'){el.href=node.getAttribute('href');el.className='information-link';}
    group.append(el);
   }
  }
  return content;
 };
 window.isPublicServicePage=path=>Boolean(names[path]);
 window.setupPublicServiceFlow=(path,hero,sections,explorer)=>{
  const app=sections.find(s=>s.querySelector('form'));
  if(!app)return;
  const info=sections.filter(s=>s!==app),landing=document.createElement('div');landing.className='service-story';
  const briefs={
   'vehicule-credit.html':{
    title:'Conduisez aujourd’hui. Devenez propriétaire demain.',intro:'Avec Car na ngai, travaillez au volant de votre véhicule et avancez vers la propriété grâce aux versements prévus dans votre contrat.',
    steps:[['Choisissez et postulez','Sélectionnez votre voiture et transmettez votre dossier.'],['Faites valider votre dossier','GML examine vos documents et vous contacte pour un rendez-vous si votre dossier est retenu. Le financement reste soumis à l’accord du partenaire financier.'],['Prenez le volant','Après validation et acompte, commencez à conduire. À la fin des paiements contractuels, le véhicule vous appartient.']],
    needs:['Permis et pièce d’identité valides.','Pièces d’identité et preuves de résidence du client et du co-emprunteur.','Acompte initial, entretien et accord du partenaire financier.','Respect des règles de sécurité et d’exploitation.'],
    benefits:['Un parcours vers la propriété','Suivi du véhicule et accompagnement','Vous conservez votre surplus après le versement convenu']},
   'recrutement-chauffeurs.html':{
    title:'Devenez chauffeur GML. Construisez la suite.',intro:'Vous avez l’expérience, nous avons les véhicules. Rejoignez notre flotte et ouvrez la voie à votre propre voiture : après 12 mois de bonne performance, vous pouvez accéder en priorité au programme Drive to Own.',
    steps:[['Envoyez votre candidature','Présentez votre expérience et joignez vos documents.'],['Rencontrez notre équipe','Après examen favorable du dossier, GML vous appelle pour organiser un test de conduite et un entretien.'],['Rejoignez la flotte','Si vous êtes approuvé, suivez l’intégration et la formation avant de prendre le volant.']],
    needs:['Permis de conduire valide.','Au minimum 1 an d’expérience de conduite.','Casier judiciaire vierge et bonne moralité.','Bonne connaissance de Kinshasa.'],benefits:['Un véhicule pour travailler','Formation et accompagnement','Une possibilité d’évoluer vers la propriété']},
   'gestion-flotte.html':{
    title:'Votre voiture travaille. Vous restez propriétaire.',intro:'Confiez l’exploitation de votre véhicule à GML et visez jusqu’à 500 USD par mois selon sa catégorie. Nous sélectionnons le chauffeur et suivons l’activité, les équipements et la maintenance.',
    steps:[['Présentez votre véhicule','Envoyez ses informations, ses photos et sa carte rose.'],['Faites-le évaluer','Notre équipe vous contacte pour organiser l’inspection et préciser la catégorie ainsi que les conditions du contrat.'],['Confiez son exploitation','Après inspection favorable, GML installe le tracker et la dashcam. Le plein initial de 70 USD est réglé avant l’entrée du véhicule dans la flotte.']],
    needs:['Votre identité et vos coordonnées.','Carte rose, immatriculation et numéro de châssis.','Assurance, autorisation de transport, vignette et contrôle technique valides.','Véhicule roulant, sans problème mécanique ; photos et inspection préalable.'],benefits:['Chauffeur sélectionné et réseau Yango','GPS, dashcam et suivi opérationnel','Revenus et historique dans GML Mobile']},
   'agregateur-yango.html':{
    title:'Vous roulez sur Yango. Choisissez un partenaire à vos côtés.',intro:'Rejoignez GML avec votre véhicule : accompagnement chauffeur, conditions de retrait selon les offres en vigueur, bonus et promotions. Vous gardez votre voiture et votre activité.',
    steps:[['Présentez-vous à GML','Envoyez vos coordonnées, votre permis et les informations de votre véhicule.'],['Attendez notre validation','GML examine votre candidature et vous contacte. Notre accord est nécessaire avant de changer de partenaire.'],['Choisissez GM Fleet dans Yango','Après validation GML, ouvrez les paramètres de Yango et demandez votre rattachement à GM Fleet. Notre équipe vous accompagne si nécessaire et confirme votre intégration.']],
    needs:['Votre téléphone et vos coordonnées.','Votre permis de conduire.','Les informations de votre véhicule ; sa carte rose si disponible.'],benefits:['Support chauffeur','Bonus et promotions selon les offres','Accompagnement automobile']}
  };
  const brief=briefs[path];hero.querySelector('h1').textContent=brief.title;hero.querySelector('p:not(.pub-eyebrow)').textContent=brief.intro;hero.classList.add('service-brief-hero');
  if(path==='recrutement-chauffeurs.html')hero.querySelector('img').src='/img/fortune-vieyra-o4yi2U-qcf0-unsplash.jpg';
  if(path==='agregateur-yango.html')hero.querySelector('#pub-start').childNodes[0].textContent='Envoyer ma candidature ';
  const icons=['<rect x="9" y="4" width="22" height="32" rx="4"/><path d="M15 11h10M15 17h10M15 23h6M18 31h4"/>','<path d="M11 4h18v7h6v25H5V11h6zM13 23l5 5 10-12"/>','<path d="M5 24l4-12h22l4 12v9H5zM8 24h24M12 29h1M27 29h1M12 12l3-5h10l3 5"/>'];
  landing.innerHTML='<div class="service-benefit-strip">'+brief.benefits.map(t=>'<span>'+esc(t)+'</span>').join('')+'</div><section class="brief-process" id="comment-ca-marche"><div class="brief-heading"><p class="pub-eyebrow">COMMENT ÇA MARCHE</p><h2>Trois étapes pour commencer.</h2></div><ol>'+brief.steps.map(([t,d],i)=>'<li><div class="brief-step-art"><svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">'+icons[i]+'</svg><span>0'+(i+1)+'</span></div><h3>'+esc(t)+'</h3><p>'+esc(d)+'</p></li>').join('')+'</ol></section>';
  if(path==='vehicule-credit.html'){
   const daily=typeof carsData!=='undefined'?carsData.Swift.daily:null;
   if(daily)hero.querySelector('.pub-hero-actions').insertAdjacentHTML('beforebegin','<p class="brief-price">À partir de <strong>'+esc(daily)+'/jour</strong><small>Selon le modèle et le plan choisi. Acompte initial requis ; consultez l’offre du véhicule avant de postuler.</small></p>');
  }
  if(path==='gestion-flotte.html'){
   const source=info[0],returns=document.createElement('section');returns.className='owner-returns';
   returns.innerHTML='<p class="pub-eyebrow">VOS REVENUS CIBLES</p><h2>À chaque véhicule sa catégorie.</h2><div class="return-grid"></div>';
   source.querySelectorAll('h3').forEach(h=>{const old=h.parentElement,card=document.createElement('article');card.className='return-card';const amount=[...old.querySelectorAll('div')].find(d=>d.textContent.trim().startsWith('Jusqu’à'));card.innerHTML='<h3>'+esc(h.textContent)+'</h3><p>'+esc(old.querySelector('p').textContent)+'</p><p class="return-amount">'+amount.innerHTML+'</p>';returns.querySelector('.return-grid').append(card);});
   const note=[...source.querySelectorAll('p')].find(p=>p.textContent.trim().startsWith('*'));if(note)returns.append(note);landing.querySelector('.brief-process').before(returns);
   landing.insertAdjacentHTML('beforeend','<p class="brief-contract">Contrat initial de 12 mois · Frais de gestion : 64 USD/mois la première année. Au renouvellement, la tarification est revue à la baisse si les équipements installés ne doivent pas être rachetés. Pour les réparations : diagnostic, devis et votre accord avant intervention.</p>');
  }
  landing.insertAdjacentHTML('beforeend','<section class="brief-requirements"><h2>À préparer pour votre demande</h2><ul>'+brief.needs.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul></section>');
  info.forEach(s=>s.remove());
  const launch=document.createElement('button');launch.type='button';launch.className='pub-button primary service-apply';launch.textContent=path==='gestion-flotte.html'?'Présenter mon véhicule':path==='agregateur-yango.html'?'Postuler pour rejoindre GML':'Commencer ma candidature';landing.append(launch);
  app.className='application-view';app.removeAttribute('role');app.hidden=true;
  const appHeading=document.createElement('div');appHeading.className='application-heading';appHeading.innerHTML=`<button type="button" class="application-back">← Retour à ${esc(names[path])}</button><p class="pub-eyebrow">${esc(names[path])} / CANDIDATURE</p><h1 tabindex="-1">${path==='gestion-flotte.html'?'Présenter mon véhicule':'Votre candidature'}</h1><p>Complétez chaque étape. Vous pourrez vérifier votre dossier avant l’envoi.</p>`;
  const originalIntro=app.querySelector('h2');if(originalIntro){const intro=originalIntro.parentElement;if(!intro.querySelector('form'))intro.remove();}
  app.prepend(appHeading);explorer.append(landing,app);
  const setView=(apply,focus=false)=>{landing.hidden=apply;hero.hidden=apply;app.hidden=!apply;document.body.classList.toggle('application-active',apply);document.title=apply?'Candidature '+names[path]+' — GM Fleet':names[path]+' — GM Fleet';if(focus){window.scrollTo({top:0,behavior:'instant'});if(apply)appHeading.querySelector('h1').focus({preventScroll:true});else hero.querySelector('h1').focus({preventScroll:true});}};
  hero.querySelector('h1').tabIndex=-1;
  const apply=()=>{if(location.hash!=='#candidature')history.pushState({application:true},'', '#candidature');setView(true,true);};
  hero.querySelector('#pub-start').onclick=apply;launch.onclick=apply;
  appHeading.querySelector('button').onclick=()=>{history.pushState({},'',location.pathname+location.search);setView(false,true);};
  const sync=()=>{const applying=['#candidature','#postuler','#rejoindre-form','#evaluer-form'].includes(location.hash);setView(applying,applying);if(!applying&&location.hash){const target=document.getElementById(location.hash.slice(1));if(target&&landing.contains(target)){const disclosure=target.closest('details');if(disclosure)disclosure.open=true;target.scrollIntoView({block:'start'});}}};window.addEventListener('popstate',sync);window.addEventListener('hashchange',sync);sync();
  if(path==='vehicule-credit.html')setupVehicleChoice(app);
 };
 function setupVehicleChoice(app){
  const form=document.getElementById('applicationForm'),select=document.getElementById('generalVehicleSelect'),features=document.getElementById('modalCarFeatures'),picture=document.getElementById('modalCarImg'),title=document.getElementById('modalCarTitle');
  const wrapper=document.getElementById('applicationWrapper');
  const choice=document.createElement('div');choice.className='vehicle-choice';choice.innerHTML='<div class="application-stage"><span>01</span><div><h2>Choisissez votre véhicule</h2><p>Étape 1 sur 5 · Sélectionnez un modèle pour consulter son offre.</p></div></div><div class="vehicle-options" role="group" aria-label="Véhicule souhaité">'+[['Swift','Suzuki Swift','swift-official.png'],['IST','Toyota IST','ist-official.png'],['Blade','Toyota Blade','blade-official.png'],['Vitz','Toyota Vitz','vitz 1.jpg']].map(([key,name,img])=>`<button type="button" data-vehicle="${key}" aria-pressed="false"><img src="/img/${img}" alt=""><span>${name}<b aria-hidden="true">✓</b></span></button>`).join('')+'</div>';
  const selection=document.createElement('div');selection.className='vehicle-selection';selection.hidden=true;picture.className='selected-car-photo';title.className='selected-car-title';selection.append(picture,title,features);choice.append(selection);
  const nativeLabel=document.createElement('label');nativeLabel.hidden=true;nativeLabel.textContent='Véhicule souhaité';nativeLabel.append(select);choice.append(nativeLabel);
  const next=document.createElement('button');next.type='button';next.className='pub-button primary vehicle-next';next.textContent='Continuer avec ce véhicule →';next.disabled=true;choice.append(next);
  const details=document.createElement('div');details.className='application-details';details.hidden=true;
  const change=document.createElement('button');change.type='button';change.className='application-back';change.textContent='← Changer de véhicule';details.append(change,wrapper);
  [...wrapper.children].filter(e=>e!==form).forEach(e=>e.remove());wrapper.className='application-form-wrap';
  const selectedSummary=document.createElement('p');selectedSummary.className='application-car-summary';wrapper.before(selectedSummary);
  const rest=[...app.children].filter(e=>!e.classList.contains('application-heading'));rest.forEach(e=>e.remove());app.append(choice,details);
  const update=()=>{const key=select.value;selection.hidden=!key;next.disabled=!key;choice.querySelectorAll('[data-vehicle]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.vehicle===key)));selectedSummary.textContent=key?'Véhicule choisi : '+title.textContent:'';};
  choice.addEventListener('click',e=>{const button=e.target.closest('[data-vehicle]');if(!button)return;select.value=button.dataset.vehicle;select.dispatchEvent(new Event('change',{bubbles:true}));});select.addEventListener('change',update);
  next.onclick=()=>{if(!select.value)return;choice.hidden=true;details.hidden=false;form.querySelector('h3')?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});};
  change.onclick=()=>{details.hidden=true;choice.hidden=false;choice.querySelector('[aria-pressed=true]')?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});};const requested=new URLSearchParams(location.search).get('car');if([...select.options].some(o=>o.value===requested)&&requested){select.value=requested;select.dispatchEvent(new Event('change',{bubbles:true}));}update();
 }
})();
