/* Focused public entry points: choose a service, then see its own details. */
(() => {
window.setupPublicDirectory=(path,hero,sections,main)=>{
 if(path==='vehicules.html'){
  hero.classList.add('directory-intro');hero.querySelector('.pub-hero-image').remove();hero.querySelector('.pub-hero-actions').remove();
  const source=sections.find(s=>s.id==='vehicules'),grid=document.createElement('section');grid.className='vehicle-catalogue';grid.id='vehicules';grid.setAttribute('aria-label','Nos véhicules');
  source.querySelectorAll('[onclick]').forEach(old=>{const title=old.querySelector('h3'),img=old.querySelector('img');if(!title||!img)return;const key=title.textContent.trim(),a=document.createElement('a');a.className='catalogue-car';a.href='/vehicule-credit.html?car='+encodeURIComponent(key)+'#candidature';const photo=img.cloneNode();photo.className='';photo.loading='eager';const copy=document.createElement('div'),h=document.createElement('h2'),p=document.createElement('p'),cta=document.createElement('span');h.textContent=img.alt;p.textContent=old.querySelector('p').textContent.trim();cta.textContent='Découvrir ce véhicule ↗';copy.append(h,p,cta);a.append(photo,copy);grid.append(a);});main.append(grid);
  const guide=document.createElement('div');guide.className='catalogue-guide';guide.innerHTML='<div><h2>Un modèle vous intéresse ?</h2><p>Consultez sa fiche et son offre, puis préparez votre candidature en quelques étapes.</p></div><a class="pub-button" href="/vehicule-credit.html">Comprendre le parcours ↗</a>';main.append(guide);
  sections.forEach(s=>s.remove());return true;
 }
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
 hero.classList.add('directory-intro');hero.querySelector('h1').textContent=path==='index.html'?'Quel est votre projet ?':'Nos services, votre prochain pas.';hero.querySelector('p:not(.pub-eyebrow)').textContent='Choisissez un service pour découvrir ses avantages, ses conditions et les étapes pour commencer.';hero.querySelector('.pub-hero-image').remove();hero.querySelector('.pub-hero-actions').remove();
 const directory=document.createElement('section');directory.className='service-directory';directory.id='services';directory.setAttribute('aria-label','Choisissez votre service');directory.innerHTML=window.publicProfileCards();main.append(directory);
 if(path==='services.html'){
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
