/* Private PDF snapshots, shared by expiring SMS link. A download is never a signature. */
window.GMFleetContractSharing=(()=>{
 async function send(a,c,request={}){
  if(!['FLEET_OWNER','PARTNER_DRIVER','YANGO'].includes(a.program_type))return {skipped:true};
  request.id??=crypto.randomUUID();
  const path=a.id+'/'+request.id+'.pdf';
  if(!request.uploaded){
   const [contracts,vehicles,mandates]=await Promise.all([c.rows('contracts',q=>q.eq('application_id',a.id)),c.rows('vehicles'),a.program_type==='FLEET_OWNER'?c.rows('fleet_mandates',q=>q.eq('owner_application_id',a.id)):Promise.resolve([])]);
   const ct=contracts.filter(x=>x.status==='active').sort((x,y)=>String(y.start_date).localeCompare(String(x.start_date)))[0],m=mandates.slice().sort((x,y)=>String(y.created_at).localeCompare(String(x.created_at)))[0],v=vehicles.find(x=>x.id===(ct?.vehicle_id||m?.vehicle_id))||vehicles.find(x=>x.owner_application_id===a.id);
   const pdf=(await window.GMFleetContracts.create(a,ct,v,m)).output('blob');
   const {error}=await c.db.storage.from('contract-copies').upload(path,pdf,{contentType:'application/pdf',upsert:false});if(error)throw error;request.uploaded=true;
  }
  const {data,error}=await c.db.functions.invoke('contract-copy',{body:{action:'send',application_id:a.id,request_id:request.id,object_path:path}});
  if(error)throw Error('Envoi du contrat interrompu. Consultez SMS & notifications avant de recommencer.');if(data?.error)throw Error(data.error);
  return data;
 }
 function status(result){return result?.skipped?'Modèle de contrat à fournir.':['accepted','sent','delivered'].includes(result?.sms_status)?'Copie du contrat transmise par SMS · lien valable 7 jours.':'Contrat enregistré ; SMS '+(result?.sms_status||'à vérifier')+'. '+(result?.sms_error||'Consultez SMS & notifications.');}
 async function sendAll(applications,c){
  const messages=[],failures=[];
  for(const a of applications){try{const result=await send(a,c);if(!['accepted','sent','delivered'].includes(result?.sms_status))failures.push(a.name+' : '+status(result));else messages.push(a.name);}catch(error){failures.push(a.name+' : '+error.message);}}
  return {message:(messages.length?'Copie SMS transmise pour '+messages.join(', ')+'. ':'')+(failures.length?'Copie à compléter / renvoyer : '+failures.join(' · '):''),failed:failures.length>0};
 }
 function mount(host,a,c){if(!['FLEET_OWNER','PARTNER_DRIVER','YANGO'].includes(a.program_type))return;const b=document.createElement('button'),p=document.createElement('p');b.type='button';b.className='secondary';b.textContent='Envoyer une copie à signer par SMS';p.className='muted';p.setAttribute('role','status');host.append(b,p);let request={};b.onclick=async()=>{b.disabled=true;try{const result=await send(a,c,request);p.textContent=status(result);if(['accepted','sent','delivered'].includes(result?.sms_status))b.textContent='Copie transmise par SMS';else if(result?.sms_status==='failed'||result?.sms_status==='not_configured'){request={};b.disabled=false;}}catch(e){p.textContent=e.message;b.disabled=false;}};}
 return {send,status,mount,sendAll};
})();
