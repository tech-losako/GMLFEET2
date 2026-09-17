(() => {
 const $=id=>document.getElementById(id),config=window.GMFLEET_SUPABASE_CONFIG;
 const db=window.supabase.createClient(config.url,config.anonKey,{auth:{persistSession:false,detectSessionInUrl:false}});
 window.addEventListener('hashchange',()=>{if(new URLSearchParams(location.hash.slice(1)).get('token'))location.reload();});
 const supplied=new URLSearchParams(location.hash.slice(1)).get('token');
 if(supplied&&/^[a-f0-9]{64}$/.test(supplied))sessionStorage.setItem('gmfleet_payment_link',supplied);
 history.replaceState(null,'',location.pathname);
 const token=supplied||sessionStorage.getItem('gmfleet_payment_link');
 const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=(n,c)=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:c}).format(Number(n));
 const labels={pending:'En attente de confirmation',approved:'Paiement confirmé',declined:'Paiement refusé',review:'Paiement reçu — rapprochement par GM Fleet requis'};
 let current,polling=false,requestId=crypto.randomUUID();
 async function call(action,extra={}){const {data,error}=await db.functions.invoke('araka-payments',{body:{action,token,...extra}});if(error){let message='Connexion interrompue. Vérifiez le statut avant de recommencer.';try{message=(await error.context.json()).error||message;}catch{}throw new Error(message);}if(data.error)throw new Error(data.error);return data;}
 function paint(data){
  current=data;const unresolved=data.attempts.find(a=>['pending','review'].includes(a.state));
  $('paymentNotice').textContent='Bonjour '+data.driver_name;
  $('paymentContent').innerHTML=`<section class="card"><div class="stats"><div class="stat"><span>À régler à ce jour</span><strong>${money(data.due,data.currency)}</strong></div><div class="stat"><span>Versement quotidien</span><strong>${money(data.daily_amount,data.currency)}</strong></div></div>${unresolved?`<p class="section-note">${escape(labels[unresolved.state])}. Référence : ${escape(unresolved.reference)}. ${unresolved.state==='pending'?'Validez sur votre téléphone si une demande apparaît. Ne lancez pas un deuxième paiement.':'Contactez la caisse GM Fleet pour le rapprochement.'}</p><button id="checkPayment" class="primary">Vérifier le statut</button>`:Number(data.total_remaining)>0?`<form id="driverPayForm"><div class="fields"><label>Montant (${escape(data.currency)})<input name="amount" type="number" step="0.01" min="0.01" max="${Number(data.total_remaining)}" value="${Math.min(Number(data.total_remaining),Number(data.due)||Number(data.daily_amount)).toFixed(2)}" required></label><label>Opérateur<select name="provider"><option value="MPESA">M-Pesa</option><option value="AIRTEL">Airtel Money</option><option value="ORANGE">Orange Money</option><option value="AFRIMONEY">Afrimoney</option></select></label><label class="wide">Numéro du portefeuille Mobile Money<input name="wallet" type="tel" placeholder="+243XXXXXXXXX" pattern="[+]243[0-9]{9}" required autocomplete="tel"></label></div><p class="muted">Le montant sera affecté à vos échéances les plus anciennes, avec les parts LOLC et GML prévues au contrat.</p><button type="submit" class="primary">Payer maintenant</button></form>`:'<p>Votre solde contractuel est réglé.</p>'}<p id="payError" class="form-error" role="alert"></p></section><section class="card"><h2>Mes paiements Araka</h2>${data.attempts.length?data.attempts.map(a=>`<div class="row"><div><strong>${money(a.amount,a.currency)}</strong><small>${escape(a.reference)} · ${escape(a.provider)}</small><small>${escape(labels[a.state])}${a.receipt_id?' · Reçu #'+a.receipt_id:''}</small></div></div>`).join(''):'<p class="muted">Aucun paiement Araka pour ce contrat.</p>'}</section>`;
  if($('checkPayment'))$('checkPayment').onclick=()=>check(unresolved.id);
  if($('driverPayForm'))$('driverPayForm').onsubmit=async event=>{
   event.preventDefault();const f=new FormData(event.currentTarget),button=event.currentTarget.querySelector('button');button.disabled=true;$('payError').textContent='';
   try{paint(await call('pay',{id:requestId,amount:f.get('amount'),provider:f.get('provider'),wallet:f.get('wallet').trim()}));requestId=crypto.randomUUID();}
   catch(error){$('payError').textContent=error.message;try{const refreshed=await call('context');if(refreshed.attempts.some(a=>a.state==='pending'))paint(refreshed);}catch{}}finally{button.disabled=false;}
  };
 }
 async function check(id){if(polling)return;polling=true;try{paint(await call('check',{id}));}catch(error){$('payError').textContent=error.message;}finally{polling=false;}}
 if(!token){$('paymentNotice').textContent='Demandez votre lien de paiement personnel à la caisse GM Fleet. Il permet de rattacher chaque versement à votre contrat.';return;}
 call('context').then(paint).catch(error=>{$('paymentNotice').textContent=error.message;});
 setInterval(()=>{const attempt=current?.attempts.find(a=>a.state==='pending');if(!document.hidden&&attempt)check(attempt.id);},15000);
})();
