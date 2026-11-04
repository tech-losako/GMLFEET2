/* Fill only the original contract's blanks. Original clauses, pagination and signature areas stay in place. */
window.GMFleetLegalPDF=(()=>{
 const originals={FLEET_OWNER:{url:'/legal-templates/owner-v3.pdf',pages:7,source:'Contrat_Gestion_Vehicule_Proprietaire_GM_Fleet_v3.pdf'},PARTNER_DRIVER:{url:'/legal-templates/driver-v4.pdf',pages:8,source:'Contrat_Prestation_de_service_du_Chauffeur_GM_Fleet_v4.pdf'}};
 const labels={name:'Nom complet / raison sociale',address:'Adresse',phone:'Téléphone',email:'E-mail',idNumber:'Numéro de pièce d’identité / RCCM',carBrand:'Marque du véhicule',carModel:'Modèle du véhicule',carPlate:'Immatriculation',carYear:'Année du véhicule',carChassis:'Châssis / VIN',birthPlace:'Lieu de naissance',birthDate:'Date de naissance',nationality:'Nationalité',addressNumber:'Numéro de résidence',addressAvenue:'Avenue / rue',addressQuarter:'Quartier',addressCommune:'Commune',licenseNumber:'Numéro de permis',licenseCategory:'Catégorie du permis'};
 const requirements={FLEET_OWNER:['name','address','phone','email','idNumber','carBrand','carModel','carPlate','carYear','carChassis'],PARTNER_DRIVER:['name','birthPlace','birthDate','nationality','addressNumber','addressAvenue','addressQuarter','addressCommune','phone','idNumber','licenseNumber','licenseCategory']};
 const clean=v=>String(v??'').normalize('NFC').replace(/[\u0000-\u001f\u00a0\u202f]/g,' ').trim();
 const date=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))?v.split('-').reverse().join('/'):clean(v);
 function values(a={},c=null,v=null,m=null){const s=a.service_details||{},vehicle=v||a.preparation?.purchased_vehicle||{},data={...s,name:a.name,address:a.address,phone:a.phone,email:a.email||s.email,idNumber:s.idNumber||a.id_number,birthDate:a.birth_date||s.birthDate,birthPlace:s.birthPlace||a.birth_place,nationality:s.nationality||a.nationality,licenseNumber:s.licenseNumber||a.license_number,licenseCategory:s.licenseCategory||a.license_category,carBrand:s.carBrand||vehicle.brand,carModel:vehicle.model||s.carModel,carPlate:vehicle.plate||s.carPlate,carYear:s.carYear||vehicle.year,carChassis:vehicle.vin||vehicle.chassis||s.carChassis,contractDate:m?.signed_on||c?.command_payload?.signed_on||''};return Object.fromEntries(Object.entries(data).map(([k,v])=>[k,clean(v)]));}
 function missing(a,c,v,m){const type=a.program_type||c?.contract_type,data=values(a,c,v,m);return (requirements[type]||[]).filter(k=>!data[k]).map(k=>({key:k,label:type==='PARTNER_DRIVER'&&k==='idNumber'?'Numéro de pièce d’identité':labels[k]}));}
 function model(a,c,v,m){const type=a.program_type||c?.contract_type,data=values(a,c,v,m);return {type,name:a.name,reference:c?.signed_reference||m?.reference||a.case_reference||'DOSSIER-'+a.id,template:window.GMFleetContractTemplates?.[type],fields:(requirements[type]||[]).map(k=>[type==='PARTNER_DRIVER'&&k==='idNumber'?'Numéro de pièce d’identité':labels[k],data[k]]),data,missing:missing(a,c,v,m)};}
 // Coordinates use the supplied PDF's top-left page origin, in points.
 const zones={FLEET_OWNER:[
  [0,'contractDate',149.8,152.7,80.5,10,'date'],[0,'name',326.8,162.5,215,9],
  [0,'name',205.2,322.7,200.4,11],[0,'address',153.2,337.1,270.5,11],[0,'phone',160.2,351.5,100.2,11],[0,'email',295.8,351.5,205,11],
  [0,'idNumber',227,366,175.3,11],[0,'carBrand',198.7,380.4,85.2,11],[0,'carModel',323.3,380.4,150,11],[0,'carPlate',199.2,394.9,100.2,11],
  [0,'carYear',113.2,405.3,75.2,10],[0,'carChassis',113.2,415.6,235.4,10],[0,'',113.2,425.9,20.1,10],
  [5,'email',217.2,201.6,190,10],[5,'phone',246.7,212,120,11],[5,'contractDate',189.2,517,150,11,'date'],
  [6,'name',410,108.7,165,10],[6,'idNumber',440,137.1,135,10]
 ],PARTNER_DRIVER:[
  [0,'contractDate',149.9,182.3,80.4,10,'date'],[0,'name',322.6,193.5,215,9],
  [0,'name',194.7,364.5,230.5,11],[0,'birthPlace',150.2,380.6,140.2,11],[0,'birthDate',307.4,380.6,90.2,11,'date'],
  [0,'nationality',175.2,396.7,230.5,11],[0,'addressNumber',174.3,412.8,30,11],[0,'addressAvenue',246.3,412.8,155.4,11],
  [0,'addressQuarter',152.7,428.9,100.2,11],[0,'addressCommune',306.8,428.9,95.3,11],[0,'phone',160.2,445,90.3,11],[0,'idNumber',332.6,445,155,11],
  [0,'licenseNumber',209.3,461.1,90.3,11],[0,'licenseCategory',113.2,473.1,40.2,11],
  [6,'contractDate',189.2,574.1,150,11,'date'],[6,'name',410,678.5,165,11],[6,'idNumber',459,706.9,116,11]
 ]};
 async function create(a,c,v,m,options={}){
  const data=model(a,c,v,m),config=originals[data.type];if(!config)throw Error('Modèle juridique indisponible');
  if(data.missing.length&&!options.allowIncompletePreview)throw Error('Informations nécessaires au contrat : '+data.missing.map(x=>x.label).join(', ')+'. Complétez la fiche client.');
  if(!window.PDFLib)throw Error('Lecteur des modèles PDF indisponible. Actualisez la page.');
  const response=await fetch(config.url,{cache:'no-cache'});if(!response.ok)throw Error('Modèle PDF original indisponible');const bytes=await response.arrayBuffer();
  const {PDFDocument,StandardFonts,rgb}=window.PDFLib,doc=await PDFDocument.load(bytes,{updateMetadata:false});if(doc.getPageCount()!==config.pages)throw Error('Pagination du modèle original inattendue');const font=await doc.embedFont(StandardFonts.Helvetica);
  for(const [pageIndex,key,x,top,width,height,format] of zones[data.type]){
   let text=key?data.data[key]:'';if(key&&!text)continue;if(format==='date')text=date(text);const page=doc.getPage(pageIndex);let size=9;
   if(text){try{while(font.widthOfTextAtSize(text,size)>width-3&&size>6)size-=.2;if(font.widthOfTextAtSize(text,size)>width-3)throw Error('long');}catch(error){throw Error('Le champ « '+(labels[key]||key)+' » ne tient pas dans le cadre du contrat original. Vérifiez sa longueur et ses caractères.');}}
   page.drawRectangle({x,y:page.getHeight()-top-height,width,height,color:rgb(1,1,1)});
   if(text)page.drawText(text,{x:x+1.5,y:page.getHeight()-top-8.2,size,font,color:rgb(0,0,0)});
  }
  doc.setTitle(config.source.replace('.pdf','')+' · '+data.reference);doc.setSubject('Contrat prérempli depuis le modèle original fourni');
  const result=await doc.save(),blob=new Blob([result],{type:'application/pdf'});
  return {source:config.source,pages:config.pages,output(type){if(type==='blob')return blob;if(type==='arraybuffer')return result.buffer.slice(result.byteOffset,result.byteOffset+result.byteLength);let str='';for(let i=0;i<result.length;i+=8192)str+=String.fromCharCode(...result.subarray(i,i+8192));return 'data:application/pdf;base64,'+btoa(str);},save(filename){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}};
 }
 return {create,model,values,missing,requirements,labels,originals};
})();
