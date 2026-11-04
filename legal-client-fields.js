/* Collect only the personal blanks present in the supplied driver contract. */
(()=>{
 function init(){const form=document.getElementById('serviceApplicationForm'),service=document.getElementById('selectedService')?.value;if(!form||!['Recrutement','Recrutement Chauffeur'].includes(service))return;
  const fields=[['birthPlace','Lieu de naissance','text'],['birthDate','Date de naissance','date'],['nationality','Nationalité','text'],['idNumber','Numéro de pièce d’identité','text'],['licenseNumber','Numéro du permis de conduire','text'],['licenseCategory','Catégorie du permis','text'],['addressNumber','Numéro de résidence','text'],['addressAvenue','Avenue / rue','text'],['addressQuarter','Quartier','text']];
  for(const [key,label,type] of fields){const box=document.createElement('div'),id='legal_'+key;box.innerHTML='<label for="'+id+'">'+label+' *</label><input id="'+id+'" name="'+key+'" type="'+type+'" required maxlength="120" class="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white">';const input=box.querySelector('input');if(type==='date')input.max=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Kinshasa',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());form.querySelector('[type=submit]').before(box);}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
