/* Public content layouts. Financial terms remain sourced from the original offer cards. */
(() => {
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const journeys = [
    {title:'Je cherche un véhicule', description:'Conduisez et avancez vers la propriété avec Drive to Own.', image:'swift-official.png', url:'vehicule-credit.html', label:'Acquérir un véhicule'},
    {title:'Je souhaite conduire', description:'Mettez votre expérience au volant d’un véhicule de notre flotte.', image:'fortune-vieyra-o4yi2U-qcf0-unsplash.jpg', url:'recrutement-chauffeurs.html', label:'Devenir chauffeur partenaire'},
    {title:'Je possède une voiture', description:'Confiez son exploitation à une équipe qui assure le suivi.', image:'blade-official.png', url:'gestion-flotte.html', label:'Confier ma voiture'},
    {title:'Je suis déjà sur Yango', description:'Gardez votre voiture et rejoignez notre réseau partenaire.', image:'ist-official.png', url:'agregateur-yango.html', label:'Rejoindre le réseau'},
    {title:'Je veux localiser mon véhicule',description:'Équipez votre voiture d’un traceur GPS et découvrez nos solutions de suivi.',image:'gml-tracker.png',url:'services.html#gps',label:'Découvrir le traceur GPS'},
    {title:'Je veux une caméra de bord',description:'Découvrez la caméra V7 Pro et son installation sur votre véhicule.',image:'v7-pro-dashcam.jpg',url:'services.html#dashcam',label:'Découvrir la dashcam'}
  ];
  window.publicProfileCards = () => '<div class="visual-paths">'+journeys.map((j,i)=>`<a class="visual-path" href="/${j.url}"><div class="visual-path-photo"><img src="/img/${j.image}" alt="" loading="lazy"><span>0${i+1}</span></div><div class="visual-path-copy"><h3>${j.title}</h3><p>${j.description}</p><span class="visual-link">${j.label} <b aria-hidden="true">↗</b></span></div></a>`).join('')+'</div>';
  const heading = (eyebrow,title,description='') => `<div class="editorial-heading"><p class="pub-eyebrow">${eyebrow}</p><h2>${title}</h2>${description?`<p>${description}</p>`:''}</div>`;
  const split = (image,alt,content) => `<div class="editorial-split"><img class="editorial-photo" src="/img/${image}" alt="${alt}" loading="lazy"><div>${content}</div></div>`;
  const link = (href,text) => `<a class="pub-button primary" href="${href}">${text} <span aria-hidden="true">↗</span></a>`;
  window.refreshPublicPanels = page => {
    const sections = [...document.querySelectorAll('body>section')];
    if(page==='index.html') {
      sections.slice(1).forEach(s=>s.className='editorial-panel');
      sections[1].innerHTML=heading('DRIVE TO OWN','De la candidature aux clés de votre voiture.','Découvrez les trois étapes de votre parcours.')+`<div class="journey-steps">${[
        ['01','Postulez','Choisissez votre modèle et envoyez votre candidature. Notre équipe vérifie votre profil.'],
        ['02','Prenez le volant','Après validation et remise des clés, vous commencez à conduire et à générer des revenus.'],
        ['03','Devenez propriétaire','Effectuez vos versements réguliers. À la fin du terme de paiement, la voiture vous appartient.']
      ].map(([n,t,d])=>`<article><span class="step-number">${n}</span><h3>${t}</h3><p>${d}</p></article>`).join('')}</div><div class="editorial-action">${link('/vehicule-credit.html','Découvrir le parcours')}</div>`;
      sections[2].innerHTML=heading('NOS SERVICES','Une solution pour votre situation.','Acquérir, conduire, confier ou rejoindre notre réseau : choisissez votre point de départ.')+window.publicProfileCards();
      sections[3].innerHTML=heading('LES VÉHICULES','Votre prochain outil de travail.','Explorez les modèles et retrouvez leurs offres dans la fiche de chaque véhicule.')+`<div class="mini-fleet">${[['Swift','Suzuki Swift','swift-official.png'],['Blade','Toyota Blade','blade-official.png'],['IST','Toyota IST','ist-official.png']].map(([key,name,image])=>`<a href="/detail-vehicule.html?car=${key}"><img src="/img/${image}" alt="${name}" loading="lazy"><div><h3>${name}</h3><span>Voir le véhicule ↗</span></div></a>`).join('')}</div><div class="editorial-action">${link('/vehicules.html','Voir toute la flotte')}</div>`;
      sections[4].innerHTML=split('fortune-vieyra-o4yi2U-qcf0-unsplash.jpg','Un chauffeur au volant',heading('UNE MARQUE DE GEORGE MICHAEL LOGISTICS','Le travail d’aujourd’hui. La propriété de demain.','GM Fleet accompagne les chauffeurs au Congo avec « Car na ngai » : conduisez et devenez propriétaire.')+'<ul class="editorial-list"><li><strong>Véhicules vérifiés</strong><span>Des voitures robustes, prêtes à travailler.</span></li><li><strong>Sans dépôt bloquant</strong><span>Un système de crédit qui permet de payer en travaillant.</span></li><li><strong>Un objectif concret</strong><span>À la fin du terme de paiement, le véhicule vous appartient légalement.</span></li></ul>'+link('/apropos.html','Découvrir GML'));
      sections[5].classList.add('text-white');
      sections[5].innerHTML='<div class="vision-story"><img src="/img/gml-official.jpeg" alt="George Michael Logistics"><div>'+heading('NOTRE VISION','Chaque chauffeur, un entrepreneur.')+'<p>Redéfinir la mobilité en Afrique en donnant aux chauffeurs les moyens de devenir indépendants et propriétaires de leur outil de travail.</p><span>GM Fleet · Une marque de George Michael Logistics</span></div></div>';
    }
    if(page==='services.html') {
      const router=sections[1];router.className='editorial-panel';
      router.innerHTML=heading('VOTRE PARCOURS','Quel est votre point de départ ?','Sélectionnez votre situation pour découvrir le service qui vous correspond.')+'<div class="profile-guide"><div class="profile-options" role="group" aria-label="Votre situation">'+journeys.map((j,i)=>`<button type="button" data-journey="${i}" aria-pressed="${i===0}"><span>0${i+1}</span>${j.title}<b aria-hidden="true">↗</b></button>`).join('')+'</div><div class="profile-result" aria-live="polite"></div></div>';
      const result=router.querySelector('.profile-result');
      const choose=i=>{const j=journeys[i];router.querySelectorAll('[data-journey]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.journey)===i)));result.innerHTML=`<img src="/img/${j.image}" alt=""><div><p class="pub-eyebrow">VOTRE SOLUTION GM FLEET</p><h3>${j.label}</h3><p>${j.description}</p>${link('/'+j.url,'Découvrir cette solution')}</div>`;};
      router.addEventListener('click',e=>{const button=e.target.closest('[data-journey]');if(button)choose(Number(button.dataset.journey));});choose(0);
      // Preserve every original offer paragraph, benefit and commercial term.
      const offers=[...sections[2].querySelectorAll('[data-aos="zoom-in"]')].map((card,i)=>{
        const title=card.querySelector('h3').textContent;
        const paragraphs=[...card.querySelectorAll(':scope>p')].map(p=>'<p>'+p.innerHTML+'</p>').join('');
        const benefits=[...card.querySelectorAll('li span')];
        const highlights=benefits.filter(li=>/USD|\$|%/.test(li.textContent)).map(li=>'<p class="offer-highlight">'+li.innerHTML+'</p>').join('');
        const items=benefits.filter(li=>!/USD|\$|%/.test(li.textContent)).map(li=>'<li>'+li.innerHTML+'</li>').join('');
        const a=card.querySelector('a'),image=['swift-official.png','ist-official.png','blade-official.png','fortune-vieyra-o4yi2U-qcf0-unsplash.jpg'][i];
        return `<article class="offer-card"><img src="/img/${image}" alt="" loading="lazy"><div><h3>${escape(title)}</h3>${paragraphs}${highlights}<details><summary>Les points clés</summary><ul>${items}</ul></details>${link(a.getAttribute('href'),a.textContent.trim())}</div></article>`;
      });
      sections[2].className='editorial-panel';sections[2].innerHTML=heading('NOS OFFRES','Quatre façons d’avancer avec GM Fleet.','Consultez les points clés de chaque programme, puis découvrez ses conditions.')+'<div class="offer-grid">'+offers.join('')+'</div>';
      const equipment=[...sections[3].querySelectorAll('[data-aos="zoom-in"]')].map((card,i)=>{
        const title=card.querySelector('h3').textContent,description=card.querySelector(':scope>p').innerHTML;
        const items=[...card.querySelectorAll('li span')].map(li=>'<li>'+li.innerHTML+'</li>').join('');
        const pricing=card.querySelector('div.backdrop-blur');
        return `<article class="equipment-card"><div class="equipment-photo"><img src="/img/${i?'v7-pro-dashcam.jpg':'gml-tracker.png'}" alt="${i?'Caméra de bord V7 Pro utilisée par GML':'Traceur GPS utilisé par GML'}" loading="lazy"><span>${i?'VIDÉO & SÉCURITÉ':'LOCALISATION & SUIVI'}</span></div><div class="equipment-copy"><h3>${escape(i?"Caméra de bord V7 Pro":title)}</h3><p>${description}</p><details><summary>Fonctionnalités et installation</summary><ul>${items}</ul></details><div class="equipment-price">${pricing?pricing.innerHTML:''}</div>${link('/apropos.html#contact','Demander un devis')}</div></article>`;
      });
      sections[3].className='editorial-panel';sections[3].innerHTML=heading('ÉQUIPEMENTS & TECHNOLOGIE','Gardez un œil sur ce qui compte.','Vente, installation professionnelle et abonnement de suivi, pour les véhicules de notre flotte comme pour les autres.')+'<div class="equipment-switch" role="group" aria-label="Type d’équipement"><button type="button" data-equipment="0" aria-pressed="true">Traceur GPS</button><button type="button" data-equipment="1" aria-pressed="false">Caméra de bord</button></div><div class="equipment-grid">'+equipment.join('')+'</div><p class="equipment-caption">Équipements utilisés par GML. Installation et formule de suivi précisées dans votre devis.</p>';
      const equipmentCards=[...sections[3].querySelectorAll('.equipment-card')];equipmentCards[0].classList.add('equipment-selected');
      sections[3].addEventListener('click',e=>{const button=e.target.closest('[data-equipment]');if(!button)return;const index=Number(button.dataset.equipment);equipmentCards.forEach((card,i)=>card.classList.toggle('equipment-selected',i===index));sections[3].querySelectorAll('[data-equipment]').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));});
    }
  };
})();
