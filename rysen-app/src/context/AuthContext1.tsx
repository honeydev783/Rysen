// // import { createContext, useContext, useEffect, useState } from "react";
// // import { getAuth, onAuthStateChanged, User } from "firebase/auth";
// // import { firebaseApp } from "../lib/firebase";

// // const AuthContext = createContext<User | null>(null);

// // export const useAuth = () => useContext(AuthContext);

// // export function AuthProvider({ children }: { children: React.ReactNode }) {
// //   const [user, setUser] = useState<User | null>(null);

// //   useEffect(() => {
// //     const auth = getAuth(firebaseApp);
// //     const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
// //       setUser(firebaseUser);
// //     });
// //     return () => unsubscribe();
// //   }, []);

// //   return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
// // }

// // // ✅ Add this line to make the file a module
// // export {};
// import { createContext, useContext, useEffect, useState } from "react";
// import { getAuth, signInWithPopup, GoogleAuthProvider, FacebookAuthProvider, onAuthStateChanged, signOut } from "firebase/auth";
// import { initializeApp } from "firebase/app";
// // import { firebaseConfig } from "../firebase";
// const firebaseConfig = {
//   apiKey: "AIzaSyBjqcxYjEQ_GKgk7e5btBQ9BuofrfOhmjI",
//   authDomain: "rysenapp.firebaseapp.com",
//   projectId: "rysenapp",
//   storageBucket: "rysenapp.firebasestorage.app",
//   messagingSenderId: "725651131931",
//   appId: "1:725651131931:web:e70de44cbcf6a357d8f2be",
//   measurementId: "G-K9H0M4BBW3"
// };
// initializeApp(firebaseConfig);
// const auth = getAuth();

// const AuthContext = createContext<any>(null);

// export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
//   const [user, setUser] = useState<any>(null);

//   useEffect(() => {
//     const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
//       setUser(firebaseUser);
//     });
//     return () => unsubscribe();
//   }, []);

//   const signInWithGoogle = async () => {
//     const provider = new GoogleAuthProvider();
//     await signInWithPopup(auth, provider);
//   };

//   const signInWithFacebook = async () => {
//     const provider = new FacebookAuthProvider();
//     await signInWithPopup(auth, provider);
//   };

//   const logout = async () => {
//     await signOut(auth);
//   };

//   return (
//     <AuthContext.Provider value={{ user, signInWithGoogle, signInWithFacebook, logout }}>
//       {children}
//     </AuthContext.Provider>
//   );
// };

// export const useAuth = () => useContext(AuthContext);
import React, { createContext, useEffect, useState, ReactNode } from "react";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import type { User } from "firebase/auth";
import { app } from "../firebase"; // Your Firebase config/init file

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [auth]);

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
