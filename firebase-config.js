// Public Firebase web configuration for GM Fleet admin notifications.
// Fill this with the Firebase web app config and VAPID public key from Firebase Console.
// Do not put service-account private keys in this file.
(root => {
 root.GMFLEET_FIREBASE_CONFIG = null;
 root.GMFLEET_FIREBASE_VAPID_KEY = '';
})(typeof self !== 'undefined' ? self : window);
