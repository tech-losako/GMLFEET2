/* Standalone equipment offers are loaded from editable commercial data, never invented. */
(() => {
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=n=>new Intl.NumberFormat('fr-FR',{minimumFractionDigits:Number.isInteger(n)?0:2,maximumFractionDigits:2}).format(n)+' USD';
 window.createEquipmentService=()=>{
  const view=document.createElement('section');view.className='equipment-service';view.id='equipements';view.hidden=true;
  view.innerHTML='<a class="application-back" href="/services.html">← Tous les services</a><p class="pub-eyebrow">ÉQUIPEMENTS & SÉCURITÉ</p><h1>Choisissez ce que vous souhaitez installer.</h1><div class="equipment-choices" role="group" aria-label="Équipement à installer"><button type="button" data-product="gps" aria-pressed="true"><img src="/img/gml-tracker.png" alt=""><span>Tracker GPS<small>Localisation & suivi</small></span></button><button type="button" data-product="dashcam" aria-pressed="false"><img src="/img/v7-pro-dashcam.jpg" alt=""><span>Dashcam V7 Pro<small>Vidéo embarquée</small></span></button></div><div class="equipment-offer" aria-live="polite"><p>Chargement des tarifs…</p></div>';
  let config,product=location.hash==='#dashcam'?'dashcam':'gps';const offer=view.querySelector('.equipment-offer');
  const render=()=>{
   view.querySelectorAll('[data-product]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.product===product)));
   if(!config)return;
   const p=config[product],from=p.fromMonthly;
   const benefits=product==='gps'?[
    ['Position & trajets','Localisation en temps réel, historique des itinéraires et kilométrage.'],
    ['Alertes & sécurité','Vitesse, zones de sécurité, conduite brusque, mouvement anormal ou déconnexion du traceur, selon équipement.'],
    ['Carburant & batterie','Niveau, consommation, ravitaillements et baisses suspectes avec capteur adapté ; tension de batterie si disponible.'],
    ['Diagnostic & entretien','Données moteur et anomalies sur véhicules compatibles. Anticipation assistée par IA selon les données et l’intégration disponibles.'],
    ['Immobilisation à distance','Avec dispositif de coupure compatible et procédure d’arrêt sécurisée, après vérification de l’installation.']
   ]:[
    ['Vidéo & preuves','Vue à distance de la route et de l’habitacle, enregistrements disponibles et images utiles en cas d’incident.'],
    ['Vigilance du conducteur','Détection de fatigue, distraction, téléphone et absence de ceinture, selon les fonctions activées.'],
    ['Assistance à la conduite','Alertes de collision, franchissement de ligne et distance insuffisante avec fonctions ADAS compatibles.'],
    ['Alertes & échanges','Notifications photo ou vidéo, avertissements vocaux et communication audio avec le conducteur, selon configuration.'],
    ['GPS & caméras en option','Position du véhicule et possibilité d’ajouter une caméra arrière, extérieure ou grand-angle compatible.']
   ];
   const qualification=product==='gps'?'Les fonctions avancées sont confirmées avant installation : coupure moteur et capteur carburant compatibles, données mécaniques accessibles et intégration logicielle pour l’IA. Elles ne sont pas toutes incluses ou actives sur chaque véhicule.':'Les fonctions vidéo, IA, ADAS et audio dépendent des caméras installées, de la configuration et de la connectivité. Les options et fonctions actives sont précisées dans votre offre.';
   const symbols=product==='gps'?['<path d="M12 22s7-7 7-13a7 7 0 0 0-14 0c0 6 7 13 7 13Z"/><circle cx="12" cy="9" r="2"/>','<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z"/><path d="m8 12 3 3 5-6"/>','<path d="M8 3h8v18H4V9h4Z"/><path d="M16 8h3l2 3v7h-3v-5h-2M8 7h5"/>','<path d="M14 4a6 6 0 0 0-7 8l-5 5 5 5 5-5a6 6 0 0 0 8-7l-4 4-4-4Z"/>','<rect x="5" y="10" width="14" height="12" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v4"/>']:['<rect x="2" y="6" width="14" height="13" rx="2"/><path d="m16 10 6-3v11l-6-3"/>','<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>','<path d="M5 22 9 2M19 22 15 2M12 4v3m0 4v3m0 4v3"/>','<path d="M4 3h16v13H9l-5 5Z"/><path d="M8 7h8M8 11h5"/>','<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4"/>'];
   offer.innerHTML='<div class="equipment-promise"><div><p class="pub-eyebrow">'+esc(p.title)+'</p><h2>'+esc(p.headline)+'</h2>'+('<p class="equipment-start">À partir de '+money(from)+'/mois.</p>')+'<p class="equipment-fit">Installation sur tout type de véhicule.</p><p>'+esc(p.subscriptionNote)+'</p></div><img src="/img/'+(product==='gps'?'gml-tracker.png':'v7-pro-dashcam.jpg')+'" alt="'+esc(p.title)+' utilisé par GML"></div><section class="equipment-benefits"><h3>Ce que vous pouvez suivre</h3><ul>'+benefits.map(([title,copy],i)=>'<li><span class="equipment-benefit-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+symbols[i]+'</svg></span><strong>'+esc(title)+'</strong><p>'+esc(copy)+'</p></li>').join('')+'</ul><p class="equipment-qualification">'+esc(qualification)+'</p></section><aside class="equipment-mobile"><div><p class="pub-eyebrow">APRÈS L’INSTALLATION</p><h3>Votre véhicule dans GML Mobile.</h3><p>Téléchargez GML Mobile sur Google Play pour accéder au suivi de votre véhicule et aux fonctions activées sur votre équipement.</p></div><a class="pub-button" href="https://play.google.com/store/apps/details?id=com.gmlmobile.myapp" target="_blank" rel="noopener noreferrer">Télécharger sur Google Play ↗</a></aside>';
   view.querySelector('.equipment-request-bar strong').textContent=p.title+' · dès '+money(from)+'/mois';
  };
  const bar=document.createElement('div');bar.className='equipment-request-bar';bar.innerHTML='<strong></strong><button type="button" class="pub-button primary">Demander mon installation ↗</button>';view.append(bar);bar.querySelector('button').onclick=()=>window.openEquipmentQuote(product);
  view.addEventListener('click',e=>{const b=e.target.closest('[data-product]');if(b){product=b.dataset.product;history.replaceState({},'', '#'+product);render();}});
  view.selectProduct=key=>{product=key==='dashcam'?'dashcam':'gps';render();};
  fetch('/config/commercial.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Tarifs indisponibles');return r.json();}).then(data=>{
   for(const key of ['gps','dashcam'])if(!Number.isFinite(data[key]?.fromMonthly)||data[key].fromMonthly<0)throw Error('Tarif indisponible');
   for(const key of ['gps','dashcam'])for(const type of ['car','jeep','truck']){const o=data[key]?.offers?.[type];if(!o||!['hardware','installation','monthly'].every(k=>o[k]===null||(Number.isFinite(o[k])&&o[k]>=0)))throw Error('Tarifs invalides');}
   config=data;render();
  }).catch(()=>{offer.innerHTML='<p>Les tarifs ne sont pas disponibles pour le moment. Notre équipe peut vous transmettre un devis.</p><a class="pub-button" href="/apropos.html?service=Équipements#contact">Contacter GML ↗</a>';});
  return view;
 };
})();
