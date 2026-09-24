/* Shared public model reference data; no stock identifiers or private fleet data. */
(() => {
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fields=[['name','Marque et modèle','car'],['year','Année','calendar'],['engine','Moteur','engine'],['transmission','Transmission','gear'],['fuel','Carburant','fuel'],['seats','Places','person'],['doors','Portes','door'],['steering','Conduite','wheel'],['color','Couleur','color'],['mileage','Kilométrage','road']];
 const paths={car:'M3 15V9l3-5h12l3 5v6M3 10h18M6 15v4M18 15v4M6 13h2M16 13h2',calendar:'M4 5h16v15H4zM4 9h16M8 3v4M16 3v4M8 13h2M14 13h2',engine:'M5 8h12v10H5zM9 5h5M11 5v3M2 10v6M20 10v6M17 13h3',gear:'M7 4v16M17 4v9H7M12 13v7M5 4h4M15 4h4M5 20h4M10 20h4',fuel:'M5 3h10v18H5zM7 5h6v6H7zM15 9h3l2 3v6h-2v-5',person:'M8 7a4 4 0 108 0 4 4 0 10-8 0M5 21v-4a7 7 0 0114 0v4',door:'M5 21V8l6-5h8v18zM7 10h10V5h-5zM14 14h3',wheel:'M3 12a9 9 0 1018 0 9 9 0 10-18 0M3 12h18M12 12v9M8 5l2 4h4l2-4',color:'M12 3s7 8 7 12a7 7 0 01-14 0c0-4 7-12 7-12z',road:'M7 3L3 21M17 3l4 18M12 3v3M12 10v4M12 18v3'};
 const icon=k=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[k]}"></path></svg>`;
 let pending;
 function load(force=false){
  if(pending&&!force)return pending;
  const config=window.GMFLEET_SUPABASE_CONFIG,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  pending=Promise.all([
   fetch('/config/vehicles.json',{cache:'no-store',signal:controller.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}),
   config?.url&&config?.anonKey?fetch(config.url+'/rest/v1/vehicle_model_specs?select=model_key,specs,revision,updated_at',{headers:{apikey:config.anonKey,Authorization:'Bearer '+config.anonKey},cache:'no-store',signal:controller.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}):Promise.reject(Error())
  ]).then(([catalogue,rows])=>{
   if(!Array.isArray(rows)||!Array.isArray(catalogue.models))throw Error();
   return {...catalogue,models:catalogue.models.map(m=>{const row=rows.find(r=>r.model_key===m.key);if(!row||fields.some(([k])=>typeof row.specs?.[k]!=='string'))throw Error();return {...m,...row.specs,revision:row.revision};})};
  }).catch(()=>{pending=null;throw new Error('Les caractéristiques sont momentanément indisponibles. Réessayez.');}).finally(()=>clearTimeout(timer));
  return pending;
 }
 const note=m=>m.mode==='confirmed'?'Caractéristiques confirmées du véhicule proposé. La photo reste représentative du modèle.':'Caractéristiques générales de référence. La photo ne représente pas le véhicule exact remis. Année, couleur et kilométrage seront confirmés selon le véhicule disponible.';
 const rows=m=>fields.map(([key,label,i])=>`<div><dt>${icon(i)}<span>${label}</span></dt><dd>${esc(m[key])}</dd></div>`).join('');
 const section=m=>`<section class="model-specifications" aria-label="Caractéristiques ${esc(m.name)}"><div class="model-spec-heading"><h3>Caractéristiques du véhicule</h3><span>${m.mode==='confirmed'?'Véhicule confirmé':'Modèle de référence'}</span></div><dl class="model-spec-list">${rows(m)}</dl><p class="model-spec-note">${esc(note(m))}</p></section>`;
 window.GMFleetSpecs={load,fields,rows,section,note,esc};
})();
