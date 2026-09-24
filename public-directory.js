/* Focused public entry points: choose a service, then see its own details. */
(() => {
window.setupPublicDirectory=(path,hero,sections,main)=>{
 if(path==='vehicules.html')return window.setupVehicleCatalogue(hero,sections,main);
 if(!['index.html','services.html','apropos.html'].includes(path))return false;
 if(path==='apropos.html'){
  hero.hidden=true;
  const source=sections.find(s=>s.querySelector('#contactForm')),form=source.querySelector('form');
  const contact=document.createElement('section');contact.id='contact';contact.className='contact-studio';
  contact.innerHTML='<div class="contact-intro"><p class="pub-eyebrow">PARLONS DE VOTRE PROJET</p><h1>Une question ?<br>Une équipe à votre écoute.</h1><p>Un véhicule, une candidature ou un équipement : contactez notre équipe à Kinshasa.</p><dl><div><dt>Appelez-nous</dt><dd><a href="tel:+243851686846">+243 851 686 846 ↗</a></dd></div><div><dt>Retrouvez-nous</dt><dd>01, Ngongo Lutete<br>Kinshasa, Gombe</dd></div><div><dt>Écrivez-nous</dt><dd><a href="mailto:info@georgemichaellogistics.cd">info@georgemichaellogistics.cd ↗</a></dd></div></dl></div><div class="contact-compose"><p class="pub-eyebrow">VOTRE MESSAGE</p><h2>Comment pouvons-nous vous aider ?</h2></div>';
  form.className='contact-form';form.querySelectorAll('input,textarea').forEach(f=>{f.className='';f.parentElement.className='contact-field';});
  const fields=[...form.querySelectorAll('.contact-field')];form.replaceChildren(...fields,...form.querySelectorAll('[type=submit]'));contact.querySelector('.contact-compose').append(form);main.append(contact);
  const subject=new URLSearchParams(location.search).get('service');if(subject)form.querySelector('#contactSujet').value='Demande de devis — '+subject;
  for(const section of sections.filter(s=>s!==source)){const detail=document.createElement('details');detail.className='service-disclosure about-disclosure';const summary=document.createElement('summary');summary.textContent=section.querySelector('h2')?.textContent.trim()||'Découvrir GML';const content=document.createElement('div');content.className='service-disclosure-content';content.append(...section.childNodes);detail.append(summary,content);main.append(detail);}
  sections.forEach(s=>s.remove());return true;
 }
 if(path==='index.html'){
  hero.classList.add('home-welcome');hero.querySelector('.pub-eyebrow').textContent='GM FLEET · GEORGE MICHAEL LOGISTICS';
  hero.querySelector('h1').textContent='À Kinshasa, votre ambition prend la route.';
  hero.querySelector('p:not(.pub-eyebrow)').textContent='Chauffeur ou propriétaire, avancez avec une équipe qui connaît votre quotidien. Un véhicule, une activité, un projet : nous vous aidons à trouver votre place.';
  const image=hero.querySelector('.pub-hero-image');image.src='/img/blade-official.png';image.alt='Toyota Blade proposée par GM Fleet';
  hero.querySelector('#pub-start').innerHTML='Trouver mon parcours <span aria-hidden="true">↘</span>';
  const second=hero.querySelector('.pub-hero-actions a');second.href='/vehicules.html';second.textContent='Explorer les véhicules';
  main.innerHTML='<section class="home-directions" id="mon-parcours"><div><p class="pub-eyebrow">VOTRE POINT DE DÉPART</p><h2>Et vous, où voulez-vous aller ?</h2><p>Choisissez votre situation. Les conditions et les étapes vous attendent dans votre parcours.</p></div><div class="home-intents"><a href="/vehicule-credit.html">Devenir propriétaire <span>↗</span></a><a href="/recrutement-chauffeurs.html">Conduire pour GML <span>↗</span></a><a href="/gestion-flotte.html">Confier ma voiture <span>↗</span></a><a href="/agregateur-yango.html">Rejoindre GML sur Yango <span>↗</span></a><a href="/services.html#equipements">Équiper mon véhicule <span>↗</span></a><a href="/services.html">Comprendre nos offres <span>→</span></a></div></section><div class="home-local"><span>Une équipe locale · Kinshasa, Gombe</span><a href="/apropos.html#contact">Parlons de votre projet →</a><a href="/payer.html">Déjà chauffeur GML ? Mon espace →</a></div>';
  hero.querySelector('#pub-start').onclick=()=>main.querySelector('.home-directions').scrollIntoView({behavior:'smooth',block:'start'});
 }else{
  hero.classList.add('directory-intro');hero.querySelector('h1').textContent='Des solutions concrètes pour avancer.';hero.querySelector('p:not(.pub-eyebrow)').textContent='Découvrez ce que chaque offre vous apporte, à qui elle s’adresse et comment la rejoindre.';hero.querySelector('.pub-hero-image').remove();hero.querySelector('.pub-hero-actions').remove();
  const offers=[
   ['POUR ACQUÉRIR UN VÉHICULE','Car na ngai · Drive to Own','Un parcours de conduite vers la propriété.','swift-official.png','vehicule-credit.html',['Choix du modèle et du plan','Dossier et validation LOLC'],'Voir le parcours'],
   ['POUR TRAVAILLER AU VOLANT','Chauffeur GML','Rejoignez notre équipe et conduisez un véhicule de la flotte.','fortune-vieyra-o4yi2U-qcf0-unsplash.jpg','recrutement-chauffeurs.html',['Candidature, entretien et test','Affectation après validation'],'Découvrir le métier'],
   ['POUR LES PROPRIÉTAIRES','Gestion de votre véhicule','Confiez son exploitation à GML et gardez la propriété.','blade-official.png','gestion-flotte.html',['Inspection et équipements','Suivi et revenus par catégorie'],'Découvrir la gestion'],
   ['POUR LES CHAUFFEURS YANGO','Partenaire Yango','Votre voiture, votre activité, avec l’accompagnement GML.','ist-official.png','agregateur-yango.html',['Examen préalable de votre dossier','Rattachement après accord GML'],'Rejoindre le réseau'],
   ['POUR PROTÉGER UN VÉHICULE','Tracker GPS & dashcam','Choisissez le suivi GPS, la vidéo embarquée ou les deux.','gml-tracker.png','services.html#equipements',['Matériel, installation et abonnement','Tarifs selon votre véhicule'],'Choisir l’équipement']
  ];
  const directory=document.createElement('section');directory.className='service-directory';directory.id='services';directory.setAttribute('aria-label','Les offres GM Fleet');directory.innerHTML='<div class="service-offers">'+offers.map(([audience,title,description,img,url,features,cta],i)=>`<article class="service-offer ${i===4?'is-equipment':''}"><img src="/img/${img}" alt="" loading="lazy"><div><p class="offer-audience">${audience}</p><h2>${title}</h2><p>${description}</p></div><ul>${features.map(t=>'<li>'+t+'</li>').join('')}</ul><a class="pub-button" href="/${url}">${cta} ↗</a></article>`).join('')+'</div>';main.append(directory);
  const view=window.createEquipmentService();main.append(view);
  const sync=()=>{const active=['#equipements','#gps','#dashcam'].includes(location.hash);directory.hidden=active;hero.hidden=active;view.hidden=!active;if(active){view.selectProduct(location.hash.slice(1));window.scrollTo(0,0);}};window.addEventListener('hashchange',sync);sync();
 }
 sections.forEach(s=>s.remove());return true;
};
window.modernizePublicConfirmations=()=>{
 document.querySelectorAll('#successModalOverlay,#serviceSuccessModalOverlay').forEach((modal,i)=>{
 const car=modal.querySelector('#successCarName'),service=modal.querySelector('#successServiceName');modal.className='submission-overlay hidden';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','submission-title-'+i);
 modal.innerHTML='<div class="submission-card"><span class="submission-status">✓ DOSSIER TRANSMIS</span><h2 id="submission-title-'+i+'" tabindex="-1">Merci pour votre candidature.</h2><p>Nous allons examiner vos documents. Si votre dossier est approuvé, nous vous appellerons pour fixer un rendez-vous.</p><div class="submission-next"><span>La prochaine étape</span><strong>Gardez votre téléphone à portée de main.</strong><p>Notre équipe vous contactera au numéro indiqué dans votre dossier.</p></div><a class="pub-button primary" href="/index.html">Retour à l’accueil ↗</a></div>';
 if(car){car.hidden=true;modal.append(car);}if(service){service.hidden=true;modal.append(service);}
 new MutationObserver(()=>{if(!modal.classList.contains('hidden'))modal.querySelector('h2').focus();}).observe(modal,{attributes:true,attributeFilter:['class']});
 modal.addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();modal.querySelector('a').focus();}});
 });
};
})();
