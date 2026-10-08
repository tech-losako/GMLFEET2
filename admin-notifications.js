window.GMFleetAdminNotifications = (() => {
 const sdk = 'https://www.gstatic.com/firebasejs/10.13.2';
 let mounted=false,button,db,notify=()=>{},loaded,messageBound=false;
 const adminRoles = new Set(['admin','super_admin']);
 const configured = () => !!(window.GMFLEET_FIREBASE_CONFIG?.apiKey && window.GMFLEET_FIREBASE_VAPID_KEY);
 const supported = () => configured() && window.isSecureContext && 'serviceWorker' in navigator && 'Notification' in window;
 function setButton(state) {
  if(!button)return;
  const permission = 'Notification' in window ? Notification.permission : 'default';
  button.textContent = state || (permission==='granted'?'Notifications activées':'Activer notifications');
  button.disabled = false;
 }
 async function firebase() {
  if(loaded)return loaded;
  loaded = Promise.all([
   import(sdk + '/firebase-app.js'),
   import(sdk + '/firebase-messaging.js')
  ]).then(async ([app,messaging]) => {
   if(!(await messaging.isSupported())) throw new Error('Notifications non prises en charge par ce navigateur');
   const instance = app.initializeApp(window.GMFLEET_FIREBASE_CONFIG);
   return {messaging:messaging.getMessaging(instance),getToken:messaging.getToken,onMessage:messaging.onMessage};
  });
  return loaded;
 }
 async function enable(silent=false) {
  if(!supported())return;
  if(button)button.disabled=true;
  try {
   if(Notification.permission!=='granted') {
    if(silent){setButton();return;}
    const permission = await Notification.requestPermission();
    if(permission!=='granted') throw new Error('Notifications refusées dans le navigateur');
   }
   const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
   const f = await firebase();
   const token = await f.getToken(f.messaging,{vapidKey:window.GMFLEET_FIREBASE_VAPID_KEY,serviceWorkerRegistration:registration});
   if(!token) throw new Error('Aucun jeton de notification généré');
   const {error} = await db.rpc('save_staff_push_token',{p:{token,platform:'web',user_agent:navigator.userAgent}});
   if(error) throw error;
   localStorage.setItem('gmfleet-admin-notifications','1');
   if(!messageBound){
    messageBound=true;
    f.onMessage(f.messaging,payload => {
     const data=payload.data||{},notification=payload.notification||{};
     const title=notification.title||data.title||'Nouvelle demande GM Fleet';
     const body=notification.body||data.body||'Ouvrez l’espace opérations.';
     notify(title+' · '+body);
     if(document.hidden && Notification.permission==='granted')new Notification(title,{body,icon:'/img/logogml.jpeg',data:{url:data.url||'/admin.html'}});
    });
   }
   setButton('Notifications activées');
  } catch(error) {
   console.error(error);
   setButton();
   if(!silent)notify(error.message || 'Activation des notifications impossible.',true);
  }
 }
 function mount(context) {
  if(mounted || !context?.staff || !adminRoles.has(context.staff.role))return;
  db=context.db;notify=context.notify||notify;
  if(!supported())return;
  mounted=true;
  button=document.createElement('button');
  button.type='button';
  button.className='secondary notification-toggle';
  button.onclick=()=>enable(false);
  document.querySelector('.header-actions')?.prepend(button);
  setButton();
  if(Notification.permission==='granted' || localStorage.getItem('gmfleet-admin-notifications')==='1')enable(true);
 }
 return {mount};
})();
