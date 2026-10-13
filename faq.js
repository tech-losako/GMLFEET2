(() => {
 'use strict';
 const search=document.getElementById('faq-search'),category=document.getElementById('faq-category'),sections=[...document.querySelectorAll('[data-topic]')];
 const normalize=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const refresh=()=>{
  const words=normalize(search.value.trim()).split(/\s+/).filter(Boolean);let count=0;
  for(const section of sections){let visible=0;for(const question of section.querySelectorAll('details')){const matches=(!category.value||category.value===section.dataset.topic)&&words.every(word=>normalize(question.textContent).includes(word));question.hidden=!matches;if(matches)visible++;}section.hidden=visible===0;count+=visible;}
  document.getElementById('faq-count').textContent=count+' réponse'+(count===1?'':'s');document.getElementById('faq-empty').hidden=count!==0;
 };
 document.querySelector('.faq-filters').hidden=false;document.querySelector('.faq-filters').onsubmit=e=>e.preventDefault();search.oninput=refresh;category.onchange=refresh;
 document.getElementById('faq-reset').onclick=()=>{search.value='';category.value='';refresh();search.focus();};
 const reveal=()=>{const target=document.getElementById(location.hash.slice(1));if(target?.tagName==='DETAILS'){search.value='';category.value='';refresh();target.open=true;target.scrollIntoView({block:'start'});}};
 window.addEventListener('hashchange',reveal);refresh();reveal();window.lucide?.createIcons();
})();
