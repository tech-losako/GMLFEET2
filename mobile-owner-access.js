(function(){
 'use strict';
 window.GMFleetMobileOwnerAccess={async mount(root,a,c){
  if(a.program_type!=='FLEET_OWNER')return;
  const box=document.createElement('section');box.className='card';root.append(box);
  const {db,check,escape:e}=c;let inviteRequest=null,revokeRequests=new Map();
  async function render(){
   try{
    const [invites,links]=await Promise.all([
     check(await db.from('mobile_owner_invites').select('id,expires_at,redeemed_at,revoked_at,failed_attempts,created_at').eq('owner_application_id',a.id).order('created_at',{ascending:false}).limit(1)),
     check(await db.from('mobile_owner_links').select('id,gml_phone,linked_at').eq('owner_application_id',a.id).is('revoked_at',null).order('linked_at',{ascending:false}))
    ]);
    const i=invites[0],status=!i?'Aucune invitation':i.revoked_at?'Révoquée':i.redeemed_at?'Utilisée':i.failed_attempts>=5?'Bloquée':new Date(i.expires_at)<=new Date()?'Expirée':'Créée · envoi par SMS';
    const staff=c.staff.find(s=>s.user_id===c.user.id),admin=['admin','super_admin'].includes(staff?.role);
    box.innerHTML=`<h3>GML Mobile</h3><p>Invitation : <strong>${e(status)}</strong>${i&&!i.redeemed_at&&!i.revoked_at?' · valable jusqu’au '+e(new Date(i.expires_at).toLocaleString('fr-FR',{timeZone:'Africa/Kinshasa'})):''}</p><button type="button" class="secondary" data-invite>Inviter sur GML Mobile</button><div class="form-error" role="alert"></div><h4>Accès actifs</h4>${links.length?links.map(l=>`<div class="badge-line"><span>${e(l.gml_phone)} · ${e(new Date(l.linked_at).toLocaleDateString('fr-FR',{timeZone:'Africa/Kinshasa'}))}</span>${admin?`<button type="button" class="secondary" data-revoke="${e(l.id)}">Retirer l’accès</button>`:''}</div>`).join(''):'<p class="muted">Aucun compte lié.</p>'}`;
    box.querySelector('[data-invite]').onclick=async event=>{
     event.currentTarget.disabled=true;box.querySelector('.form-error').textContent='';
     inviteRequest ||=crypto.randomUUID();
     try{const result=await check(await db.rpc('create_mobile_owner_invite',{p:{application_id:a.id,request_id:inviteRequest}}));inviteRequest=null;await render();c.notify('Invitation mise en file SMS vers '+result.phone_masked+'. Le code reste privé.');}
     catch(error){box.querySelector('.form-error').textContent=error.message||'Envoi interrompu. Réessayez.';event.currentTarget.disabled=false;}
    };
    box.querySelectorAll('[data-revoke]').forEach(button=>button.onclick=async()=>{
     const reason=window.prompt('Motif du retrait d’accès (5 caractères minimum)');if(reason===null)return;
     if(reason.trim().length<5){box.querySelector('.form-error').textContent='Indiquez un motif de cinq caractères minimum.';return;}
     button.disabled=true;const key=button.dataset.revoke+'|'+reason.trim();if(!revokeRequests.has(key))revokeRequests.set(key,crypto.randomUUID());
     try{await check(await db.rpc('revoke_mobile_owner_link',{p:{link_id:button.dataset.revoke,reason:reason.trim(),request_id:revokeRequests.get(key)}}));revokeRequests.delete(key);await render();c.notify('Accès GML Mobile retiré.');}
     catch(error){box.querySelector('.form-error').textContent=error.message||'Retrait interrompu. Réessayez.';button.disabled=false;}
    });
   }catch(error){box.innerHTML='<h3>GML Mobile</h3><p class="form-error">'+e(error.message||'Accès indisponible')+'</p>';}
  }
  await render();
 }};
})();
