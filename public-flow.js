/* Separate service discovery from the application task; preserve existing form nodes. */
(() => {
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const names={'vehicule-credit.html':'Drive to Own','recrutement-chauffeurs.html':'Chauffeur partenaire','agregateur-yango.html':'Partenaire Yango','gestion-flotte.html':'Gestion de flotte'};
 window.isPublicServicePage=path=>Boolean(names[path]);
 window.setupPublicServiceFlow=(path,hero,sections,explorer)=>{
  const app=sections.find(s=>s.querySelector('form'));
  if(!app)return;
  const info=sections.filter(s=>s!==app),landing=document.createElement('div');landing.className='service-story';
  if(path==='vehicule-credit.html'){
   const benefits=[...info[1].querySelectorAll('h3')].map(h=>[h.textContent.trim(),h.parentElement.querySelector('p')?.textContent.trim()||'']);
   landing.innerHTML='<div class="service-value"><div><p class="pub-eyebrow">VOTRE ACTIVITÉ, ACCOMPAGNÉE</p><h2>Plus qu’un véhicule.<br>Un parcours vers la propriété.</h2><p>Vous conduisez avec un cadre clair et une équipe à vos côtés.</p></div><dl>'+benefits.map(([t,d],i)=>`<div><dt><span>0${i+1}</span>${esc(t)}</dt><dd>${esc(d)}</dd></div>`).join('')+'</dl></div>';
   const steps=[...info[0].querySelectorAll('h3')].map(h=>`<li><strong>${esc(h.textContent.trim())}</strong><p>${esc(h.parentElement.querySelector('p')?.textContent.trim()||'')}</p></li>`).join('');
   const conditions=[...info[2].querySelectorAll('li')].map(li=>'<li>'+li.querySelector('span').innerHTML+'</li>').join('');
   landing.insertAdjacentHTML('beforeend','<div class="service-disclosures"><details id="comment-ca-marche" class="service-disclosure"><summary><span>Le parcours d’acquisition<small>De votre demande à l’exploitation du véhicule</small></span></summary><ol class="service-timeline">'+steps+'</ol></details><details class="service-disclosure"><summary><span>Conditions et documents<small>Les critères à vérifier avant de postuler</small></span></summary><ul class="service-requirements">'+conditions+'</ul></details></div>');
  }else{
   landing.innerHTML='<div class="service-intro"><p class="pub-eyebrow">AVANT DE COMMENCER</p><h2>Les réponses pour avancer.</h2><p>Consultez les informations utiles, puis préparez votre dossier.</p></div>';
   for(const section of info){const d=document.createElement('details');d.className='service-disclosure';if(section.id)d.id=section.id;const title=section.querySelector('h2')?.textContent.trim()||'En savoir plus';const summary=document.createElement('summary');summary.textContent=title;const content=document.createElement('div');content.className='service-disclosure-content';content.append(...section.childNodes);d.append(summary,content);landing.append(d);}
  }
  info.forEach(s=>s.remove());
  const launch=document.createElement('button');launch.type='button';launch.className='pub-button primary service-apply';launch.textContent=path==='gestion-flotte.html'?'Présenter mon véhicule':'Commencer ma candidature';landing.append(launch);
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
  change.onclick=()=>{details.hidden=true;choice.hidden=false;choice.querySelector('[aria-pressed=true]')?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});};update();
 }
})();
