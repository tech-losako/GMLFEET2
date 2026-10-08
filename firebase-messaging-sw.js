self.addEventListener('notificationclick', event => {
 event.notification.close();
 const url = event.notification.data?.url || '/admin.html';
 event.waitUntil((async () => {
  const target = new URL(url, self.location.origin).href;
  const windows = await clients.matchAll({type:'window',includeUncontrolled:true});
  for (const client of windows) {
   if (client.url.startsWith(self.location.origin) && 'focus' in client) {
    if ('navigate' in client && !client.url.includes('/admin.html')) {
     const navigated = await client.navigate(target);
     return navigated?.focus();
    }
    return client.focus();
   }
  }
  return clients.openWindow(target);
 })());
});

importScripts('/firebase-config.js');

if (self.GMFLEET_FIREBASE_CONFIG?.apiKey) {
 importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
 importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

 firebase.initializeApp(self.GMFLEET_FIREBASE_CONFIG);
 const messaging = firebase.messaging();
 messaging.onBackgroundMessage(payload => {
  const data = payload.data || {};
  const notification = payload.notification || {};
  self.registration.showNotification(notification.title || data.title || 'Nouvelle demande GM Fleet', {
   body: notification.body || data.body || 'Ouvrez l’espace opérations.',
   icon: '/img/logogml.jpeg',
   badge: '/img/logogml.jpeg',
   data: {url: data.url || '/admin.html'}
  });
 });
}
