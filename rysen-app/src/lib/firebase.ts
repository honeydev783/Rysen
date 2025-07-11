// import { initializeApp } from "firebase/app";



// export const firebaseApp = initializeApp(firebaseConfig);
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, FacebookAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBjqcxYjEQ_GKgk7e5btBQ9BuofrfOhmjI",
  authDomain: "rysenapp.firebaseapp.com",
  projectId: "rysenapp",
  storageBucket: "rysenapp.firebasestorage.app",
  messagingSenderId: "725651131931",
  appId: "1:725651131931:web:e70de44cbcf6a357d8f2be",
  measurementId: "G-K9H0M4BBW3"
};


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const facebookProvider = new FacebookAuthProvider();

export { auth, googleProvider, facebookProvider };