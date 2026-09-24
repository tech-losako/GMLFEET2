/* Browse and compare vehicle information before choosing an application path. */
(() => {
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fields=[['brand','Marque'],['body','Carrosserie'],['year','Année'],['engine','Motorisation'],['transmission','Boîte de vitesses'],['seats','Places']];
 window.setupVehicleCatalogue=(hero,sections,main)=>{
  hero.classList.add('directory-intro','catalogue-intro');hero.querySelector('.pub-hero-image').remove();hero.querySelector('.pub-hero-actions').remove();
  hero.querySelector('h1').textContent='Le bon modèle commence par le bon choix.';
  hero.querySelector('p:not(.pub-eyebrow)').textContent='Explorez les véhicules et comparez leurs fiches pour préparer votre choix.';
  sections.forEach(s=>s.remove());
  main.innerHTML='<div class="catalogue-toolbar"><p>Choisissez jusqu’à deux modèles à comparer.</p><button class="pub-button" id="compare-vehicles" disabled>Comparer · 0 / 2</button></div><section class="vehicle-catalogue specs-catalogue" aria-label="Catalogue des véhicules"><p>Chargement des fiches…</p></section><p class="catalogue-note"></p>';
  const grid=main.querySelector('.vehicle-catalogue'),compare=main.querySelector('#compare-vehicles'),selected=new Set();
  const dialog=document.createElement('dialog');dialog.className='vehicle-sheet';dialog.setAttribute('aria-labelledby','vehicle-sheet-title');document.body.append(dialog);
  let models=[],note='';
  const value=(m,key)=>m[key]===null||m[key]===undefined?'À confirmer':esc(m[key]);
  const close=()=>{dialog.close();const url=new URL(location.href);url.searchParams.delete('car');url.searchParams.delete('compare');history.replaceState({},'',url);};
  dialog.addEventListener('cancel',ev=>{ev.preventDefault();close();});
  const launch=(keys,writeHistory=true)=>{
   const cars=keys.map(k=>models.find(m=>m.key===k)).filter(Boolean);if(!cars.length)return;
   const comparing=cars.length===2;
   dialog.innerHTML=`<div class="vehicle-sheet-top"><span class="pub-eyebrow">${comparing?'COMPARAISON':'FICHE VÉHICULE'}</span><button type="button" class="sheet-close" aria-label="Fermer la fiche">×</button></div><h2 id="vehicle-sheet-title" tabindex="-1">${comparing?'Deux modèles, un choix éclairé.':esc(cars[0].name)}</h2><div class="sheet-models ${comparing?'is-comparison':''}">${cars.map(m=>`<article><img src="${esc(m.image)}" alt="${esc(m.name)}"><div class="sheet-model-copy">${comparing?`<h3>${esc(m.name)}</h3>`:''}<p>${esc(m.profile)}</p><dl>${fields.map(([key,label])=>`<div><dt>${label}</dt><dd class="${m[key]==null?'unconfirmed':''}">${value(m,key)}</dd></div>`).join('')}</dl><a class="pub-button primary" href="/vehicule-credit.html?car=${encodeURIComponent(m.key)}#candidature">Choisir ce modèle pour Car na ngai ↗</a><a class="sheet-question" href="/apropos.html?service=${encodeURIComponent('Fiche technique — '+m.name)}#contact">Vérifier les caractéristiques avec GML →</a></div></article>`).join('')}</div><p class="sheet-note">${esc(note)}</p>`;
   dialog.querySelector('.sheet-close').onclick=close;
   if(writeHistory){const url=new URL(location.href);url.searchParams.delete('car');url.searchParams.delete('compare');url.searchParams.set(comparing?'compare':'car',keys.join(','));history.pushState({},'',url);}
   if(!dialog.open)dialog.showModal();dialog.querySelector('h2').focus({preventScroll:true});dialog.scrollTop=0;
  };
  const sync=()=>{const q=new URLSearchParams(location.search),keys=(q.get('compare')||q.get('car')||'').split(',').slice(0,2);if(keys[0])launch(keys,false);else dialog.close();};
  window.addEventListener('popstate',sync);
  fetch('/config/vehicles.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{
   if(!Array.isArray(data.models)||data.models.length===0||data.models.some(m=>!['Swift','IST','Blade','Vitz'].includes(m.key)||!m.name||!String(m.image).startsWith('/img/')))throw Error();
   models=data.models;note=data.note;
   grid.innerHTML=models.map(m=>`<article class="spec-car"><a class="spec-car-photo" href="/vehicules.html?car=${encodeURIComponent(m.key)}" data-car-sheet="${esc(m.key)}"><img src="${esc(m.image)}" alt="${esc(m.name)}" loading="eager"></a><div class="spec-car-copy"><p class="pub-eyebrow">${esc(m.brand)} · ${esc(m.body)}</p><h2><a href="/vehicules.html?car=${encodeURIComponent(m.key)}" data-car-sheet="${esc(m.key)}">${esc(m.name)}</a></h2><p>${esc(m.description)}</p><div class="spec-car-actions"><a href="/vehicules.html?car=${encodeURIComponent(m.key)}" data-car-sheet="${esc(m.key)}">Voir la fiche ↗</a><label><input type="checkbox" data-compare-car="${esc(m.key)}"> Comparer</label></div></div></article>`).join('');
   main.querySelector('.catalogue-note').textContent=note;
   grid.onclick=ev=>{const a=ev.target.closest('[data-car-sheet]');if(a&&!ev.ctrlKey&&!ev.metaKey&&!ev.shiftKey){ev.preventDefault();launch([a.dataset.carSheet]);}};
   grid.onchange=ev=>{const input=ev.target.closest('[data-compare-car]');if(!input)return;if(input.checked)selected.add(input.dataset.compareCar);else selected.delete(input.dataset.compareCar);grid.querySelectorAll('[data-compare-car]').forEach(el=>el.disabled=selected.size===2&&!selected.has(el.dataset.compareCar));compare.disabled=selected.size!==2;compare.textContent='Comparer · '+selected.size+' / 2';};
   compare.onclick=()=>launch([...selected]);sync();
  }).catch(()=>{grid.innerHTML='<div class="catalogue-unavailable"><h2>Les fiches ne sont pas disponibles pour le moment.</h2><p>Notre équipe peut vous renseigner sur les modèles proposés.</p><a class="pub-button" href="/apropos.html?service=Catalogue%20véhicules#contact">Contacter GML →</a></div>';});
  return true;
 };
})();
