/* Equipment orders share the public confirmation and receipt pipeline. */
(() => {
 let dialog;
 const scripts={
  pdf:'/vendor/jspdf-4.2.1.umd.min.js',
  receipt:'/request-receipt.js?v=20261001-request-confirmation'
 };
 const loadScript=src=>new Promise((resolve,reject)=>{
  const existing=[...document.scripts].find(script=>script.src.includes(src.split('?')[0]));
  if(existing){if(existing.dataset.loaded==='true'||(src===scripts.pdf&&window.jspdf)||(src===scripts.receipt&&window.GMFleetRequestReceipt))return resolve();existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return;}
  const script=document.createElement('script');script.src=src;script.onload=()=>{script.dataset.loaded='true';resolve();};script.onerror=reject;document.head.append(script);
 });
 const ensureReceipt=async()=>{if(!window.jspdf)await loadScript(scripts.pdf);if(!window.GMFleetRequestReceipt)await loadScript(scripts.receipt);};
 const labels={gps:'Tracker GPS',dashcam:'Dashcam V7 Pro',both:'Tracker GPS + Dashcam V7 Pro'};
 const errorMessage=async error=>{let message='Envoi interrompu. Vos informations sont conservées : réessayez.';try{message=(await error.context.json()).error||message;}catch{}return error.message&&error.message!=='Edge Function returned a non-2xx status code'?error.message:message;};

 window.openEquipmentQuote=product=>{
  if(!dialog){
   dialog=document.createElement('dialog');dialog.className='equipment-quote';dialog.setAttribute('aria-labelledby','quote-title');
   dialog.innerHTML=`<button class="equipment-quote-close" type="button" aria-label="Fermer">×</button><p class="pub-eyebrow">VOTRE DEVIS PERSONNALISÉ</p><h2 id="quote-title">Équipons votre véhicule.</h2><p>Indiquez vos besoins. Un professionnel GM Fleet vous contactera pour préciser votre demande, confirmer le devis et planifier l’installation.</p><form><label>Nom complet<input name="name" autocomplete="name" maxlength="200" required></label><label>E-mail pour le devis<input name="email" type="email" autocomplete="email" maxlength="254" required></label><label>Téléphone / WhatsApp<input name="phone" type="tel" autocomplete="tel-national" inputmode="numeric" minlength="9" maxlength="9" pattern="[0-9]{9}" required></label><label>Ville / commune<input name="city" autocomplete="address-level2" maxlength="200" required></label><label>Équipement souhaité<select name="equipment"><option value="gps">Tracker GPS</option><option value="dashcam">Dashcam</option><option value="both">Tracker GPS + dashcam</option></select></label><label>Type de véhicule<select name="vehicle_type" required><option value="">Choisir</option><option>Voiture</option><option>Jeep / SUV</option><option>Camion</option><option>Bus / minibus</option><option>Moto</option><option>Autre</option></select></label><label>Marque et modèle<input name="model" maxlength="200" placeholder="Ex. Toyota Vitz" required></label><label>Nombre de véhicules<input name="quantity" type="number" min="1" max="1000" value="1" required></label><label class="wide">Vos besoins (facultatif)<textarea name="message" rows="2" maxlength="2000" placeholder="Suivi GPS, caméras supplémentaires, gestion de plusieurs véhicules…"></textarea></label><p class="quote-consent wide">Vos coordonnées seront utilisées par GML pour traiter cette demande. Le devis précisera le matériel, l’installation, l’abonnement et les options compatibles.</p><p class="wide" role="alert"></p><button class="pub-button primary wide" type="submit">Recevoir mon devis</button></form><p role="status" hidden></p>`;
   document.body.append(dialog);dialog.querySelector('.equipment-quote-close').onclick=()=>dialog.close();
   window.GMFleetPhoneInput?.enhance(dialog.querySelector('[name=phone]'));
   let requestId=crypto.randomUUID(),lastPayload='';
   dialog.querySelector('form').onsubmit=async e=>{
    e.preventDefault();const form=e.currentTarget;if(form.getAttribute('aria-busy')==='true'||!form.reportValidity())return;
    const payload=Object.fromEntries(new FormData(form));payload.phone=window.GMFleetPhoneInput?.value(form.elements.phone)||'';payload.quantity=Number(payload.quantity);
    if(!payload.phone){form.elements.phone.setCustomValidity('Saisissez exactement 9 chiffres après +243.');form.elements.phone.reportValidity();form.elements.phone.setCustomValidity('');return;}
    const serialized=JSON.stringify(payload);if(lastPayload&&lastPayload!==serialized)requestId=crypto.randomUUID();lastPayload=serialized;
    const button=form.querySelector('[type=submit]'),error=form.querySelector('[role=alert]');error.textContent='';form.setAttribute('aria-busy','true');button.disabled=true;button.textContent='Envoi…';
    try{
     const db=window.GMFleetBackend?.client;if(!db)throw Error('Service indisponible. Réessayez dans un instant.');
     const result=await db.functions.invoke('submit-equipment-quote',{body:{request_id:requestId,p:payload}});if(result.error)throw result.error;if(result.data?.success!==true)throw Error(result.data?.error||'Envoi non confirmé. Réessayez.');
     form.hidden=true;const status=dialog.querySelector('[role=status]');status.hidden=false;status.textContent='Commande reçue. Un professionnel GM Fleet vous contactera pour préciser votre besoin, confirmer le devis et planifier l’installation.';status.tabIndex=-1;status.focus();
     await ensureReceipt();window.GMFleetRequestReceipt.present(dialog,{reference:result.data.reference,submittedAt:result.data.submitted_at,smsStatus:result.data.sms_status,category:'Commande d’équipement',title:'Récépissé de commande',fields:[{label:'Nom complet',value:payload.name},{label:'Téléphone / WhatsApp',value:payload.phone},{label:'E-mail',value:payload.email},{label:'Ville / commune',value:payload.city},{label:'Équipement',value:labels[payload.equipment]},{label:'Type de véhicule',value:payload.vehicle_type},{label:'Marque et modèle',value:payload.model},{label:'Nombre de véhicules',value:payload.quantity},{label:'Besoins indiqués',value:payload.message}]});
    }catch(ex){error.textContent=await errorMessage(ex);}finally{form.setAttribute('aria-busy','false');button.disabled=false;button.textContent='Recevoir mon devis';}
   };
  }
  const form=dialog.querySelector('form');if(form.hidden){form.reset();form.hidden=false;dialog.querySelector('[role=status]').hidden=true;dialog.querySelector('.request-confirmation')?.remove();dialog.remove();dialog=null;return window.openEquipmentQuote(product);}
  form.elements.equipment.value=product;dialog.showModal();
 };
})();
