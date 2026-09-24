/* Standalone equipment offers are loaded from editable commercial data, never invented. */
(() => {
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=n=>new Intl.NumberFormat('fr-FR',{minimumFractionDigits:Number.isInteger(n)?0:2,maximumFractionDigits:2}).format(n)+' USD';
 window.createEquipmentService=()=>{
  const view=document.createElement('section');view.className='equipment-service';view.id='equipements';view.hidden=true;
  view.innerHTML='<a class="application-back" href="/services.html">← Tous les services</a><p class="pub-eyebrow">ÉQUIPEMENTS & SÉCURITÉ</p><h1>Choisissez ce que vous souhaitez installer.</h1><div class="equipment-choices" role="group" aria-label="Équipement à installer"><button type="button" data-product="gps" aria-pressed="true"><img src="/img/gml-tracker.png" alt=""><span>Tracker GPS<small>Localisation & suivi</small></span></button><button type="button" data-product="dashcam" aria-pressed="false"><img src="/img/v7-pro-dashcam.jpg" alt=""><span>Dashcam V7 Pro<small>Vidéo embarquée</small></span></button></div><div class="equipment-offer" aria-live="polite"><p>Chargement des tarifs…</p></div>';
  let config,product=location.hash==='#dashcam'?'dashcam':'gps',vehicle='car';const offer=view.querySelector('.equipment-offer');
  const render=()=>{
   view.querySelectorAll('[data-product]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.product===product)));
   if(!config)return;
   const p=config[product],o=p.offers[vehicle],known=Object.values(p.offers).filter(v=>typeof v.monthly==='number'),from=Math.min(...known.map(v=>v.monthly));
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
   offer.innerHTML='<div class="equipment-promise"><div><p class="pub-eyebrow">'+esc(p.title)+'</p><h2>'+esc(p.headline)+'</h2>'+(product==='gps'?'<p class="equipment-start">À partir de '+money(from)+'/mois.</p>':'')+'<p>'+esc(p.subscriptionNote)+'</p></div><img src="/img/'+(product==='gps'?'gml-tracker.png':'v7-pro-dashcam.jpg')+'" alt="'+esc(p.title)+' utilisé par GML"></div><section class="equipment-benefits"><h3>Ce que vous pouvez suivre</h3><ul>'+benefits.map(([title,copy])=>'<li><strong>'+esc(title)+'</strong><p>'+esc(copy)+'</p></li>').join('')+'</ul><p class="equipment-qualification">'+esc(qualification)+'</p></section><div class="equipment-pricing"><div class="equipment-price-heading"><h3>Votre véhicule, votre tarif</h3><label>Type de véhicule<select id="equipment-vehicle">'+Object.entries(p.offers).map(([key,v])=>'<option value="'+key+'" '+(key===vehicle?'selected':'')+'>'+esc(v.label)+'</option>').join('')+'</select></label></div><div class="equipment-costs"><div><span>Matériel · paiement initial</span><strong>'+ (o.hardware===null?'Sur devis':money(o.hardware))+'</strong></div><div><span>Installation · paiement initial</span><strong>'+(o.installation===null?'Sur devis':money(o.installation))+'</strong></div><div><span>Abonnement · chaque mois</span><strong>'+(o.monthly===null?'Sur devis':money(o.monthly)+'<small>/mois</small>')+'</strong></div></div>'+(o.hardware!==null&&o.installation!==null?'<p class="equipment-initial">Frais initiaux : <strong>'+money(o.hardware+o.installation)+'</strong> (matériel + installation), hors abonnement.</p>':'')+(o.note?'<p>'+esc(o.note)+'</p>':'')+(product==='gps'?'<div class="equipment-rate-list" aria-label="Tarifs GPS par véhicule">'+Object.values(p.offers).map(v=>'<p><strong>'+esc(v.label)+' :</strong> matériel '+money(v.hardware)+' + installation '+money(v.installation)+' + abonnement '+money(v.monthly)+'/mois.</p>').join('')+'</div>':'')+'<p class="equipment-terms">'+esc(p.terms)+'</p><a class="pub-button primary" href="/apropos.html?service='+encodeURIComponent(p.title+' — '+o.label)+'#contact">Demander mon installation ↗</a></div><aside class="equipment-mobile"><div><p class="pub-eyebrow">APRÈS L’INSTALLATION</p><h3>Votre véhicule dans GML Mobile.</h3><p>Téléchargez GML Mobile sur Google Play pour accéder au suivi de votre véhicule et aux fonctions activées sur votre équipement.</p></div><a class="pub-button" href="https://play.google.com/store/apps/details?id=com.gmlmobile.myapp" target="_blank" rel="noopener noreferrer">Télécharger sur Google Play ↗</a></aside>';
   offer.querySelector('select').onchange=e=>{vehicle=e.target.value;render();offer.querySelector('select').focus({preventScroll:true});};
  };
  view.addEventListener('click',e=>{const b=e.target.closest('[data-product]');if(b){product=b.dataset.product;history.replaceState({},'', '#'+product);render();}});
  view.selectProduct=key=>{product=key==='dashcam'?'dashcam':'gps';render();};
  fetch('/config/commercial.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Tarifs indisponibles');return r.json();}).then(data=>{
   for(const key of ['gps','dashcam'])for(const type of ['car','jeep','truck']){const o=data[key]?.offers?.[type];if(!o||!['hardware','installation','monthly'].every(k=>o[k]===null||(Number.isFinite(o[k])&&o[k]>=0)))throw Error('Tarifs invalides');}
   config=data;render();
  }).catch(()=>{offer.innerHTML='<p>Les tarifs ne sont pas disponibles pour le moment. Notre équipe peut vous transmettre un devis.</p><a class="pub-button" href="/apropos.html?service=Équipements#contact">Contacter GML ↗</a>';});
  return view;
 };
})();
