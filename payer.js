(() => {
 const $=id=>document.getElementById(id),config=window.GMFLEET_SUPABASE_CONFIG;
 const db=window.supabase.createClient(config.url,config.anonKey,{auth:{persistSession:false,detectSessionInUrl:false}});
 window.addEventListener('hashchange',()=>{if(new URLSearchParams(location.hash.slice(1)).get('token'))location.reload();});
 const supplied=new URLSearchParams(location.hash.slice(1)).get('token');
 if(supplied&&/^[a-f0-9]{64}$/.test(supplied))sessionStorage.setItem('gmfleet_payment_link',supplied);
 history.replaceState(null,'',location.pathname);
 let token=supplied||sessionStorage.getItem('gmfleet_payment_link');
 const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=(n,c)=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:c}).format(Number(n));
 const labels={pending:'En attente de confirmation',approved:'Paiement confirmé',declined:'Paiement refusé',review:'Paiement reçu — rapprochement par GM Fleet requis'};
 let current,polling=false,requestId=crypto.randomUUID();
 async function call(action,extra={}){const {data,error}=await db.functions.invoke('araka-payments',{body:{action,token,...extra}});if(error){let message='Connexion interrompue. Vérifiez le statut avant de recommencer.';try{message=(await error.context.json()).error||message;}catch{}throw new Error(message);}if(data.error)throw new Error(data.error);return data;}
 function paint(data){
  current=data;const unresolved=data.attempts.find(a=>['pending','review'].includes(a.state));
  $('paymentNotice').textContent='Bonjour '+data.driver_name;
  $('paymentContent').innerHTML=`<section class="card"><p><strong>Véhicule : ${escape(data.vehicle?.model||'À préciser')}</strong> · ${escape(data.vehicle?.plate||'')}</p><button id="changeDriver" class="link-button">Changer de chauffeur</button><div class="stats"><div class="stat"><span>À régler à ce jour</span><strong>${money(data.due,data.currency)}</strong></div><div class="stat"><span>Versement quotidien</span><strong>${money(data.daily_amount,data.currency)}</strong></div></div>${unresolved?`<p class="section-note">${escape(labels[unresolved.state])}. Référence : ${escape(unresolved.reference)}. ${unresolved.state==='pending'?'Validez sur votre téléphone si une demande apparaît. Ne lancez pas un deuxième paiement.':'Contactez la caisse GM Fleet pour le rapprochement.'}</p><button id="checkPayment" class="primary">Vérifier le statut</button>`:Number(data.total_remaining)>0?`<form id="driverPayForm"><div class="fields"><label>Versement au contrat (${escape(data.currency)})<input name="amount" type="number" step="0.01" min="0.01" max="${Number(data.total_remaining)}" value="${Math.min(Number(data.total_remaining),Number(data.due)||Number(data.daily_amount)).toFixed(2)}" required></label><label>Opérateur<select name="provider"><option value="MPESA">M-Pesa</option><option value="AIRTEL">Airtel Money</option><option value="ORANGE">Orange Money</option><option value="AFRIMONEY">Afrimoney</option></select></label><label class="wide">Numéro du portefeuille Mobile Money<span class="phone-entry"><span class="phone-prefix">🇨🇩 +243</span><input name="wallet" type="tel" inputmode="numeric" autocomplete="tel-national" minlength="9" maxlength="9" pattern="[0-9]{9}" placeholder="9 chiffres" title="Saisissez exactement 9 chiffres après +243" required></span></label></div><p class="muted">Le versement est affecté à vos échéances les plus anciennes, avec les parts LOLC et GML prévues au contrat.</p><p id="feeSummary" class="section-note" aria-live="polite"></p><button type="submit" class="primary">Payer maintenant</button></form>`:'<p>Votre solde contractuel est réglé.</p>'}<p id="payError" class="form-error" role="alert"></p></section><section class="card"><h2>Mes paiements Araka</h2>${data.attempts.length?data.attempts.map(a=>`<div class="row"><div><strong>${money(a.total_charged??a.amount,a.currency)}</strong><small>Versement : ${money(a.amount,a.currency)} · Frais : ${money(a.transaction_fee||0,a.currency)}</small><small>${escape(a.reference)} · ${escape(a.provider)}</small><small>${escape(labels[a.state])}${a.receipt_id?' · Reçu #'+a.receipt_id:''}</small></div></div>`).join(''):'<p class="muted">Aucun paiement Araka pour ce contrat.</p>'}</section>`;
  $('paymentContent').insertAdjacentHTML('beforeend','<section class="card"><h2>Mes reçus de paiement</h2><p class="muted">Les 100 derniers versements confirmés. Les paiements en attente apparaîtront après confirmation.</p>'+((data.receipts||[]).map(r=>'<div class="row"><div><strong>'+money(r.total_charged,data.currency)+'</strong><small>'+escape(r.paid_on)+' · '+escape(r.method)+' · '+escape(r.reference)+'</small></div><button class="secondary" data-download-receipt="'+escape(r.id)+'">Télécharger le reçu PDF</button></div>').join('')||'<p class="muted">Aucun reçu confirmé disponible.</p>')+'</section>');
  document.querySelectorAll('[data-download-receipt]').forEach(b=>b.onclick=()=>downloadReceipt(b.dataset.downloadReceipt,b));
  $('changeDriver').onclick=async()=>{token=null;current=null;sessionStorage.removeItem('gmfleet_payment_link');requestId=crypto.randomUUID();phoneForm();};
  if($('checkPayment'))$('checkPayment').onclick=()=>check(unresolved.id);
  if($('driverPayForm')){
   bindPhone($('driverPayForm').elements.wallet);
   const input=$('driverPayForm').elements.amount;
   const updateFee=()=>{const cents=Math.round(Number(input.value)*100),fee=Math.round(cents*3/100);$('feeSummary').textContent='Versement : '+money(cents/100,data.currency)+' + frais Mobile Money (3 %) : '+money(fee/100,data.currency)+' · Total à payer : '+money((cents+fee)/100,data.currency);};
   input.addEventListener('input',updateFee);updateFee();
   $('driverPayForm').onsubmit=async event=>{
    event.preventDefault();const f=new FormData(event.currentTarget),button=event.currentTarget.querySelector('button');button.disabled=true;$('payError').textContent='';
    try{paint(await call('pay',{id:requestId,amount:f.get('amount'),provider:f.get('provider'),wallet:'+243'+f.get('wallet').trim()}));requestId=crypto.randomUUID();}
    catch(error){$('payError').textContent=error.message;try{const refreshed=await call('context');if(refreshed.attempts.some(a=>a.state==='pending'))paint(refreshed);}catch{}}finally{button.disabled=false;}
   };
  }
 }
 async function check(id){if(polling)return;polling=true;const access=token;try{const result=await call('check',{id});if(token===access)paint(result);}catch(error){if($('payError'))$('payError').textContent=error.message;}finally{polling=false;}}
 function bindPhone(input){
  input.addEventListener('input',()=>{input.value=input.value.replace(/[^0-9]/g,'').slice(0,9);});
  input.addEventListener('paste',event=>{event.preventDefault();let value=event.clipboardData.getData('text').replace(/[^0-9]/g,'');if(value.length===12&&value.startsWith('243'))value=value.slice(3);else if(value.length===10&&value.startsWith('0'))value=value.slice(1);input.value=value.slice(0,9);input.dispatchEvent(new Event('input',{bubbles:true}));});
 }
 function bindPlate(input){
  const format=value=>{let result='';for(const char of value.toUpperCase()){if(result.length>=8)break;if((result.length<4||result.length>=6)?/[0-9]/.test(char):/[A-Z]/.test(char))result+=char;}return result.length>=6?result.slice(0,6)+'/'+result.slice(6):result;};
  input.addEventListener('input',()=>{const before=input.value.slice(0,input.selectionStart),position=format(before).length;input.value=format(input.value);input.setSelectionRange(position,position);});
  input.addEventListener('paste',event=>{event.preventDefault();input.value=format(event.clipboardData.getData('text'));input.dispatchEvent(new Event('input',{bubbles:true}));});
  input.addEventListener('keydown',event=>{if(event.key==='Backspace'&&input.selectionStart===7&&input.selectionEnd===7&&input.value[6]==='/'){event.preventDefault();input.value=input.value.slice(0,5)+input.value.slice(7);input.dispatchEvent(new Event('input',{bubbles:true}));input.setSelectionRange(5,5);}});
 }
 function phoneForm(message=''){
  $('paymentNotice').textContent='Saisissez le numéro enregistré dans votre dossier et la plaque de votre véhicule.';
  $('paymentContent').innerHTML='<section class="card"><h2>Accéder à mes versements</h2><form id="phoneForm"><div class="fields"><label>Votre numéro de téléphone<span class="phone-entry"><span class="phone-prefix">🇨🇩 +243</span><input name="phone" type="tel" inputmode="numeric" autocomplete="tel-national" minlength="9" maxlength="9" pattern="[0-9]{9}" placeholder="9 chiffres" title="Saisissez exactement 9 chiffres après +243" required></span></label><label>Plaque du véhicule<input name="plate" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="9" pattern="[0-9]{4}[A-Z]{2}/[0-9]{2}" placeholder="1234AB/01" title="4 chiffres, 2 lettres, puis / et 2 chiffres de province" required><small class="muted">4 chiffres + 2 lettres / code province (ex. 1234AB/01).</small></label></div><p class="muted">Les deux informations doivent correspondre à votre contrat GM Fleet.</p><button class="primary">Voir mes versements</button></form><p id="loginError" class="form-error" role="alert"></p><p class="muted">Vous pouvez aussi ouvrir le lien personnel fourni par la caisse GM Fleet.</p></section>';
  bindPhone($('phoneForm').elements.phone);bindPlate($('phoneForm').elements.plate);
  $('loginError').textContent=message;
  $('phoneForm').onsubmit=async event=>{
   event.preventDefault();const form=event.currentTarget,button=form.querySelector('button');button.disabled=true;$('loginError').textContent='';
   try{const access=await call('driver-lookup',{phone:'+243'+form.elements.phone.value.trim(),plate:form.elements.plate.value.trim()});token=access.token;sessionStorage.setItem('gmfleet_payment_link',token);paint(await call('context'));}
   catch(error){if($('loginError'))$('loginError').textContent=error.message;}finally{button.disabled=false;}
  };
 }
 async function downloadReceipt(id,button){
  button.disabled=true;const access=token;
  try{const receipt=await call('receipt',{receipt_id:id});if(token!==access)return;if(receipt.status!=='confirmed')throw new Error('Le reçu sera disponible après confirmation du paiement.');window.GMFleetReceipt.download(receipt);}
  catch(error){if($('payError'))$('payError').textContent=error.message;}finally{button.disabled=false;}
 }
 if(!token)phoneForm();
 else call('context').then(paint).catch(error=>{token=null;sessionStorage.removeItem('gmfleet_payment_link');phoneForm(error.message);});
 setInterval(()=>{const attempt=current?.attempts.find(a=>a.state==='pending');if(!document.hidden&&attempt)check(attempt.id);},15000);
})();
