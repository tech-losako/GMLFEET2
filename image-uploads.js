/* Prepare camera files locally; upload endpoints still validate the resulting bytes. */
window.GMFleetImages=(()=>{
 const states=new WeakMap(),bound=new WeakSet(),limit=40*1024*1024,target=1500000;
 let decoder,queue=Promise.resolve();
 const eligible=i=>i instanceof HTMLInputElement&&i.type==='file'&&/image\//.test(i.accept);
 const signature=b=>b[0]===255&&b[1]===216&&b[2]===255?'image/jpeg':b.slice(0,8).join(',')==='137,80,78,71,13,10,26,10'?'image/png':String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP'?'image/webp':String.fromCharCode(...b.slice(0,5))==='%PDF-'?'application/pdf':String.fromCharCode(...b.slice(4,8))==='ftyp'&&/heic|heix|hevc|hevx|mif1|msf1/.test(String.fromCharCode(...b.slice(8)))?'image/heic':'';
 const name=(f,ext)=>((f.name||'photo').replace(/\.[^.]*$/,'')||'photo')+'.'+ext;
 function loadDecoder(){
  if(window.HeicTo)return Promise.resolve(window.HeicTo);
  if(!decoder)decoder=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/vendor/heic-to-1.6.7.js';const timer=setTimeout(()=>{script.remove();decoder=null;reject(Error('Conversion indisponible. Réessayez avec une connexion stable.'));},45000);script.onload=()=>{clearTimeout(timer);if(window.HeicTo)resolve(window.HeicTo);else{decoder=null;reject(Error('Conversion HEIC indisponible.'));}};script.onerror=()=>{clearTimeout(timer);script.remove();decoder=null;reject(Error('Conversion indisponible. Réessayez avec une connexion stable.'));};document.head.append(script);});
  return decoder;
 }
 function image(blob){return new Promise((resolve,reject)=>{const url=URL.createObjectURL(blob),img=new Image(),timer=setTimeout(()=>end(false),20000);function end(ok){clearTimeout(timer);URL.revokeObjectURL(url);img.onload=img.onerror=null;if(ok)resolve(img);else reject(Error('Photo illisible. Reprenez-la ou choisissez une autre photo.'));}img.onload=()=>end(true);img.onerror=()=>end(false);img.src=url;});}
 async function jpeg(blob){
  const img=await image(blob);if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth*img.naturalHeight>80000000)throw Error('Photo trop grande. Choisissez une résolution plus basse.');
  const scale=Math.min(1,2560/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
  try{const ctx=canvas.getContext('2d');if(!ctx)throw Error('Préparation de la photo indisponible.');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);let result;for(const quality of [.88,.76,.62,.48]){result=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));if(!result)throw Error('La photo ne peut pas être préparée.');if(result.size<=target)break;}if(result.size>8*1024*1024)throw Error('Photo trop volumineuse. Choisissez une résolution plus basse.');return result;}finally{canvas.width=canvas.height=1;}
 }
 async function convert(file){
  if(!file?.size)throw Error('La photo est vide. Reprenez-la, puis validez-la dans l’appareil photo.');
  if(file.size>limit)throw Error('Photo trop volumineuse (40 Mo maximum avant préparation).');
  const type=signature(new Uint8Array(await file.slice(0,64).arrayBuffer())),declared=file.type.toLowerCase().replace('image/jpg','image/jpeg');
  if(!type)throw Error('Format illisible. Choisissez une photo JPG, PNG, WebP ou HEIC, ou un PDF.');
  if(['image/jpeg','image/png','image/webp','application/pdf'].includes(declared)&&declared!==type)throw Error('Le contenu du fichier ne correspond pas à son format. Choisissez une autre photo.');
  if(type==='application/pdf'){if(file.size>10*1024*1024)throw Error('PDF : 10 Mo maximum.');return declared===type?file:new File([file],name(file,'pdf'),{type,lastModified:file.lastModified});}
  let blob=file;
  if(type==='image/heic'){
   try{blob=await jpeg(file);}catch{const codec=await loadDecoder();blob=await codec({blob:file,type:'image/jpeg',quality:.9});}
  }
  if(type==='image/heic'||blob.size>target){blob=await jpeg(blob);return new File([blob],name(file,'jpg'),{type:'image/jpeg',lastModified:file.lastModified});}
  const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[type];return declared===type&&file.name?file:new File([file],name(file,ext),{type,lastModified:file.lastModified});
 }
 function prepare(file){const result=queue.then(()=>convert(file));queue=result.catch(()=>{});return result;}
 function status(i){let box=i.nextElementSibling;if(!box?.hasAttribute('data-image-upload-status')){box=document.createElement('small');box.dataset.imageUploadStatus='';box.className='pub-file-info';box.setAttribute('aria-live','polite');i.after(box);}box.removeAttribute('role');box.classList.remove('pub-form-error');return box;}
 function bind(root=document){for(const i of root.querySelectorAll('input[type=file]'))if(eligible(i)&&!bound.has(i)){bound.add(i);i.accept=['image/*',...i.accept.split(',').map(x=>x.trim()).filter(x=>x&&!x.startsWith('image/'))].join(',');}}
 const same=(a,b)=>a.length===b.length&&a.every((f,n)=>f===b[n]);
 function files(i){if(!i)return [];const native=[...i.files||[]],s=states.get(i);return s&&same(native,s.selected)&&s.files?s.files:native;}
 async function ready(form){for(const i of form.querySelectorAll('input[type=file]')){const s=states.get(i);if(s){await s.promise;if(s.error)throw s.error;}}}
 document.addEventListener('change',ev=>{
  const i=ev.target;if(ev.gmfleetPrepared||!eligible(i))return;
  ev.stopImmediatePropagation();const selected=[...i.files||[]],box=status(i),s={selected,files:null,error:null,promise:null};states.set(i,s);i.setCustomValidity('');
  if(!selected.length){box.textContent='Aucune photo sélectionnée.';i.dispatchEvent(Object.assign(new Event('change',{bubbles:true}),{gmfleetPrepared:true}));return;}
  i.setCustomValidity('Préparation de la photo en cours.');i.setAttribute('aria-busy','true');box.textContent='Préparation de la photo…';
  s.promise=(async()=>{try{
   const prepared=[];for(const f of selected)prepared.push(await prepare(f));
   if(states.get(i)!==s||!same([...i.files||[]],selected))return;
   s.files=prepared;try{const transfer=new DataTransfer();prepared.forEach(f=>transfer.items.add(f));i.files=transfer.files;s.selected=[...i.files];}catch{/* Some mobile browsers make FileList read-only; readers use the prepared-file cache. */}
   i.setCustomValidity('');box.textContent=prepared.map(f=>f.name+' · '+(f.size/1024/1024).toFixed(1)+' Mo · prêt à envoyer').join(' / ');
   i.dispatchEvent(Object.assign(new Event('change',{bubbles:true}),{gmfleetPrepared:true}));
  }catch(error){if(states.get(i)!==s)return;s.error=error;i.setCustomValidity(error.message);box.textContent=error.message;box.classList.add('pub-form-error');box.setAttribute('role','alert');i.closest('[data-photo-frame]')?.classList.add('invalid');}
  finally{if(states.get(i)===s)i.removeAttribute('aria-busy');}})();
 },true);
 document.addEventListener('reset',ev=>{for(const i of ev.target.querySelectorAll?.('input[type=file]')||[]){states.delete(i);i.setCustomValidity('');i.removeAttribute('aria-busy');const box=i.nextElementSibling;if(box?.hasAttribute('data-image-upload-status'))box.textContent='';}},true);
 function start(){bind();new MutationObserver(records=>{for(const r of records)for(const node of r.addedNodes)if(node.nodeType===1){if(node.matches('input[type=file]'))bind(node.parentElement);else bind(node);}}).observe(document.body,{childList:true,subtree:true});}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
 return {prepare,files,ready};
})();
