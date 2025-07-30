// context/AuthContext.tsx
import React, { createContext, useEffect, useState, useContext } from "react";
import { onAuthStateChanged, getIdToken } from "firebase/auth";
import { auth, db } from "../firebase"; // Your Firebase config
import api from "../utils/api";
import { setPersistence, browserLocalPersistence } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

interface User {
  uid: string;
  name: string;
  login_count: string;
  onboarded: boolean;
  email: string;
  theme: string;
  responseStyle: string;
  avatar: string;
}
interface AuthContextType {
  user: User | null;
  token: string | null;
  onboardingComplete: boolean;
  loginCount: number;
  setUser: (user: User) => void;
  logout: () => void;
  loading: boolean; //
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [loginCount, setLoginCount] = useState(0);
  const [loading, setLoading] = useState(true); // 👈 add this

  const logout = async () => {
    await auth.signOut(); // Firebase logout
    setUser(null);
    setToken(null);
    setOnboardingComplete(false);
    setLoginCount(0);
    localStorage.removeItem("authToken");
  };
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        onAuthStateChanged(auth, async (firebaseUser) => {
          // if (firebaseUser) {
          //   const idToken = await getIdToken(firebaseUser);
          //   console.log("idToken", idToken)
          //   const uid = firebaseUser.uid;
          //   console.log("uid=====>", uid);
          //   const docRef = doc(db, "users", uid);
          //   const snap = await getDoc(docRef);
          //   const userData = snap.data();
          //   console.log("userData in context===>", userData)
          //   setUser({
          //     name: userData.name,
          //     login_count: userData.login_count,
          //     email: userData.email,
          //     onboarded: userData.onboarded,
          //     uid: userData.uid,
          //     theme: userData.theme,
          //     responseStyle: userData.responseStyle
          //   });
          //   setToken(idToken);
          //   setOnboardingComplete(userData.onboarded);
          //   setLoginCount(userData.login_count);
          // } else {
          //   setUser(null);
          //   setToken(null);
          //   setOnboardingComplete(false);
          //   setLoginCount(0);
          // }
          // setLoading(false); // ✅ done initializing
          if (firebaseUser) {
            const idToken = await getIdToken(firebaseUser);
            const uid = firebaseUser.uid;
            const docRef = doc(db, "users", uid);

            let userData = null;
            let snap = null;

            // Wait and retry until doc exists (be careful: infinite loop risk)
            while (true) {
              snap = await getDoc(docRef);
              if (snap.exists()) {
                userData = snap.data();
                break;
              }
              // Optional: wait 500ms before retrying
              await new Promise((resolve) => setTimeout(resolve, 500));
            }

            console.log("userData in context===>", userData);

            setUser({
              name: userData.name,
              login_count: userData.login_count,
              email: userData.email,
              onboarded: userData.onboarded,
              uid: userData.uid,
              theme: userData.theme,
              responseStyle: userData.responseStyle,
              avatar: userData.avatar
            });
            setToken(idToken);
            setOnboardingComplete(userData.onboarded);
            setLoginCount(userData.login_count);
          } else {
            setUser(null);
            setToken(null);
            setOnboardingComplete(false);
            setLoginCount(0);
          }
          setLoading(false);
        });
      })
      .catch((err) => {
        console.error("Firebase persistence error:", err);
      });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        onboardingComplete,
        loginCount,
        setUser,
        logout,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext)!;
