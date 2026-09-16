(() => {
 const params=new URLSearchParams(location.hash.slice(1));
 const token=params.get('token_hash'),type=params.get('type')==='recovery'?'recovery':'invite';
 history.replaceState(null,'',location.pathname);
 const form=document.getElementById('setupForm'),message=document.getElementById('setupMessage');
 const config=window.GMFLEET_SUPABASE_CONFIG;
 // An isolated session prevents an invitation from modifying an already signed-in account.
 const db=window.supabase.createClient(config.url,config.anonKey,{auth:{persistSession:false,detectSessionInUrl:false}});
 let verified=false;
 if(!token){message.textContent='Ouvrez le lien personnel fourni par votre Super Admin.';form.querySelector('button').disabled=true;}
 form.onsubmit=async event=>{
  event.preventDefault();const f=new FormData(form),button=form.querySelector('button');message.textContent='';
  if(f.get('password')!==f.get('confirm')){message.textContent='Les mots de passe ne correspondent pas.';return;}
  button.disabled=true;
  try{
   if(!verified){const {error}=await db.auth.verifyOtp({token_hash:token,type});if(error)throw new Error('Invitation expirée ou déjà utilisée. Demandez un nouveau lien à votre Super Admin.');verified=true;}
   const {error}=await db.auth.updateUser({password:f.get('password')});if(error)throw error;
   await db.auth.signOut();form.reset();message.textContent='Compte activé. Connectez-vous avec votre adresse e-mail et votre mot de passe.';button.hidden=true;
  }catch(error){message.textContent=error.message;}finally{button.disabled=false;}
 };
})();
