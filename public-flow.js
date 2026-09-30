/* Separate service discovery from the application task; preserve existing form nodes. */
(() => {
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const names={'vehicule-credit.html':'Car na ngai','recrutement-chauffeurs.html':'Chauffeur partenaire','agregateur-yango.html':'Partenaire Yango','gestion-flotte.html':'Gestion de flotte'};
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
    needs:['Pièce d’identité valide.','Nationalité congolaise.','Justificatif de domicile.','Preuve d’expérience sur Yango.'],
    benefitEyebrow:'L’ACCOMPAGNEMENT CAR NA NGAI',benefitTitle:'Bien plus qu’un véhicule.',benefitIntro:'Des services pensés pour protéger votre activité, votre voiture et votre tranquillité.',
    benefits:[
     ['<rect x="6" y="8" width="28" height="25" rx="3"/><path d="M12 4v8M28 4v8M6 15h28M13 21h5M22 21h5M13 27h5"/>','Jusqu’à 4 entretiens par an','Des contrôles planifiés pour préserver les performances du véhicule et limiter les immobilisations.'],
     ['<path d="M23 7a8 8 0 01-10 10L5 25l10 10 8-8a8 8 0 0010-10l-6 6-6-6z"/>','Réparations facilitées','En cas de panne, nos centres mécaniques facilitent le diagnostic et la remise en route.'],
     ['<path d="M20 36s11-10 11-20a11 11 0 10-22 0c0 10 11 20 11 20z"/><circle cx="20" cy="16" r="4"/>','Géolocalisation 24 h/24','Votre véhicule neuf reste localisable en continu pour accélérer les recherches en cas de vol.'],
     ['<rect x="8" y="8" width="24" height="24" rx="4"/><path d="M14 20h12M20 14v12M12 4v4M20 4v4M28 4v4M12 32v4M20 32v4M28 32v4M4 12h4M4 20h4M4 28h4M32 12h4M32 20h4M32 28h4"/>','IA de prévention des pannes','Des alertes intelligentes détectent les signes d’anomalie pour intervenir avant l’immobilisation.']
    ],
    readiness:{eyebrow:'VOTRE DOSSIER',title:'Prêt à postuler ?',intro:'Les éléments essentiels pour faire examiner votre demande.',image:'/img/swift-official-v2.png',alt:'Suzuki Swift proposée dans le programme Car na ngai',caption:'Votre dossier en un coup d’œil'}},
   'recrutement-chauffeurs.html':{
    title:'Devenez chauffeur GML. Construisez la suite.',intro:'Vous savez conduire et souhaitez travailler avec un véhicule GML ? Présentez votre permis et votre expérience, puis passez notre test de conduite.',
    steps:[['Envoyez votre candidature','Présentez votre permis de conduire et votre expérience au volant.'],['Passez le test','Après présélection, GML organise un test de conduite et un entretien.'],['Rejoignez la flotte','Après validation et intégration, un véhicule vous est affecté pour commencer votre activité.']],
    needs:['Permis de conduire valide.','Expérience de conduite vérifiable.'],
    benefitEyebrow:'LES AVANTAGES CHAUFFEUR',benefitTitle:'Travaillez aujourd’hui. Préparez votre voiture.',benefitIntro:'Votre régularité et le soin apporté au véhicule peuvent ouvrir la voie à Car na ngai.',
    benefits:[
     ['<path d="M8 19h24v14H8zM12 19l3-8h10l3 8M13 27h1M26 27h1"/>','Un véhicule pour travailler','Après validation, GML vous affecte un véhicule et vous accompagne dans votre activité sur Yango.'],
     ['<path d="M7 20a13 13 0 1026 0A13 13 0 107 20zM20 11v9l6 4"/>','Votre 6e jour vous revient','Après cinq jours d’activité pour la flotte, les revenus du sixième jour vous reviennent selon le planning convenu.'],
     ['<path d="M7 29l9-9 6 6 11-14M27 12h6v6"/>','Jusqu’à 40 % pour votre apport','Après 12 mois de bonne performance, GML peut soutenir jusqu’à 40 % de l’apport d’une Toyota Vitz Car na ngai. Conduite, état du véhicule et versements quotidiens sont pris en compte.']
    ],
    readiness:{eyebrow:'POUR COMMENCER',title:'Deux éléments essentiels.',intro:'Le test de conduite intervient après l’examen de votre candidature.',image:'/img/fortune-vieyra-o4yi2U-qcf0-unsplash.jpg',alt:'Chauffeur partenaire devant un véhicule',caption:'Votre profil en un coup d’œil',photo:true}},
   'gestion-flotte.html':{
    title:'Votre voiture travaille. Vous restez propriétaire.',intro:'Pendant toute la durée du contrat, GM Fleet prend en charge le chauffeur, l’exploitation Yango et le suivi technique. Vous gardez la visibilité sur votre véhicule et vos règlements.',
    steps:[['Présentez votre véhicule','Envoyez ses informations, ses photos et ses documents de transport.'],['Inspection et classement','Nous vérifions son état, sa conformité et sa catégorie avant de vous présenter les conditions du contrat.'],['Mise en exploitation','Après validation, GML installe le tracker et la Dashcam, affecte un chauffeur et intègre le véhicule à la flotte Yango.']],
    needs:['Véhicule en bon état mécanique.','Carte rose et documents de transport valides (assurance, autorisation de transport, contrôle technique et vignette).','Mise en circulation depuis 5 ans maximum.'],
    benefitEyebrow:'LA GESTION GM FLEET',benefitTitle:'Votre véhicule reste visible et productif.',benefitIntro:'Nous gérons l’exploitation quotidienne pendant que vous gardez le contrôle à distance.',
    benefits:[
     ['<rect x="6" y="10" width="28" height="21" rx="3"/><circle cx="20" cy="20" r="5"/><path d="M11 10l3-4h12l3 4"/>','Un regard à distance','La Dashcam documente les événements disponibles pour vous aider à suivre l’usage de votre véhicule.'],
     ['<path d="M20 36s11-10 11-20a11 11 0 10-22 0c0 10 11 20 11 20z"/><circle cx="20" cy="16" r="4"/>','Localisation en temps réel','Le tracker GML permet de localiser le véhicule et de consulter son activité à distance.'],
     ['<rect x="7" y="12" width="26" height="20" rx="3"/><path d="M14 12V8h12v4M7 20h26M17 20v3h6v-3"/>','Gestion sans tracas','Chauffeur, Yango et suivi opérationnel : GM Fleet coordonne le quotidien pendant votre contrat.'],
     ['<path d="M23 7a8 8 0 01-10 10L5 25l10 10 8-8a8 8 0 0010-10l-6 6-6-6z"/>','Priorité à la disponibilité','Contrôles du dimanche et réparations coordonnées rapidement. Après étude, une avance approuvée peut faciliter la remise en activité.']
    ],
    readiness:{eyebrow:'STANDARD DE LA FLOTTE',title:'Votre véhicule est-il prêt ?',intro:'Ces critères sont vérifiés lors de l’inspection GM Fleet.',image:'/img/blade-official-v2.png',alt:'Toyota Blade sur fond blanc',caption:'Éligibilité du véhicule'}},
   'agregateur-yango.html':{
    title:'Vous roulez sur Yango. Choisissez un partenaire à vos côtés.',intro:'Avec votre voiture et votre permis, rejoignez GM Fleet et profitez d’avantages liés à votre activité.',
    steps:[['Envoyez votre demande','Transmettez votre permis et les informations essentielles de votre véhicule.'],['GML vous inscrit','Après validation, notre équipe enregistre votre profil comme chauffeur partenaire.'],['Choisissez GM Fleet dans Yango','Lorsque GM Fleet apparaît dans votre application Yango, sélectionnez-nous pour finaliser votre rattachement.']],
    needs:['Un véhicule en état de circuler.','Un permis de conduire valide.'],
    benefitEyebrow:'LES AVANTAGES PARTENAIRE',benefitTitle:'Plus vous roulez, plus vous profitez.',benefitIntro:'Des avantages utiles pour votre carburant, votre entretien et vos équipements.',
    benefits:[
     ['<path d="M9 35V8h17v27M12 13h11v8H12zM26 15h4l3 5v11a3 3 0 01-6 0v-4"/>','Carburant selon vos objectifs','Des recharges sont accordées dans nos stations partenaires lorsque les objectifs fixés par GML sont atteints.'],
     ['<path d="M23 7a8 8 0 01-10 10L5 25l10 10 8-8a8 8 0 0010-10l-6 6-6-6z"/>','Services et réparations réduits','Après plus de trois mois d’activité avec GML, vous accédez à des réductions sur des services et réparations éligibles.'],
     ['<rect x="7" y="10" width="26" height="21" rx="3"/><circle cx="20" cy="20" r="5"/><path d="M11 10l3-4h12l3 4M20 31v5"/>','Tracker et Dashcam à prix réduit','Profitez de tarifs préférentiels si vous souhaitez équiper votre véhicule avec les solutions GML.']
    ],
    readiness:{eyebrow:'POUR VOUS INSCRIRE',title:'Deux conditions seulement.',intro:'Notre équipe vous accompagne ensuite jusqu’au rattachement dans Yango.',image:'/img/ist-official.png',alt:'Toyota IST sur fond blanc',caption:'Votre inscription en un coup d’œil'}}
  };
  const brief=briefs[path];hero.querySelector('h1').textContent=brief.title;hero.querySelector('p:not(.pub-eyebrow)').textContent=brief.intro;hero.classList.add('service-brief-hero');
  if(path==='recrutement-chauffeurs.html')hero.querySelector('img').src='/img/fortune-vieyra-o4yi2U-qcf0-unsplash.jpg';
  if(path==='agregateur-yango.html')hero.querySelector('#pub-start').childNodes[0].textContent='Envoyer ma candidature ';
  const icons=['<rect x="9" y="4" width="22" height="32" rx="4"/><path d="M15 11h10M15 17h10M15 23h6M18 31h4"/>','<path d="M11 4h18v7h6v25H5V11h6zM13 23l5 5 10-12"/>','<path d="M5 24l4-12h22l4 12v9H5zM8 24h24M12 29h1M27 29h1M12 12l3-5h10l3 5"/>'];
  const benefitLead='<section class="service-benefits"><div class="brief-heading"><p class="pub-eyebrow">'+esc(brief.benefitEyebrow)+'</p><h2>'+esc(brief.benefitTitle)+'</h2><p>'+esc(brief.benefitIntro)+'</p></div><div class="service-benefit-grid">'+brief.benefits.map(([icon,title,description])=>'<article><span class="service-benefit-icon"><svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icon+'</svg></span><h3>'+esc(title)+'</h3><p>'+esc(description)+'</p></article>').join('')+'</div></section>';
  landing.innerHTML=benefitLead+'<section class="brief-process" id="comment-ca-marche"><div class="brief-heading"><p class="pub-eyebrow">COMMENT ÇA MARCHE</p><h2>Trois étapes pour commencer.</h2></div><ol>'+brief.steps.map(([t,d],i)=>'<li><div class="brief-step-art"><svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">'+icons[i]+'</svg><span>0'+(i+1)+'</span></div><h3>'+esc(t)+'</h3><p>'+esc(d)+'</p></li>').join('')+'</ol></section>';
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
  const readiness=brief.readiness;
  landing.insertAdjacentHTML('beforeend','<section class="service-readiness"><div class="service-readiness-media'+(readiness.photo?' is-photo':'')+'"><img src="'+esc(readiness.image)+'" alt="'+esc(readiness.alt)+'" loading="lazy"><p><strong>'+esc(names[path])+'</strong><span>'+esc(readiness.caption)+'</span></p></div><div class="service-readiness-copy"><p class="pub-eyebrow">'+esc(readiness.eyebrow)+'</p><h2>'+esc(readiness.title)+'</h2><p>'+esc(readiness.intro)+'</p><ul class="service-requirement-list">'+brief.needs.map(t=>'<li><span class="requirement-check" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12l4 4 10-10"/></svg></span><span>'+esc(t)+'</span></li>').join('')+'</ul></div></section>');
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
  const choice=document.createElement('div');choice.className='vehicle-choice';choice.innerHTML='<div class="application-stage"><span>01</span><div><h2>Choisissez votre véhicule</h2><p>Étape 1 sur 5 · Sélectionnez un modèle pour consulter son offre.</p></div></div><div class="vehicle-options" role="group" aria-label="Véhicule souhaité">'+[['Swift','Suzuki Swift','swift-official-v2.png'],['IST','Toyota IST','ist-official.png'],['Blade','Toyota Blade','blade-official-v2.png'],['Vitz','Toyota Vitz','vitz-official-v2.png']].map(([key,name,img])=>`<button type="button" data-vehicle="${key}" aria-pressed="false"><img src="/img/${img}" alt=""><span>${name}<b aria-hidden="true">✓</b></span></button>`).join('')+'</div>';
  const selection=document.createElement('div');selection.className='vehicle-selection';selection.hidden=true;picture.className='selected-car-photo';title.className='selected-car-title';selection.append(picture,title,features);choice.append(selection);
  const nativeLabel=document.createElement('label');nativeLabel.hidden=true;nativeLabel.textContent='Véhicule souhaité';nativeLabel.append(select);choice.append(nativeLabel);
  const next=document.createElement('button');next.type='button';next.className='pub-button primary vehicle-next';next.textContent='Choisir ce modèle →';next.disabled=true;choice.append(next);
  const details=document.createElement('div');details.className='application-details';details.hidden=true;
  const change=document.createElement('button');change.type='button';change.className='application-back';change.textContent='← Changer de véhicule';details.append(change,wrapper);
  [...wrapper.children].filter(e=>e!==form).forEach(e=>e.remove());wrapper.className='application-form-wrap';
  const selectedSummary=document.createElement('p');selectedSummary.className='application-car-summary';wrapper.before(selectedSummary);
  const rest=[...app.children].filter(e=>!e.classList.contains('application-heading'));rest.forEach(e=>e.remove());app.append(choice,details);
  const specsHost=document.createElement('div');specsHost.className='model-spec-loading';selection.append(specsHost);let specToken=0;
  const showSpecs=async key=>{const token=++specToken;if(!key){specsHost.innerHTML='';return;}specsHost.innerHTML='<p>Chargement des caractéristiques du modèle…</p>';try{const catalogue=await window.GMFleetSpecs.load();if(token!==specToken)return;const model=catalogue.models.find(m=>m.key===key);if(!model)throw Error('Fiche indisponible');title.textContent=model.name;specsHost.className='model-spec-host';specsHost.innerHTML=window.GMFleetSpecs.section(model);selectedSummary.textContent='Véhicule choisi : '+model.name;}catch{if(token!==specToken)return;specsHost.className='model-spec-loading';specsHost.innerHTML='<p>Les caractéristiques sont momentanément indisponibles.</p><button type="button">Réessayer</button>';specsHost.querySelector('button').onclick=()=>showSpecs(key);}};
  const update=()=>{const key=select.value;showSpecs(key);selection.hidden=!key;next.disabled=!key;choice.querySelectorAll('[data-vehicle]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.vehicle===key)));selectedSummary.textContent=key?'Véhicule choisi : '+title.textContent:'';};
  choice.addEventListener('click',e=>{const button=e.target.closest('[data-vehicle]');if(!button)return;select.value=button.dataset.vehicle;select.dispatchEvent(new Event('change',{bubbles:true}));});select.addEventListener('change',update);
  next.onclick=()=>{if(!select.value)return;choice.hidden=true;details.hidden=false;form.querySelector('h3')?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});};
  change.onclick=()=>{details.hidden=true;choice.hidden=false;choice.querySelector('[aria-pressed=true]')?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});};const requested=new URLSearchParams(location.search).get('car');if([...select.options].some(o=>o.value===requested)&&requested){select.value=requested;select.dispatchEvent(new Event('change',{bubbles:true}));}update();
 }
})();
