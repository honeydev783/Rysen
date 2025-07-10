// public/firebase-messaging-sw.js
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBjqcxYjEQ_GKgk7e5btBQ9BuofrfOhmjI",
  authDomain: "rysenapp.firebaseapp.com",
  projectId: "rysenapp",
  storageBucket: "rysenapp.firebasestorage.app",
  messagingSenderId: "725651131931",
  appId: "1:725651131931:web:e70de44cbcf6a357d8f2be",
  measurementId: "G-K9H0M4BBW3"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log("[firebase-messaging-sw.js] Received background message ", payload);
  const { title, body } = payload.notification;
  const notificationOptions = {
    body,
    icon: "/icons/icon-192x192.png",
  };

  self.registration.showNotification(title, notificationOptions);
});