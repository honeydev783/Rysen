import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, getIdToken, signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "../firebase"; // adjust your import
import axios from "axios";

type UserData = {
  uid: string;
  name: string;
  email: string;
  login_count: number;
  onboarded: boolean;
};

type AuthContextType = {
  user: any;
  userData: UserData | null;
  loading: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const idToken = await getIdToken(firebaseUser);
        try {
          const res = await axios.post("/auth/verify-token", { id_token: idToken });
          setUser(firebaseUser);
          setUserData(res.data);
        } catch (error) {
          console.error("Backend token verification failed", error);
          setUser(null);
          setUserData(null);
        }
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setUserData(null);
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
