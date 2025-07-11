import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  FacebookAuthProvider,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";
import { doc, getDoc, setDoc, updateDoc, increment } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBjqcxYjEQ_GKgk7e5btBQ9BuofrfOhmjI",
  authDomain: "rysenapp.firebaseapp.com",
  projectId: "rysenapp",
  storageBucket: "rysenapp.firebasestorage.app",
  messagingSenderId: "725651131931",
  appId: "1:725651131931:web:e70de44cbcf6a357d8f2be",
  measurementId: "G-K9H0M4BBW3",
};

const app = initializeApp(firebaseConfig);

// Optional: Export providers if you're using them in Login.tsx
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
const facebookProvider = new FacebookAuthProvider();
let messaging: ReturnType<typeof getMessaging> | null = null;

const messagingSupportPromise = isSupported().then((supported) => {
  if (supported) {
    messaging = getMessaging(app);
    console.log("FCM supported and initialized");
  } else {
    console.warn("FCM not supported on this browser");
  }
});


async function handlePostSignIn() {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) return;

  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    await setDoc(userRef, {
      login_count: 1,
      createdAt: Date.now(),
    });
    return 1;
  } else {
    const prevCount = snap.data().login_count || 0;
    const newCount = prevCount + 1;

    await updateDoc(userRef, {
      login_count: increment(1),
      lastLoginAt: Date.now(),
    });

    return newCount;
  }
}
export {app, auth, db, googleProvider, facebookProvider, messaging, messagingSupportPromise, handlePostSignIn}