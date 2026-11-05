/* Tab-local recovery only. A draft never submits itself or confirms a transaction. */
window.GMFleetDrafts=(()=>{
 const TTL=24*60*60*1000,DB='gmfleet-form-drafts-v1',STORE='drafts',FILES='files';
 let owner='',prefix='',config={},database=null,records=new Map(),forms=new Map(),metadata=new WeakMap(),observer,restoring=false,clearing=false,hub,button,pendingWrites=0;
 const fileWrites=new Map(),safeData=['requestId'];
 const eligible=f=>f instanceof HTMLFormElement&&!!f.closest('#intake,#caseDialog,#financeDialog,#fleetDialog,#vehicleEquipmentDialog,#documentUpload,#documentViewer')&&!f.matches('[data-no-draft]');
 const controls=f=>[...f.querySelectorAll('input,select,textarea')].filter(x=>!['password','hidden','submit','button','reset'].includes(x.type)&&!x.readOnly&&!/password|token|secret|otp|code_acces/i.test(x.name||x.id||''));
 const identity=x=>x.name?'name:'+x.name:x.id?'id:'+x.id:x.dataset.photoView?'photo:'+x.dataset.photoView:null;
 const fieldKey=(x,all)=>identity(x)+'#'+all.filter(y=>identity(y)===identity(x)).indexOf(x);
 const keyFor=f=>{
  const dialog=f.closest('dialog'),caseOpen=document.getElementById('caseDialog')?.open,context=config.context?.()||{};
  const scope=caseOpen?'case:'+context.case_id:'workspace:'+context.view+':'+(context.fleet_tab||'');
  const names={intakeForm:'Nouvelle candidature',activateForm:'Activation du contrat',paymentForm:'Versement en espèces',ownerFleetForm:'Entrée du véhicule',caseStepForm:'Décision du dossier',workflowForm:'Suivi du dossier',repairWizard:'Réparation',appointmentForm:'Rendez-vous'};
  const label=names[f.id]||f.id||f.closest('details')?.querySelector('summary')?.textContent||dialog?.querySelector('h2')?.textContent||'Formulaire';
  return {key:prefix+encodeURIComponent(JSON.stringify([scope,dialog?.id,f.dataset.draftEntity||'',f.id==='caseStepForm'?context.process_step:'',label,f.id?[]:[...new Set(controls(f).map(identity).filter(Boolean))].sort()])),label,context};
 };
 function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,2);r.onupgradeneeded=()=>{for(const name of [STORE,FILES])if(!r.result.objectStoreNames.contains(name))r.result.createObjectStore(name,{keyPath:'key'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
 async function writeRecord(r,remove=false,includeFiles=true){if(!database)throw Error('Stockage des fichiers indisponible');return new Promise((resolve,reject)=>{const tx=database.transaction([STORE,FILES],'readwrite');if(remove){tx.objectStore(STORE).delete(r.key);tx.objectStore(FILES).delete(r.key);}else{tx.objectStore(STORE).put(textRecord(r));if(includeFiles){if(r.files.length)tx.objectStore(FILES).put({key:r.key,files:r.files,fileSignature:r.fileSignature});else tx.objectStore(FILES).delete(r.key);}}tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
 async function readFiles(key){if(!database)return null;return new Promise((resolve,reject)=>{const r=database.transaction(FILES).objectStore(FILES).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
 async function allDB(){if(!database)return [];return new Promise((resolve,reject)=>{const r=database.transaction(STORE).objectStore(STORE).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
 function textRecord(r){const {files,...text}=r;return text;}
 function storeText(r){try{sessionStorage.setItem(r.key,JSON.stringify(textRecord(r)));r.textError=false;}catch{r.textError=true;}records.set(r.key,r);updateHub();}
 function persistFiles(r,includeFiles){
  const pendingPhoto=includeFiles&&r.files.length>0;if(pendingPhoto)pendingWrites++;
  const next=Promise.resolve(fileWrites.get(r.key)).catch(()=>{}).then(async()=>{await writeRecord(r,false,includeFiles);const current=records.get(r.key);if(current?.fileSignature===r.fileSignature&&current.fileError){current.fileError=false;storeText(current);paint(r.key);}}).catch(()=>{const current=records.get(r.key);if(current){current.fileError=!!current.fileNames?.length;storeText(current);paint(r.key);}}).finally(()=>{if(pendingPhoto)pendingWrites--;});
  fileWrites.set(r.key,next);return next;
 }
 function describe(f,meta){const context=config.context?.()||meta.context;return {...meta.context,...context,entity:f.dataset.draftEntity||'',form_id:f.id||'',dialog_id:f.closest('dialog')?.id||'',dialog_title:f.closest('dialog')?.querySelector('h2')?.textContent||'',contract_id:f.elements.namedItem('contract_id')?.value||'',vehicle_id:f.elements.namedItem('vehicle_id')?.value||''};}
 function save(f,submitted=false,filesChanged=false){
  if(!owner||restoring||clearing||!eligible(f))return;const meta=attach(f);if(!meta||meta.completed)return;
  const previous=records.get(meta.key),all=controls(f),values=[],files=[];
  for(const x of all){const id=identity(x);if(!id)continue;const key=fieldKey(x,all);
   if(x.type==='file'){for(const file of x.files||[])files.push({field:key,file,name:file.name,type:file.type,lastModified:file.lastModified});continue;}
   if(x.type==='checkbox'&&!x.name||/confirm|consent|owner_setup_reviewed/i.test(x.name))continue;
   values.push({key,type:x.type,value:x.value,checked:['checkbox','radio'].includes(x.type)?x.checked:undefined});
  }
  const dataset={};safeData.forEach(k=>{if(f.dataset[k])dataset[k]=f.dataset[k];});
  const fileRevision=filesChanged?crypto.randomUUID():previous?.fileRevision||'0',fileSignature=JSON.stringify(files.map(x=>[x.field,x.name,x.file.size,x.lastModified]))+':'+fileRevision;
  if(submitted)meta.attempted=true;
  const r={key:meta.key,owner,tab:prefix,label:meta.label,context:describe(f,meta),values,files,fileSignature,fileRevision,fileNames:files.map(x=>x.name),fileError:previous?.fileError||false,dataset,updatedAt:Date.now(),expiresAt:Date.now()+TTL,submitted:meta.attempted||meta.uncertain||false};
  storeText(r);persistFiles(r,previous?.fileSignature!==fileSignature||previous?.fileError);meta.dirty=true;paint(meta.key);
 }
 function notice(f){let n=f.querySelector(':scope > .draft-notice');if(!n){n=document.createElement('div');n.className='draft-notice';n.setAttribute('role','status');f.prepend(n);}return n;}
 function paint(key){const f=forms.get(key),r=records.get(key);if(!f?.isConnected)return;const meta=metadata.get(f);if(!r||r.expiresAt<Date.now()){f.querySelector(':scope > .draft-notice')?.remove();return;}
  const n=notice(f);n.replaceChildren();const text=document.createElement('span');
  text.textContent=r.textError?'Le navigateur ne conserve pas ce brouillon. Gardez le formulaire ouvert.':r.fileError?'Texte conservé. Les fichiers devront être sélectionnés à nouveau.':meta.uncertain?'Envoi interrompu : vérifiez le dossier ou l’historique avant une nouvelle saisie.':meta.dirty?'Brouillon conservé dans cet onglet.':'Un brouillon de ce formulaire est disponible.';n.append(text);
  if(!meta.dirty){const restore=document.createElement('button');restore.type='button';restore.className='secondary';restore.textContent='Restaurer le brouillon';restore.onclick=()=>restoreForm(f,r);n.append(restore);}
  const discard=document.createElement('button');discard.type='button';discard.className='link-button';discard.textContent='Supprimer le brouillon';discard.onclick=async()=>{
   const uncertain=meta.uncertain;await remove(key);meta.dirty=false;meta.uncertain=false;meta.completed=false;
   if(uncertain){f.reset();f.closest('dialog')?.close();config.notify?.('Brouillon supprimé. Vérifiez l’historique avant de refaire une opération.');}
  };n.append(discard);
  if(r.fileNames?.length&&!meta.dirty){const info=document.createElement('small');info.textContent=r.fileError?'Fichiers à ajouter de nouveau : '+r.fileNames.join(', '):r.fileNames.length+' fichier(s) joint(s) conservé(s).';n.append(info);}
 }
 async function restoreForm(f,r){
  r=records.get(r.key);if(!r){config.notify?.('Ce brouillon a déjà été enregistré ou supprimé.');return;}
  if(r.owner!==owner||r.expiresAt<Date.now())return;
  const meta=metadata.get(f);if(!meta)return;
  // Re-read file blobs if the synchronous last-keystroke snapshot was newer than IndexedDB.
  await Promise.resolve(fileWrites.get(r.key)).catch(()=>{});const stored=await readFiles(r.key).catch(()=>null);const blobs=stored?.fileSignature===r.fileSignature?stored.files||[]:r.files||[];
  if(!records.has(r.key)||!f.isConnected)return;
  restoring=true;let fileProblem=false,fieldProblem=false,missingEntity=false;
  try{
   // Selects drive programme-specific fields. Restore them in DOM order first.
   for(const value of r.values.filter(v=>v.type==='select-one'||v.type==='select-multiple')){const all=controls(f),x=all.find(x=>fieldKey(x,all)===value.key);if(!x)continue;if(![...x.options].some(o=>o.value===value.value)){fieldProblem=true;if(['application_id','contract_id','fleet_vehicle','vehicle_id','program'].includes(x.name)){x.value='';missingEntity=true;}continue;}x.value=value.value;x.dispatchEvent(new Event('change',{bubbles:true}));}
   if(missingEntity){config.notify?.('Le dossier, contrat ou véhicule de ce brouillon n’est plus disponible. Vérifiez son historique avant de poursuivre.',true);return;}
   const all=controls(f);
   for(const value of r.values.filter(v=>!v.type.startsWith('select'))){const x=all.find(x=>fieldKey(x,all)===value.key);if(!x||x.readOnly)continue;if(['checkbox','radio'].includes(x.type))x.checked=!!value.checked;else x.value=value.value;x.dispatchEvent(new Event(x.type==='checkbox'||x.type==='radio'?'change':'input',{bubbles:true}));}
   for(const x of all.filter(x=>x.type==='file')){const saved=blobs.filter(v=>v.field===fieldKey(x,all));if(!saved.length)continue;try{const dt=new DataTransfer();for(const v of saved)dt.items.add(new File([v.file],v.name,{type:v.type,lastModified:v.lastModified}));x.files=dt.files;x.dispatchEvent(new Event('change',{bubbles:true}));}catch{fileProblem=true;}}
   safeData.forEach(k=>{if(r.dataset?.[k])f.dataset[k]=r.dataset[k];});
   // A restored draft is never a final confirmation.
   f.querySelectorAll('input[type=checkbox]').forEach(x=>{if(!x.name||/confirm|consent|owner_setup_reviewed/i.test(x.name)){x.checked=false;x.dispatchEvent(new Event('change',{bubbles:true}));}});
   meta.dirty=true;meta.uncertain=!!r.submitted;meta.completed=false;
  }finally{restoring=false;}
  if(r.fileNames?.length&&!blobs.length)fileProblem=true;
  if(fileProblem||fieldProblem)config.notify?.(fileProblem?'Texte restauré. Ajoutez de nouveau les fichiers signalés.':'Brouillon restauré. Un choix n’est plus disponible : vérifiez les sélections.',true);
  else config.notify?.('Brouillon restauré. Vérifiez les données et confirmez à nouveau avant d’enregistrer.');
  if(r.context?.revision&&config.context?.().revision!==r.context.revision)config.notify?.('Le dossier a changé depuis ce brouillon. Comparez les informations avant d’enregistrer.',true);
  paint(meta.key);f.closest('details')?.setAttribute('open','');f.querySelector('input:not([type=hidden]),select,textarea')?.focus();
 }
 function attach(f){if(!eligible(f)||!owner)return null;let meta=metadata.get(f);if(meta)return meta;meta={...keyFor(f),dirty:false,uncertain:false,completed:false};metadata.set(f,meta);forms.set(meta.key,f);paint(meta.key);return meta;}
 async function remove(key){records.delete(key);try{sessionStorage.setItem(key,JSON.stringify({key,owner,completed:true,expiresAt:Date.now()+TTL}));}catch{}await Promise.resolve(fileWrites.get(key)).catch(()=>{});await writeRecord({key},true).catch(()=>{});try{sessionStorage.removeItem(key);}catch{}fileWrites.delete(key);forms.get(key)?.querySelector(':scope > .draft-notice')?.remove();updateHub();}
 function complete(f){const meta=metadata.get(f);if(!meta||meta.completed)return;meta.completed=true;meta.uncertain=false;meta.attempted=false;meta.dirty=false;return remove(meta.key);}
 function updateHub(){if(!button)return;const count=[...records.values()].filter(r=>r.expiresAt>Date.now()).length;button.hidden=!count;button.textContent='Brouillons · '+count;}
 function showHub(){
  hub ||=document.createElement('dialog');hub.className='case-dialog draft-dialog';hub.replaceChildren();const title=document.createElement('h2');title.textContent='Vos brouillons';hub.append(title);const help=document.createElement('p');help.className='muted';help.textContent='Conservés 24 h dans cet onglet. Ils ne remplacent pas un enregistrement en base.';hub.append(help);
  for(const r of [...records.values()].filter(r=>r.expiresAt>Date.now()).sort((a,b)=>b.updatedAt-a.updatedAt)){const row=document.createElement('article');row.className='row';const name=document.createElement('div');const strong=document.createElement('strong');strong.textContent=r.label;const small=document.createElement('small');small.textContent=(r.context?.case_label?r.context.case_label+' · ':'')+new Date(r.updatedAt).toLocaleString('fr-FR');name.append(strong,small);row.append(name);const resume=document.createElement('button');resume.type='button';resume.className='secondary';resume.textContent='Reprendre';resume.onclick=async()=>{hub.close();try{await config.resume?.(r.context);let f=forms.get(r.key);if(!f?.isConnected){await new Promise(resolve=>setTimeout(resolve,150));document.querySelectorAll('form').forEach(attach);f=forms.get(r.key);}if(f?.isConnected){await restoreForm(f,r);}else config.notify?.('Rouvrez le formulaire « '+r.label+' » pour restaurer ce brouillon.');}catch(e){config.notify?.('Brouillon conservé. Rouvrez son formulaire pour le restaurer.',true);}};row.append(resume);const discard=document.createElement('button');discard.type='button';discard.className='link-button';discard.textContent='Supprimer';discard.onclick=async()=>{await remove(r.key);showHub();};row.append(discard);hub.append(row);}
  const close=document.createElement('button');close.type='button';close.className='secondary';close.textContent='Fermer';close.onclick=()=>hub.close();hub.append(close);document.body.append(hub);if(!hub.open)hub.showModal();
 }
 async function purge(){clearing=true;for(const key of [...records.keys()])await remove(key);clearing=false;}
 async function init(options){config=options;owner=options.userId;let tab;try{tab=sessionStorage.getItem('gmfleet-draft-tab');if(!tab){tab=crypto.randomUUID();sessionStorage.setItem('gmfleet-draft-tab',tab);}}catch{tab=crypto.randomUUID();config.notify?.('Stockage des brouillons bloqué par le navigateur.',true);}prefix='gmfleet:draft:v1:'+owner+':'+tab+':';
  database=await openDB().catch(()=>null);
  for(const r of await allDB().catch(()=>[])){if(r.expiresAt<Date.now()){await writeRecord({key:r.key},true).catch(()=>{});continue;}if(r.key.startsWith(prefix)&&r.owner===owner)records.set(r.key,r);}
  try{for(const key of Object.keys(sessionStorage)){if(!key.startsWith(prefix))continue;try{const r=JSON.parse(sessionStorage.getItem(key));if(r.completed||r.expiresAt<=Date.now()){records.delete(key);await writeRecord({key},true).catch(()=>{});sessionStorage.removeItem(key);continue;}if(r.owner===owner)records.set(key,r);}catch{}}}catch{}
  button=document.createElement('button');button.type='button';button.className='secondary draft-hub-button';button.onclick=showHub;document.querySelector('.sidebar-foot')?.prepend(button);updateHub();document.querySelectorAll('form').forEach(attach);
  observer=new MutationObserver(()=>{document.querySelectorAll('form').forEach(attach);});observer.observe(document.body,{subtree:true,childList:true});
  document.addEventListener('input',event=>{const f=event.target.closest('form');if(f&&eligible(f)&&event.target.type!=='file')save(f);});
  document.addEventListener('change',event=>{const f=event.target.closest('form');if(f&&eligible(f))save(f,false,event.target.type==='file');});
  document.addEventListener('click',event=>{const b=event.target.closest('button'),f=b?.closest('form');if(b&&f&&!b.closest('.draft-notice')&&b.type!=='submit'&&metadata.get(f)?.dirty)setTimeout(()=>save(f),0);});
  document.addEventListener('reset',event=>{const meta=metadata.get(event.target);if(meta){meta.completed=false;meta.dirty=false;meta.uncertain=false;meta.attempted=false;setTimeout(()=>paint(meta.key),0);}},true);
  document.addEventListener('submit',event=>{const f=event.target;if(!eligible(f))return;const meta=attach(f);if(meta?.uncertain){event.preventDefault();event.stopImmediatePropagation();config.notify?.('L’envoi précédent peut avoir réussi. Vérifiez le dossier ou l’historique avant une nouvelle saisie.',true);return;}save(f,true);},true);
  window.addEventListener('beforeunload',event=>{if(pendingWrites||[...records.values()].some(r=>r.textError||r.fileError||r.submitted)){event.preventDefault();event.returnValue='';}});
 }
 return {init,complete,purge,checkpoint:f=>save(f),get restoring(){return restoring;},show:showHub};
})();
