/* Staff administration. Database RPCs and the invitation function enforce Super Admin access. */
window.GMFleetUsers = (() => {
 let ctx,accounts=[],generation=0;
 const roles={agent:'Agent',cashier:'Caissier',admin:'Administrateur',super_admin:'Super Admin'};
 const $=id=>document.getElementById(id);
 const options=selected=>Object.entries(roles).map(([v,label])=>`<option value="${v}" ${selected===v?'selected':''}>${label}</option>`).join('');
 async function rpc(name,p){const {data,error}=await ctx.db.rpc(name,p);if(error)throw error;return data;}
 function dialog(title,body){let d=$('userDialog');if(!d){d=document.createElement('dialog');d.id='userDialog';document.body.append(d);}d.innerHTML=`<div class="dialog-title"><h2>${title}</h2><button type="button" class="icon" data-close="userDialog" aria-label="Fermer">×</button></div>${body}`;if(!d.open)d.showModal();return d;}
 function edit(account){
  const e=ctx.escape,self=account?.user_id===ctx.user.id;
  const d=dialog(account?'Modifier l’utilisateur':'Ajouter un utilisateur',`<form id="userForm"><div class="fields"><label>Nom complet<input name="display_name" required maxlength="200" value="${e(account?.display_name||'')}"></label><label>E-mail<input name="email" type="email" required maxlength="254" value="${e(account?.email||'')}" ${account?'readonly':''}></label><label>Rôle<select name="role" ${self?'disabled':''}>${options(account?.role||'agent')}</select></label>${account?`<label>Accès<select name="active" ${self?'disabled':''}><option value="true" ${account.active?'selected':''}>Actif</option><option value="false" ${!account.active?'selected':''}>Désactivé</option></select></label>`:''}</div><p class="muted">Agent : suivi des dossiers et contrats. Caissier : dossiers et encaissements. Administrateur : caisse et annulation de contrats. Super Admin : tous les droits, y compris la gestion des utilisateurs.</p><div class="form-error" role="alert"></div><div class="form-footer"><button type="submit" class="primary">${account?'Enregistrer':'Créer le lien d’invitation'}</button></div></form>`);
  $('userForm').onsubmit=async event=>{
   event.preventDefault();const form=event.currentTarget,f=new FormData(form),b=form.querySelector('[type=submit]');b.disabled=true;form.querySelector('.form-error').textContent='';
   try{
    if(account){await rpc('manage_staff',{p:{user_id:account.user_id,revision:account.revision,display_name:f.get('display_name'),role:self?'super_admin':f.get('role'),active:self||f.get('active')==='true'}});d.close();await render(ctx);ctx.notify('Accès utilisateur enregistré.');}
    else await invite({display_name:f.get('display_name'),email:f.get('email'),role:f.get('role')});
   }catch(error){form.querySelector('.form-error').textContent=error.message;}finally{b.disabled=false;}
  };
 }
 async function invite(p){
  const {data,error}=await ctx.db.functions.invoke('staff-invite',{body:p});
  if(error){let message=error.message;try{message=(await error.context.json()).error||message;}catch{}throw new Error(message);}
  if(data?.error)throw new Error(data.error);
  await render(ctx);
  const d=dialog('Lien prêt',`<p>Partagez ce lien uniquement avec <strong>${ctx.escape(data.email)}</strong>. Cette personne choisira son mot de passe. Aucun e-mail n’a été envoyé automatiquement.</p><label>Lien personnel à usage unique<textarea id="invitationLink" readonly rows="4"></textarea></label><p class="muted">Ce lien donne accès au compte. S’il expire, renouvelez l’invitation depuis la liste.</p><button class="primary" id="copyInvitation">Copier le lien</button><p id="copyStatus" role="status"></p>`);
  $('invitationLink').value=data.link;
  $('copyInvitation').onclick=async()=>{try{await navigator.clipboard.writeText(data.link);$('copyStatus').textContent='Lien copié.';}catch{$('invitationLink').select();$('copyStatus').textContent='Sélectionnez et copiez le lien.';}};
  d.addEventListener('close',()=>{d.innerHTML='';},{once:true});
 }
 async function render(context){
  ctx=context;const ticket=++generation;
  if(!ctx.staff.some(s=>s.user_id===ctx.user.id&&s.active&&s.role==='super_admin')){$('content').textContent='Accès réservé au Super Admin';return;}
  $('content').innerHTML='<p>Chargement des utilisateurs…</p>';
  try{
   accounts=await rpc('list_staff_accounts');
   if(ticket!==generation||!document.querySelector('[data-view="users"].active'))return;
   const e=ctx.escape;
   $('content').innerHTML=`<section class="card"><div class="card-heading"><h3>${accounts.length} utilisateur(s)</h3><button class="primary" id="addUser">＋ Ajouter un utilisateur</button></div><p class="muted">Les comptes désactivés restent dans l’historique, mais n’ont plus accès aux données.</p><div class="table-wrap"><table><thead><tr><th>Utilisateur</th><th>Rôle</th><th>Accès</th><th>Actions</th></tr></thead><tbody>${accounts.map(a=>`<tr><td>${e(a.display_name)}<small>${e(a.email)}</small></td><td>${roles[a.role]}</td><td><span class="tag">${!a.active?'Désactivé':a.confirmed?'Actif':'Invitation à accepter'}</span></td><td><button class="secondary" data-edit-user="${a.user_id}">Modifier</button>${a.active?` <button class="secondary" data-invite-user="${a.user_id}">${a.confirmed?'Réinitialiser le mot de passe':'Renouveler le lien'}</button>`:''}</td></tr>`).join('')}</tbody></table></div></section>`;
   $('addUser').onclick=()=>edit(null);
   $('content').querySelectorAll('[data-edit-user]').forEach(b=>b.onclick=()=>edit(accounts.find(a=>a.user_id===b.dataset.editUser)));
   $('content').querySelectorAll('[data-invite-user]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await invite(accounts.find(a=>a.user_id===b.dataset.inviteUser));}catch(error){ctx.notify(error.message,true);}finally{b.disabled=false;}});
  }catch(error){if(document.querySelector('[data-view="users"].active'))$('content').textContent=error.message;}
 }
 return {render};
})();
