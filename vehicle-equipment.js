/* Current equipment, with signed contract details as a fallback for older vehicles. */
window.GMFleetVehicleEquipment=(()=>{
 function details(v,c,a,escape){
  const saved=c?.vehicle_snapshot||{},equipment={...saved.equipment,...a?.preparation?.equipment},e=escape;
  const row=(label,value)=>`<div><dt>${e(label)}</dt><dd>${e(value||'Non renseigné')}</dd></div>`;
  const camera=equipment.equipment_package==='tracker_camera'||equipment.dashcam_id;
  return `<h3>Véhicule · équipements & SIM</h3><dl class="details">${[['Modèle',v.model||saved.model],['Plaque',v.plate||saved.plate],['Châssis / VIN',v.vin||saved.vin],['Identifiant tracker',equipment.tracker_id||v.tracker_id||saved.tracker_id],['Téléphone SIM du tracker',equipment.sim_number],['Opérateur SIM du tracker',equipment.sim_operator],['ICCID SIM du tracker',equipment.sim_iccid],['Identifiant caméra',equipment.dashcam_id||'Non renseigné'],...(camera?[['Téléphone SIM de la caméra',equipment.dashcam_sim_number],['Opérateur SIM de la caméra',equipment.dashcam_sim_operator],['ICCID SIM de la caméra',equipment.dashcam_sim_iccid]]:[])].map(([k,value])=>row(k,value)).join('')}</dl>${!equipment.sim_number?'<p class="section-note">Les détails SIM du tracker n’ont pas encore été renseignés. Aucun numéro n’est déduit de son identifiant.</p>':''}`;
 }
 function open(v,c,a,escape){
  let dialog=document.getElementById('vehicleEquipmentDialog');
  if(!dialog){dialog=document.createElement('dialog');dialog.id='vehicleEquipmentDialog';dialog.className='case-dialog';document.body.append(dialog);}
  dialog.innerHTML=`<div class="dialog-title"><h2>Fiche véhicule · ${escape(v.plate||v.model)}</h2><button type="button" class="secondary" aria-label="Fermer la fiche véhicule">Fermer</button></div>${details(v,c,a,escape)}`;
  dialog.querySelector('button').onclick=()=>dialog.close();dialog.showModal();
 }
 return {details,open};
})();
