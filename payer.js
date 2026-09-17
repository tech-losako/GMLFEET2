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
  $('paymentContent').innerHTML=`<section class="card"><p><strong>Véhicule : ${escape(data.vehicle?.model||'À préciser')}</strong> · ${escape(data.vehicle?.plate||'')}</p><button id="changeDriver" class="link-button">Changer de chauffeur</button><div class="stats"><div class="stat"><span>À régler à ce jour</span><strong>${money(data.due,data.currency)}</strong></div><div class="stat"><span>Versement quotidien</span><strong>${money(data.daily_amount,data.currency)}</strong></div></div>${unresolved?`<p class="section-note">${escape(labels[unresolved.state])}. Référence : ${escape(unresolved.reference)}. ${unresolved.state==='pending'?'Validez sur votre téléphone si une demande apparaît. Ne lancez pas un deuxième paiement.':'Contactez la caisse GM Fleet pour le rapprochement.'}</p><button id="checkPayment" class="primary">Vérifier le statut</button>`:Number(data.total_remaining)>0?`<form id="driverPayForm"><div class="fields"><label>Versement au contrat (${escape(data.currency)})<input name="amount" type="number" step="0.01" min="0.01" max="${Number(data.total_remaining)}" value="${Math.min(Number(data.total_remaining),Number(data.due)||Number(data.daily_amount)).toFixed(2)}" required></label><label>Opérateur<select name="provider"><option value="MPESA">M-Pesa</option><option value="AIRTEL">Airtel Money</option><option value="ORANGE">Orange Money</option><option value="AFRIMONEY">Afrimoney</option></select></label><label class="wide">Numéro du portefeuille Mobile Money<input name="wallet" type="tel" placeholder="+243XXXXXXXXX" pattern="[+]243[0-9]{9}" required autocomplete="tel"></label></div><p class="muted">Le versement est affecté à vos échéances les plus anciennes, avec les parts LOLC et GML prévues au contrat.</p><p id="feeSummary" class="section-note" aria-live="polite"></p><button type="submit" class="primary">Payer maintenant</button></form>`:'<p>Votre solde contractuel est réglé.</p>'}<p id="payError" class="form-error" role="alert"></p></section><section class="card"><h2>Mes paiements Araka</h2>${data.attempts.length?data.attempts.map(a=>`<div class="row"><div><strong>${money(a.total_charged??a.amount,a.currency)}</strong><small>Versement : ${money(a.amount,a.currency)} · Frais : ${money(a.transaction_fee||0,a.currency)}</small><small>${escape(a.reference)} · ${escape(a.provider)}</small><small>${escape(labels[a.state])}${a.receipt_id?' · Reçu #'+a.receipt_id:''}</small></div></div>`).join(''):'<p class="muted">Aucun paiement Araka pour ce contrat.</p>'}</section>`;
  $('changeDriver').onclick=async()=>{token=null;current=null;sessionStorage.removeItem('gmfleet_payment_link');await db.auth.signOut();phoneForm();};
  if($('checkPayment'))$('checkPayment').onclick=()=>check(unresolved.id);
  if($('driverPayForm')){
   const input=$('driverPayForm').elements.amount;
   const updateFee=()=>{const cents=Math.round(Number(input.value)*100),fee=Math.round(cents*3/100);$('feeSummary').textContent='Versement : '+money(cents/100,data.currency)+' + frais Mobile Money (3 %) : '+money(fee/100,data.currency)+' · Total à payer : '+money((cents+fee)/100,data.currency);};
   input.addEventListener('input',updateFee);updateFee();
   $('driverPayForm').onsubmit=async event=>{
    event.preventDefault();const f=new FormData(event.currentTarget),button=event.currentTarget.querySelector('button');button.disabled=true;$('payError').textContent='';
    try{paint(await call('pay',{id:requestId,amount:f.get('amount'),provider:f.get('provider'),wallet:f.get('wallet').trim()}));requestId=crypto.randomUUID();}
    catch(error){$('payError').textContent=error.message;try{const refreshed=await call('context');if(refreshed.attempts.some(a=>a.state==='pending'))paint(refreshed);}catch{}}finally{button.disabled=false;}
   };
  }
 }
 async function check(id){if(polling)return;polling=true;try{paint(await call('check',{id}));}catch(error){if($('payError'))$('payError').textContent=error.message;}finally{polling=false;}}
 function phoneForm(message=''){
  $('paymentNotice').textContent='Retrouvez votre véhicule et vos versements avec le numéro enregistré dans votre dossier GM Fleet.';
  $('paymentContent').innerHTML='<section class="card"><h2>Accéder à mes versements</h2><form id="phoneForm"><label>Votre numéro de téléphone<input name="phone" type="tel" autocomplete="tel" placeholder="0812345678 ou +243812345678" required></label><p class="muted">Un code SMS protège l’accès à votre dossier.</p><button class="primary">Recevoir le code SMS</button></form><p id="loginError" class="form-error" role="alert"></p><p class="muted">Vous pouvez aussi ouvrir le lien personnel fourni par la caisse GM Fleet.</p></section>';
  $('loginError').textContent=message;
  $('phoneForm').onsubmit=async event=>{
   event.preventDefault();const form=event.currentTarget,button=form.querySelector('button');let phone=form.elements.phone.value.replace(/[^0-9]/g,'');if(/^0[0-9]{9}$/.test(phone))phone='243'+phone.slice(1);
   if(!/^243[0-9]{9}$/.test(phone)){$('loginError').textContent='Indiquez un numéro congolais valide, par exemple +243812345678.';return;}
   phone='+'+phone;button.disabled=true;$('loginError').textContent='';
   try{const {error}=await db.auth.signInWithOtp({phone});if(error)throw error;codeForm(phone);}
   catch(error){$('loginError').textContent=error.code==='sms_provider_disabled'||/disabled|unsupported|provider/i.test(error.message)?'La connexion SMS n’est pas encore disponible. Utilisez votre lien personnel ou contactez la caisse GM Fleet.':'Code non envoyé. Réessayez dans une minute ou contactez la caisse GM Fleet.';}finally{button.disabled=false;}
  };
 }
 function codeForm(phone){
  $('paymentContent').innerHTML='<section class="card"><h2>Vérifier mon numéro</h2><p>Code envoyé au '+escape(phone)+'.</p><form id="codeForm"><label>Code SMS<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label><button class="primary">Voir mes versements</button></form><p id="loginError" class="form-error" role="alert"></p><button id="backPhone" class="link-button">Changer le numéro / renvoyer un code</button></section>';
  $('backPhone').onclick=()=>phoneForm();
  $('codeForm').onsubmit=async event=>{
   event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;$('loginError').textContent='';
   try{const {error}=await db.auth.verifyOtp({phone,token:event.currentTarget.elements.code.value,type:'sms'});if(error)throw new Error('Code invalide ou expiré. Demandez un nouveau code.');const access=await call('phone-login');token=access.token;sessionStorage.setItem('gmfleet_payment_link',token);paint(await call('context'));}
   catch(error){if($('loginError'))$('loginError').textContent=error.message;}finally{button.disabled=false;}
  };
 }
 if(!token)phoneForm();
 else call('context').then(paint).catch(error=>{token=null;sessionStorage.removeItem('gmfleet_payment_link');phoneForm(error.message);});
 setInterval(()=>{const attempt=current?.attempts.find(a=>a.state==='pending');if(!document.hidden&&attempt)check(attempt.id);},15000);
})();
