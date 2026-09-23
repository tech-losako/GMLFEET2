/* Focused public entry points: choose a service, then see its own details. */
(() => {
window.setupPublicDirectory=(path,hero,sections,main)=>{
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
  const equipment=[...sections.flatMap(s=>[...s.querySelectorAll('.equipment-card')])];const views=[];
  equipment.forEach((card,i)=>{const view=document.createElement('section');view.className='equipment-detail';view.id=i?'dashcam':'gps';view.hidden=true;view.innerHTML='<a class="application-back" href="services.html">← Tous les services</a>';card.classList.add('equipment-selected');card.querySelector('details').open=true;const title=card.querySelector('h3'),h=document.createElement('h1');h.textContent=title.textContent;title.replaceWith(h);const quote=card.querySelector('.pub-button');quote.href='/apropos.html?service='+encodeURIComponent(h.textContent)+'#contact';view.append(card);view.insertAdjacentHTML('beforeend','<div class="equipment-next"><h2>Comment en équiper votre véhicule ?</h2><ol><li><strong>01 · Parlez-nous de votre besoin</strong><p>Précisez votre véhicule et l’équipement souhaité dans votre demande de devis.</p></li><li><strong>02 · Recevez votre proposition</strong><p>Notre équipe précise l’installation et la formule de suivi adaptées.</p></li><li><strong>03 · Convenez d’un rendez-vous</strong><p>Après accord sur le devis, nous organisons l’installation avec vous.</p></li></ol></div>');main.append(view);views.push(view);});
  const sync=()=>{const selected=views.find(v=>'#'+v.id===location.hash);directory.hidden=!!selected;hero.hidden=!!selected;views.forEach(v=>v.hidden=v!==selected);if(selected){window.scrollTo(0,0);selected.querySelector('h1').tabIndex=-1;selected.querySelector('h1').focus({preventScroll:true});}};window.addEventListener('hashchange',sync);sync();
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
