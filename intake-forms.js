/* Only fields relevant to the selected programme enter FormData. */
window.GMFleetIntake=(()=>{
 const groups={DRIVE_TO_OWN:['birth_date','experience','licenseNumber','vehicle','duration','co_borrower_name','co_borrower_phone','co_borrower_address','initialDeposit','idNumber'],PARTNER_DRIVER:['birth_date','experience','licenseNumber','idNumber'],FLEET_OWNER:['vehicle','carPlate','carBrand','carYear','carChassis','kinshasaRegisteredOn','idNumber'],YANGO:['birth_date','experience','licenseNumber','vehicle','carPlate','carBrand','carYear','yangoStatus','idNumber']};
 function init(form){
  const fields=form.querySelector('.fields');
  const definitions=[['idNumber','Pièce d’identité / RCCM','text'],['initialDeposit','Apport / dépôt initial déclaré (USD)','number'],['carBrand','Marque du véhicule','text'],['carYear','Année du véhicule','number'],['carChassis','Châssis / VIN','text'],['kinshasaRegisteredOn','Première immatriculation à Kinshasa','date']];
  for(const [name,label,type] of definitions){const el=document.createElement('label');el.textContent=label;const input=document.createElement('input');input.name=name;input.type=type;input.maxLength=150;if(name==='initialDeposit'){input.min='0';input.max='1000000';input.step='0.01';}if(name==='carYear'){input.min='1950';input.max=String(new Date().getFullYear()+1);input.step='1';}el.append(input);fields.append(el);}
  const note=document.createElement('p');note.className='section-note';note.id='intakeProgrammeNote';fields.before(note);
  update(form);
 }
 function update(form){const program=form.elements.program.value,allowed=groups[program]||[],names=[...new Set(Object.values(groups).flat())];for(const name of names){const input=form.elements.namedItem(name);if(!input)continue;const shown=allowed.includes(name);input.closest('label').hidden=!shown;input.disabled=!shown;input.required=shown&&name==='vehicle'&&['FLEET_OWNER','YANGO','DRIVE_TO_OWN'].includes(program);}
  const vehicle=form.elements.vehicle;if(vehicle)vehicle.closest('label').firstChild.textContent=program==='DRIVE_TO_OWN'?'Véhicule souhaité *':'Modèle du véhicule *';
  const notes={DRIVE_TO_OWN:'Car na ngai · candidat au financement LOLC, véhicule souhaité et co-emprunteur. L’apport déclaré ne crée aucun encaissement.',PARTNER_DRIVER:'Chauffeur partenaire · identité, permis et expérience. Le véhicule sera affecté depuis la flotte après validation.',FLEET_OWNER:'Propriétaire · identité du propriétaire et véhicule confié à GM Fleet. Les contrôles, avances et conditions du mandat seront confirmés dans le dossier.',YANGO:'Partenaire Yango · chauffeur avec son véhicule et situation de rattachement Yango.'};document.getElementById('intakeProgrammeNote').textContent=notes[program];
 }
 return {init,update};
})();
