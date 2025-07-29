// import { useEffect } from "react";
// import { useNavigate } from "react-router-dom";
// import { GoogleAuthProvider, signInWithPopup, signInWithRedirect } from "firebase/auth";
// import { auth } from "../firebase"; // adjust path
// import api from "../utils/api"; // your axios instance
// import toast from "react-hot-toast";

// const AuthCallback = ({ onLogin }: { onLogin: (userData: any) => void }) => {
//   const navigate = useNavigate();

//   useEffect(() => {
//     const signInWithGoogle = async () => {
//       try {
//         const provider = new GoogleAuthProvider();
//         const result = await signInWithRedirect(auth, provider);
//         const idToken = await result.user.getIdToken();
//         console.log("idToken===>", idToken);
//         const response = await api.post("/auth/signin", {
//           id_token: idToken,
//         });

//         const userData = response.data;
//         toast.success("Login successful!");
//         onLogin({
//           name: userData.name,
//           login_count: userData.login_count,
//           email: userData.email,
//           onboarded: userData.onboarded,
//           uid: userData.uid,
//         });

//         if (userData.onboarded) {
//           navigate("/welcome", { replace: true });
//         } else {
//           navigate("/onboarding", { replace: true });
//         }
//       } catch (err) {
//         console.error("Google login failed:", err);
//         toast.error("Login failed");
//         navigate("/home");
//       }
//     };

//     signInWithGoogle();
//   }, [navigate, onLogin]);

//   return (
//     <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gray-100 dark:bg-gray-900 transition-colors"></div>
//   );
// };

// export default AuthCallback;
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getRedirectResult } from "firebase/auth";
import { auth } from "../firebase";
import toast from "react-hot-toast";
import axios from "axios";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const finalizeLogin = async () => {
      try {
        const result = await getRedirectResult(auth);

        if (!result || !result.user) {
          toast.error("No user info from Google");
          return navigate("/home");
        }

        const idToken = await result.user.getIdToken();

        const res = await axios.post("/api/login", { idToken });

        const userData = res.data;
        localStorage.setItem("login_count", userData.login_count);
        localStorage.setItem("onboarded", userData.onboarded);

        // Redirect based on onboarding status
        if (userData.onboarded) {
          navigate("/welcome");
        } else {
          navigate("/onboarding");
        }
      } catch (err) {
        console.error("Auth callback error:", err);
        toast.error("Login failed.");
        navigate("/home");
      }
    };

    finalizeLogin();
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gray-100 dark:bg-gray-900 transition-colors"></div>
  );
}
