/* A dedicated equipment enquiry, stored for staff follow-up; no automatic email promise. */
(() => {
 let dialog;
 window.openEquipmentQuote=product=>{
  if(!dialog){
   dialog=document.createElement('dialog');dialog.className='equipment-quote';dialog.setAttribute('aria-labelledby','quote-title');
   dialog.innerHTML=`<button class="equipment-quote-close" type="button" aria-label="Fermer">×</button><p class="pub-eyebrow">VOTRE DEVIS PERSONNALISÉ</p><h2 id="quote-title">Équipons votre véhicule.</h2><p>Indiquez vos besoins. Notre équipe vous contactera et préparera un devis détaillé à votre adresse e-mail.</p><form><label>Nom complet<input name="name" autocomplete="name" maxlength="200" required></label><label>E-mail pour le devis<input name="email" type="email" autocomplete="email" maxlength="254" required></label><label>Téléphone / WhatsApp<input name="phone" type="tel" autocomplete="tel" maxlength="40" required></label><label>Ville / commune<input name="city" autocomplete="address-level2" maxlength="200" required></label><label>Équipement souhaité<select name="equipment"><option value="gps">Tracker GPS</option><option value="dashcam">Dashcam</option><option value="both">Tracker GPS + dashcam</option></select></label><label>Type de véhicule<select name="vehicle_type" required><option value="">Choisir</option><option>Voiture</option><option>Jeep / SUV</option><option>Camion</option><option>Bus / minibus</option><option>Moto</option><option>Autre</option></select></label><label>Marque et modèle<input name="model" maxlength="200" placeholder="Ex. Toyota Vitz" required></label><label>Nombre de véhicules<input name="quantity" type="number" min="1" max="1000" value="1" required></label><label class="wide">Vos besoins (facultatif)<textarea name="message" rows="2" maxlength="2000" placeholder="Suivi GPS, caméras supplémentaires, gestion de plusieurs véhicules…"></textarea></label><p class="quote-consent wide">Vos coordonnées seront utilisées par GML pour traiter cette demande. Le devis précisera le matériel, l’installation, l’abonnement et les options compatibles.</p><p class="wide" role="alert"></p><button class="pub-button primary wide" type="submit">Recevoir mon devis</button></form><p role="status" hidden></p>`;
   document.body.append(dialog);dialog.querySelector('.equipment-quote-close').onclick=()=>dialog.close();
   let requestId=crypto.randomUUID(),lastPayload='';
   dialog.querySelector('form').onsubmit=async e=>{
    e.preventDefault();const form=e.currentTarget;if(form.getAttribute('aria-busy')==='true'||!form.reportValidity())return;
    const payload=Object.fromEntries(new FormData(form));payload.quantity=Number(payload.quantity);
    const serialized=JSON.stringify(payload);if(lastPayload&&lastPayload!==serialized)requestId=crypto.randomUUID();lastPayload=serialized;
    const button=form.querySelector('[type=submit]'),error=form.querySelector('[role=alert]');error.textContent='';form.setAttribute('aria-busy','true');button.disabled=true;button.textContent='Envoi…';
    try{
     const db=window.GMFleetBackend?.client;if(!db)throw Error('Service indisponible. Réessayez dans un instant.');
     const result=await db.rpc('submit_equipment_quote',{request_id:requestId,p:payload});if(result.error)throw result.error;if(result.data?.success!==true)throw Error('Envoi non confirmé. Réessayez.');
     form.hidden=true;const status=dialog.querySelector('[role=status]');status.hidden=false;status.textContent='Demande reçue. Notre équipe examinera votre besoin et vous contactera pour préparer votre devis par e-mail.';status.tabIndex=-1;status.focus();
    }catch(ex){error.textContent=ex.message||'Envoi interrompu. Vos informations sont conservées : réessayez.';}finally{form.setAttribute('aria-busy','false');button.disabled=false;button.textContent='Recevoir mon devis';}
   };
  }
  const form=dialog.querySelector('form');if(form.hidden){form.reset();form.hidden=false;dialog.querySelector('[role=status]').hidden=true;dialog.remove();dialog=null;return window.openEquipmentQuote(product);}
  form.elements.equipment.value=product;dialog.showModal();
 };
})();
