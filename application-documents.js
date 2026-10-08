/* Private document review and versioned replacement for application dossiers. */
(() => {
 'use strict';
 const categories={identity:"Pièce d’identité",license:'Permis de conduire',residence:'Justificatif de domicile',yango:'Justificatif Yango',registration:'Carte rose',insurance:'Assurance',cv:'CV',vehicle_photo:'Photo du véhicule',other:'Autre document'};
 const statuses={pending:'À vérifier',approved:'Validé',rejected:'Refusé'};
 const icon=name=>`<i data-lucide="${name}" aria-hidden="true"></i>`;
 const paintIcons=()=>window.lucide?.createIcons({attrs:{'aria-hidden':'true'}});
 const size=bytes=>bytes>=1048576?(bytes/1048576).toFixed(1)+' Mo':Math.max(1,Math.ceil(bytes/1024))+' Ko';
 let pdfLibrary;
 function mount(c){
  const {root,documents,application,db,escape:e,date,person,notify,refreshCase,state}=c;
  if(state.documentUi?.applicationId!==application.id)state.documentUi={applicationId:application.id,filter:'all',selectedId:null};
  const ui=state.documentUi,byId=id=>documents.find(d=>String(d.id)===String(id));
  const current=()=>documents.filter(d=>!documents.some(next=>next.replaces_document_id===d.id));
  const historical=d=>documents.some(next=>next.replaces_document_id===d.id);
  const status=d=>d.review_status||'pending';
  const title=d=>d.category&&d.category!=='other'?categories[d.category]:d.name;
  const badge=d=>`<span class="document-status" data-status="${status(d)}">${icon(status(d)==='approved'?'circle-check':status(d)==='rejected'?'circle-x':'clock-3')}${statuses[status(d)]}</span>`;
  const viewer=document.createElement('dialog'),uploader=document.createElement('dialog');
  viewer.id='documentViewer';viewer.className='document-viewer';viewer.setAttribute('aria-labelledby','documentViewerTitle');
  uploader.id='documentUpload';uploader.className='document-upload-dialog';uploader.setAttribute('aria-labelledby','documentUploadTitle');
  document.body.append(viewer,uploader);
  let disposed=false,busy=false,previewToken=0,loadingTask,pdf,renderTask,pageNumber=1,zoom=1,rotation=0,imageElement,opened;
  const errorMessage=error=>error.message||'Impossible de terminer cette action. Réessayez.';
  async function check(result){if(result.error)throw result.error;return result.data;}
  function releasePreview(){
   previewToken++;imageElement=null;
   renderTask?.cancel();renderTask=null;
   if(loadingTask){loadingTask.destroy().catch(()=>{});loadingTask=null;}
   pdf=null;
  }
  function list(){
   const items=current(),shown=items.filter(d=>ui.filter==='all'||status(d)===ui.filter);
   root.innerHTML=`<div class="documents-heading"><div><h3>Documents du candidat</h3><p>${items.length} pièce${items.length===1?'':'s'} · ${items.filter(d=>status(d)==='pending').length} à vérifier</p></div><button type="button" class="secondary document-command" data-add-document>${icon('plus')}Ajouter une pièce</button></div>
    <div class="document-filters" role="group" aria-label="Filtrer les documents">${Object.entries({all:'Tous',pending:'À vérifier',approved:'Validés',rejected:'Refusés'}).map(([key,label])=>`<button type="button" data-document-filter="${key}" aria-pressed="${ui.filter===key}">${e(label)} <span>${key==='all'?items.length:items.filter(d=>status(d)===key).length}</span></button>`).join('')}</div>
    <div class="document-list">${shown.length?shown.map(d=>`<button type="button" class="document-item" data-open-document="${e(d.id)}" aria-label="Ouvrir ${e(title(d))}"><span class="document-file-icon">${icon(d.mime_type.startsWith('image/')?'image':'file-text')}</span><span class="document-file-name"><strong>${e(title(d))}</strong><small>${e(d.name)} · ${size(d.size_bytes)}</small>${d.review_reason?`<small class="document-reason-text">${e(d.review_reason)}</small>`:''}</span>${badge(d)}<span class="document-file-date">${date(d.created_at)}<small>${d.created_by?e(person(d.created_by)):'Candidat'}${d.replaces_document_id?' · Nouvelle version':''}</small></span><span class="document-open-icon">${icon('chevron-right')}</span></button>`).join(''):`<div class="documents-empty">${icon('files')}<strong>${items.length?'Aucune pièce dans ce filtre':'Aucun document reçu'}</strong></div>`}</div>`;
   paintIcons();
  }
  function uploadFields(d){
   return `${d?'':`<label>Type de pièce<select name="category">${Object.entries(categories).map(([key,label])=>`<option value="${key}" ${key==='other'?'selected':''}>${e(label)}</option>`).join('')}</select></label>`}<label class="document-file-picker">Fichier<input type="file" name="file" accept="application/pdf,image/jpeg,image/png,image/webp" required><span class="muted">PDF, JPG, PNG ou WebP · 10 Mo maximum</span></label>${d?'<label>Observations sur le remplacement<textarea name="replacement_note" maxlength="2000" rows="2"></textarea></label>':''}<div class="form-error" role="alert"></div><button type="submit" class="primary document-command">${icon('upload')}${d?'Enregistrer la nouvelle version':'Ajouter au dossier'}</button>`;
  }
  function openUpload(){
   uploader.innerHTML=`<div class="dialog-title"><h2 id="documentUploadTitle">Ajouter une pièce</h2><button type="button" class="document-icon-button" data-upload-close aria-label="Fermer" title="Fermer">${icon('x')}</button></div><form id="documentForm" class="document-upload-form">${uploadFields()}</form>`;
   uploader.querySelector('form').onsubmit=event=>saveUpload(event,null);
   uploader.querySelector('[data-upload-close]').onclick=()=>uploader.close();
   paintIcons();uploader.showModal();
  }
  function versions(d){
   const chain=[d],seen=new Set([d.id]);let previous=byId(d.replaces_document_id);
   while(previous&&!seen.has(previous.id)){chain.push(previous);seen.add(previous.id);previous=byId(previous.replaces_document_id);}
   return chain;
  }
  function inspector(d){
   const old=historical(d);
   viewer.querySelector('.document-inspector').innerHTML=`<div class="document-review-heading"><span class="eyebrow">VÉRIFICATION DE LA PIÈCE</span>${old?'<span class="tag">Version remplacée</span>':badge(d)}</div>
    <dl class="document-metadata"><div><dt>Type de pièce</dt><dd>${e(categories[d.category]||categories.other)}</dd></div><div><dt>Fichier</dt><dd>${e(d.name)}</dd></div><div><dt>Déposé par</dt><dd>${d.created_by?e(person(d.created_by)):'Candidat'} · ${date(d.created_at,true)}</dd></div><div><dt>Format et taille</dt><dd>${d.mime_type==='application/pdf'?'PDF':d.mime_type.split('/')[1].toUpperCase()} · ${size(d.size_bytes)}</dd></div></dl>
    ${d.reviewed_at?`<p class="document-review-record">${e(statuses[status(d)])} par ${e(person(d.reviewed_by))}<br>${date(d.reviewed_at,true)}</p>`:''}
    ${d.review_reason?`<div class="document-review-note" data-status="${status(d)}"><strong>${status(d)==='rejected'?'Motif du refus':'Observations'}</strong><p>${e(d.review_reason)}</p></div>`:''}
    ${d.replacement_note?`<div class="document-review-note"><strong>Observations du remplacement</strong><p>${e(d.replacement_note)}</p></div>`:''}
    <div class="document-action-error form-error" role="alert"></div>
    ${old?'':`<div class="document-review-buttons"><button type="button" class="document-approve document-command" data-review-document="approved" ${status(d)==='approved'?'disabled':''}>${icon('check')}Valider</button><button type="button" class="document-reject document-command" data-reject-document>${icon('x')}Refuser</button></div><form id="documentRejectForm" class="document-reject-form" hidden><label>Motif du refus<textarea name="review_reason" required minlength="3" maxlength="2000" rows="3">${e(status(d)==='rejected'?d.review_reason:'')}</textarea></label><div class="form-error" role="alert"></div><div class="document-form-actions"><button type="submit" class="document-reject">Confirmer le refus</button><button type="button" class="secondary" data-cancel-reject>Annuler</button></div></form>
    ${status(d)!=='pending'?'<button type="button" class="link-button document-reset" data-review-document="pending">Remettre à vérifier</button>':''}
    <details class="document-replacement"><summary>${icon('replace')}Remplacer le fichier</summary><form id="documentReplacementForm" class="document-upload-form">${uploadFields(d)}</form></details>`}
    ${versions(d).length>1?`<details class="document-version-history"><summary>Versions précédentes (${versions(d).length-1})</summary>${versions(d).slice(1).map(previous=>`<button type="button" class="document-version" data-open-version="${e(previous.id)}"><span>${e(previous.name)}<small>${date(previous.created_at,true)}</small></span>${icon('external-link')}</button>`).join('')}</details>`:''}
    ${old?'<button type="button" class="secondary document-command" data-current-version>Retour à la pièce actuelle</button>':''}`;
   const rejectForm=viewer.querySelector('#documentRejectForm');
   viewer.querySelector('[data-reject-document]')?.addEventListener('click',()=>{rejectForm.hidden=false;rejectForm.elements.review_reason.focus();});
   viewer.querySelector('[data-cancel-reject]')?.addEventListener('click',()=>rejectForm.hidden=true);
   if(rejectForm)rejectForm.onsubmit=event=>{event.preventDefault();reviewDocument(d,'rejected',rejectForm.elements.review_reason.value.trim(),rejectForm);};
   viewer.querySelectorAll('[data-review-document]').forEach(button=>button.onclick=()=>reviewDocument(d,button.dataset.reviewDocument,null));
   const replaceForm=viewer.querySelector('#documentReplacementForm');if(replaceForm)replaceForm.onsubmit=event=>saveUpload(event,d);
   viewer.querySelectorAll('[data-open-version]').forEach(button=>button.onclick=()=>openDocument(byId(button.dataset.openVersion)));
   viewer.querySelector('[data-current-version]')?.addEventListener('click',()=>{let latest=d;while(documents.some(next=>next.replaces_document_id===latest.id))latest=documents.find(next=>next.replaces_document_id===latest.id);openDocument(latest);});
   paintIcons();
  }
  async function reviewDocument(d,value,reason,form){
   if(busy||disposed)return;
   if(value==='rejected'&&(!reason||reason.length<3)){form.querySelector('.form-error').textContent='Indiquez le motif du refus (3 caractères minimum).';return;}
   const target=form?.querySelector('.form-error')||viewer.querySelector('.document-action-error');target.textContent='';
   setBusy(true);
   try{
    const changed=await check(await db.from('documents').update({review_status:value,review_reason:reason}).eq('id',d.id).eq('revision',d.revision||1).select('*'));
    if(!changed.length)throw new Error('Cette pièce a changé. Fermez le document et actualisez le dossier.');
    ui.selectedId=d.id;
    await refreshCase(application.id);
    notify(value==='approved'?'Pièce validée.':value==='rejected'?'Pièce refusée. Motif enregistré.':'Pièce remise à vérifier.');
   }catch(error){if(!disposed)target.textContent=errorMessage(error);}
   finally{setBusy(false);}
  }
  function setBusy(value){
   busy=value;
   [viewer,uploader].forEach(dialog=>{dialog.setAttribute('aria-busy',String(value));dialog.querySelectorAll('button,input,select,textarea,summary').forEach(node=>{if(value){node.dataset.wasDisabled=String(!!node.disabled);node.disabled=true;}else if(node.dataset.wasDisabled!==undefined){node.disabled=node.dataset.wasDisabled==='true';delete node.dataset.wasDisabled;}});});
  }
  async function saveUpload(event,replaced){
   event.preventDefault();if(busy||disposed)return;
   const form=event.currentTarget,data=new FormData(form),file=data.get('file'),error=form.querySelector('.form-error'),button=form.querySelector('[type=submit]'),label=button.innerHTML;
   let path,registered=false;error.textContent='';
   setBusy(true);button.textContent='Téléversement en cours…';
   try{
    const extension={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file?.type];
    if(!extension||!file.size||file.size>10485760)throw new Error('Choisissez un PDF, JPG, PNG ou WebP de 10 Mo maximum.');
    const bytes=new Uint8Array(await file.slice(0,12).arrayBuffer());
    const valid=extension==='pdf'?String.fromCharCode(...bytes.slice(0,5))==='%PDF-':extension==='jpg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:extension==='png'?[137,80,78,71,13,10,26,10].every((byte,i)=>bytes[i]===byte):String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
    if(!valid)throw new Error('Le contenu du fichier ne correspond pas au format annoncé.');
    path=`${application.id}/${crypto.randomUUID()}.${extension}`;
    await check(await db.storage.from('application-documents').upload(path,file,{contentType:file.type,upsert:false}));
    button.textContent='Enregistrement en cours…';
    const added=await check(await db.from('documents').insert({application_id:application.id,name:file.name.slice(0,250),storage_path:path,mime_type:file.type,size_bytes:file.size,category:replaced?.category||data.get('category')||'other',replaces_document_id:replaced?.id||null,replacement_note:String(data.get('replacement_note')||'').trim()||null}).select('*').single());
    registered=true;ui.selectedId=added.id;
    await refreshCase(application.id);
    notify(replaced?'Nouvelle version enregistrée, à vérifier.':'Pièce ajoutée au dossier, à vérifier.');
   }catch(failure){
    if(path&&!registered){try{await check(await db.storage.from('application-documents').remove([path]));}catch{notify('Le fichier temporaire n’a pas pu être nettoyé.',true);}}
    if(!disposed)error.textContent=errorMessage(failure);
   }finally{if(!disposed){button.innerHTML=label;setBusy(false);paintIcons();}}
  }
  function toolbar(){
   const counter=viewer.querySelector('[data-page-counter]');
   counter.textContent=pdf?`${pageNumber} / ${pdf.numPages}`:'Image';
   viewer.querySelector('[data-preview=previous-page]').disabled=!pdf||pageNumber<=1;
   viewer.querySelector('[data-preview=next-page]').disabled=!pdf||pageNumber>=pdf.numPages;
   viewer.querySelector('[data-zoom-value]').textContent=Math.round(zoom*100)+' %';
   viewer.querySelectorAll('[data-preview]').forEach(button=>{if(['previous-page','next-page'].includes(button.dataset.preview))return;button.disabled=(!pdf&&!imageElement)||(button.dataset.preview==='zoom-in'&&zoom>=3)||(button.dataset.preview==='zoom-out'&&zoom<=0.5);});
  }
  async function draw(token=previewToken){
   const stage=viewer.querySelector('.document-stage'),surface=viewer.querySelector('.document-surface');
   if(!stage||(!pdf&&!imageElement)||token!==previewToken)return;
   renderTask?.cancel();
   if(imageElement){
    const swap=rotation%180!==0,w=swap?imageElement.naturalHeight:imageElement.naturalWidth,h=swap?imageElement.naturalWidth:imageElement.naturalHeight;
    const fit=Math.min((stage.clientWidth-40)/w,(stage.clientHeight-40)/h,1),canvas=document.createElement('canvas');
    canvas.width=w;canvas.height=h;canvas.style.width=Math.round(w*fit*zoom)+'px';canvas.style.height=Math.round(h*fit*zoom)+'px';
    const context=canvas.getContext('2d');context.translate(w/2,h/2);context.rotate(rotation*Math.PI/180);context.drawImage(imageElement,-imageElement.naturalWidth/2,-imageElement.naturalHeight/2);
    canvas.setAttribute('role','img');canvas.setAttribute('aria-label',opened.name);surface.replaceChildren(canvas);
   }else{
    try{
     const page=await pdf.getPage(pageNumber);if(token!==previewToken)return;
     const natural=page.getViewport({scale:1,rotation:page.rotate+rotation}),fit=Math.min((stage.clientWidth-40)/natural.width,(stage.clientHeight-40)/natural.height,1.5);
     const viewport=page.getViewport({scale:fit*zoom,rotation:page.rotate+rotation}),ratio=Math.min(devicePixelRatio||1,2),canvas=document.createElement('canvas');
     canvas.width=Math.round(viewport.width*ratio);canvas.height=Math.round(viewport.height*ratio);canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';
     canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`${opened.name}, page ${pageNumber}`);
     surface.replaceChildren(canvas);
     renderTask=page.render({canvasContext:canvas.getContext('2d'),viewport,transform:ratio===1?null:[ratio,0,0,ratio,0,0]});
     await renderTask.promise;
    }catch(error){if(token===previewToken&&error.name!=='RenderingCancelledException')showPreviewError();}
   }
   toolbar();
  }
  function showPreviewError(){
   if(disposed||!viewer.open)return;
   viewer.querySelector('.document-surface').innerHTML=`<div class="document-preview-error">${icon('file-warning')}<strong>Aperçu indisponible</strong><p>Le fichier est illisible, protégé ou temporairement inaccessible.</p><button type="button" class="secondary document-command" data-retry-preview>${icon('rotate-cw')}Réessayer</button></div>`;
   viewer.querySelector('[data-retry-preview]').onclick=()=>openDocument(opened);paintIcons();
  }
  async function openDocument(d){
   if(!d||disposed||busy)return;
   releasePreview();const token=previewToken;opened=d;ui.selectedId=d.id;pageNumber=1;zoom=1;rotation=0;
   const items=current(),index=items.findIndex(item=>item.id===d.id);
   viewer.innerHTML=`<div class="document-viewer-header"><div class="document-viewer-title"><span class="eyebrow">${e(application.name)}</span><h2 id="documentViewerTitle">${e(title(d))}</h2></div><div class="document-viewer-navigation"><button type="button" class="document-icon-button" data-document-nav="-1" aria-label="Pièce précédente" title="Pièce précédente" ${index<=0?'disabled':''}>${icon('chevron-left')}</button><span>${index<0?'Archive':`${index+1} / ${items.length}`}</span><button type="button" class="document-icon-button" data-document-nav="1" aria-label="Pièce suivante" title="Pièce suivante" ${index<0||index>=items.length-1?'disabled':''}>${icon('chevron-right')}</button><button type="button" class="document-icon-button" data-viewer-close aria-label="Fermer le document" title="Fermer le document">${icon('x')}</button></div></div>
    <div class="document-viewer-layout"><div class="document-preview-workspace"><div class="document-preview-toolbar"><div><button type="button" class="document-icon-button" data-preview="previous-page" aria-label="Page précédente" title="Page précédente" disabled>${icon('chevron-left')}</button><span data-page-counter>Chargement…</span><button type="button" class="document-icon-button" data-preview="next-page" aria-label="Page suivante" title="Page suivante" disabled>${icon('chevron-right')}</button></div><div><button type="button" class="document-icon-button" data-preview="zoom-out" aria-label="Réduire" title="Réduire" disabled>${icon('zoom-out')}</button><span data-zoom-value>100 %</span><button type="button" class="document-icon-button" data-preview="zoom-in" aria-label="Agrandir" title="Agrandir" disabled>${icon('zoom-in')}</button><button type="button" class="document-icon-button" data-preview="fit" aria-label="Ajuster à la fenêtre" title="Ajuster à la fenêtre" disabled>${icon('scan')}</button><button type="button" class="document-icon-button" data-preview="rotate" aria-label="Tourner" title="Tourner" disabled>${icon('rotate-cw')}</button></div><button type="button" class="document-icon-button" data-download-document aria-label="Télécharger le fichier" title="Télécharger le fichier">${icon('download')}</button></div><div class="document-stage" tabindex="0" aria-label="Aperçu du document"><div class="document-surface"><p role="status">Chargement du document…</p></div></div></div><aside class="document-inspector"></aside></div>`;
   inspector(d);
   viewer.querySelector('[data-viewer-close]').onclick=()=>viewer.close();
   viewer.querySelectorAll('[data-document-nav]').forEach(button=>button.onclick=()=>openDocument(items[index+Number(button.dataset.documentNav)]));
   viewer.querySelectorAll('[data-preview]').forEach(button=>button.onclick=()=>{const action=button.dataset.preview;if(action==='previous-page')pageNumber--;if(action==='next-page')pageNumber++;if(action==='zoom-in')zoom=Math.min(3,zoom+0.25);if(action==='zoom-out')zoom=Math.max(0.5,zoom-0.25);if(action==='fit'){zoom=1;rotation=0;}if(action==='rotate')rotation=(rotation+90)%360;draw();});
   viewer.querySelector('[data-download-document]').onclick=async event=>{
    const button=event.currentTarget;button.disabled=true;
    try{const data=await check(await db.storage.from('application-documents').createSignedUrl(d.storage_path,60,{download:d.name}));if(disposed)return;const anchor=document.createElement('a');anchor.href=data.signedUrl;anchor.download=d.name;anchor.target='_blank';anchor.rel='noopener';document.body.append(anchor);anchor.click();anchor.remove();}
    catch(error){if(!disposed)viewer.querySelector('.document-action-error').textContent=errorMessage(error);}finally{button.disabled=false;}
   };
   paintIcons();if(!viewer.open)viewer.showModal();
   try{
    const data=await check(await db.storage.from('application-documents').createSignedUrl(d.storage_path,600));if(disposed||token!==previewToken)return;
    if(d.mime_type.startsWith('image/')){
     const img=new Image();img.onload=()=>{if(token!==previewToken||disposed)return;imageElement=img;draw(token);};img.onerror=()=>{if(token===previewToken)showPreviewError();};img.src=data.signedUrl;
    }else{
     pdfLibrary??=import('/vendor/pdfjs-4.10.38/pdf.min.mjs');
     const library=await pdfLibrary;if(disposed||token!==previewToken)return;
     library.GlobalWorkerOptions.workerSrc='/vendor/pdfjs-4.10.38/pdf.worker.min.mjs';
     loadingTask=library.getDocument({url:data.signedUrl,isEvalSupported:false});
     const loaded=await loadingTask.promise;if(disposed||token!==previewToken)return;pdf=loaded;await draw(token);
    }
   }catch{if(token===previewToken)showPreviewError();}
  }
  root.onclick=event=>{const button=event.target.closest('button');if(!button)return;if(button.hasAttribute('data-add-document'))openUpload();if(button.dataset.openDocument)openDocument(byId(button.dataset.openDocument));if(button.dataset.documentFilter){ui.filter=button.dataset.documentFilter;list();}};
  viewer.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  uploader.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  viewer.addEventListener('close',()=>{if(!disposed){ui.selectedId=null;releasePreview();}});
  const observer=new ResizeObserver(()=>{if(viewer.open)draw();});observer.observe(viewer);
  list();if(ui.selectedId&&byId(ui.selectedId))openDocument(byId(ui.selectedId));
  return {destroy(){disposed=true;observer.disconnect();releasePreview();root.onclick=null;viewer.close();uploader.close();viewer.remove();uploader.remove();}};
 }
 window.GMFleetDocuments={mount};
})();
