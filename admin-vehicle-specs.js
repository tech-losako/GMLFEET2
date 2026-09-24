(() => {
 'use strict';
 let selected='Swift',generation=0;
 async function render(ctx){
  const token=++generation,{db,escape:e,user,staff,notify}=ctx,content=document.getElementById('content');
  const active=()=>token===generation&&ctx.isCurrent();
  if(!staff.some(s=>s.user_id===user.id&&s.active&&['admin','super_admin'].includes(s.role))){content.innerHTML='<p class="section-note">La modification des fiches est réservée aux administrateurs.</p>';return;}
  content.innerHTML='<p>Chargement des caractéristiques…</p>';
  try{
   const {data,error}=await db.from('vehicle_model_specs').select('*').order('model_key');if(error)throw error;if(!active())return;
   const row=data.find(r=>r.model_key===selected)||data[0];if(!row)throw Error('Aucune fiche disponible.');selected=row.model_key;const spec=row.specs;
   content.innerHTML=`<p class="section-note">Ces fiches alimentent le catalogue et le choix du véhicule dans Car na ngai. Les tarifs et les contrats ne sont pas modifiés ici. La photo reste représentative du modèle.</p><div class="program-tabs" aria-label="Modèle à modifier">${data.map(r=>`<button data-model-spec="${e(r.model_key)}" class="${r===row?'active':''}" aria-pressed="${r===row}">${e(r.specs.name)}</button>`).join('')}</div><div class="spec-editor-layout"><section class="card"><h2>${e(spec.name)}</h2><form id="modelSpecsForm"><label>Informations affichées<select name="mode"><option value="general" ${spec.mode==='general'?'selected':''}>Caractéristiques générales du modèle</option><option value="confirmed" ${spec.mode==='confirmed'?'selected':''}>Véhicule disponible confirmé</option></select></label><p class="muted">Utilisez « confirmé » uniquement après vérification du véhicule effectivement proposé. Ne saisissez aucun numéro de châssis ni référence fournisseur.</p><div class="fields">${window.GMFleetSpecs.fields.filter(([k])=>k!=='name').map(([k,label])=>`<label>${e(label)}<input name="${k}" required maxlength="120" value="${e(spec[k])}" ${k==='year'?'placeholder="? ou année confirmée"':''} ${k==='mileage'?'placeholder="Ex. 85000 km"':''}></label>`).join('')}</div><div class="form-error" role="alert"></div><button class="primary" type="submit">Publier les caractéristiques</button><p class="muted">La publication est visible immédiatement sur les prochaines consultations du site.</p></form></section><section class="card spec-editor-preview"><p class="eyebrow">APERÇU CLIENT</p><div id="modelSpecPreview"></div></section></div>`;
   const form=document.getElementById('modelSpecsForm'),preview=document.getElementById('modelSpecPreview');
   const values=()=>({...spec,...Object.fromEntries(new FormData(form))});
   const refresh=()=>{const general=form.elements.mode.value==='general';for(const [k,fallback] of [['year','?'],['color','Selon disponibilité'],['mileage','Selon le véhicule']]){form.elements[k].readOnly=general;if(general)form.elements[k].value=fallback;}preview.innerHTML=window.GMFleetSpecs.section(values());};
   form.addEventListener('input',refresh);form.addEventListener('change',refresh);refresh();
   content.querySelectorAll('[data-model-spec]').forEach(b=>b.onclick=()=>{if(form.dataset.dirty==='true'&&!window.confirm('Quitter cette fiche sans publier les modifications ?'))return;selected=b.dataset.modelSpec;render(ctx);});
   form.addEventListener('input',()=>form.dataset.dirty='true');
   form.onsubmit=async ev=>{ev.preventDefault();const button=form.querySelector('button[type=submit]'),errorBox=form.querySelector('.form-error');button.disabled=true;errorBox.textContent='';try{const result=await db.from('vehicle_model_specs').update({specs:values()}).eq('model_key',row.model_key).eq('revision',row.revision).select('model_key');if(result.error)throw result.error;if(!result.data?.length)throw Error('Cette fiche a changé depuis son ouverture. Actualisez la page avant de republier.');if(active()){notify('Caractéristiques publiées sur le catalogue et le parcours Car na ngai.');await render(ctx);}}catch(err){errorBox.textContent=err.message||'Publication impossible. Réessayez.';}finally{button.disabled=false;}};
  }catch(err){if(active())content.innerHTML=`<p class="form-error">${e(err.message||'Chargement impossible.')}</p><button class="secondary" data-view="modelSpecs">Réessayer</button>`;}
 }
 window.GMFleetModelAdmin={render};
})();
