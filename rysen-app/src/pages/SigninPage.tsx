import { useState } from "react";
import { FaGoogle, FaFacebook } from "react-icons/fa";
import { useTheme } from "../context/ThemeContext";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { auth } from "../firebase";
import axios from "axios";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import  api  from "../utils/api";
interface User {
  uid : string;
  name: string;
  login_count: string;
  onboarded: boolean;
  email: string;
  // Add other user properties as needed
}

interface SigninPageProps {
  onLogin: (user: User) => void;
}

const SigninPage: React.FC<SigninPageProps> = ({ onLogin }) => {
  const { theme, toggleTheme } = useTheme();
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleAuth = async (firebaseUser: any) => {
    const idToken = await firebaseUser.getIdToken();
    console.log("idToken===>", idToken);
    try {
      const endpoint = isSignup ? "/auth/signup" : "/auth/signin";
      const response = await api.post(`${endpoint}`, {
        id_token: idToken,
      });
      console.log("response==>", response.data);
      const userData = response.data;
      toast.success(isSignup ? "Signup successful!" : "Login successful!");
      onLogin({ name: userData.name, login_count: userData.login_count, email: userData.email, onboarded: userData.onboarded, uid: userData.uid });
      if(userData.onboarded) {
        navigate("/welcome");
      } else {
        navigate("/onboarding");
      }
      
    } catch (err) {
      console.error("Error calling FastAPI backend:", err);
    }
  };

  const handleEmailAuth = async () => {
    try {
      const userCredential = isSignup
        ? await createUserWithEmailAndPassword(auth, email, password)
        : await signInWithEmailAndPassword(auth, email, password);
      console.log("userCredential====>", userCredential);
      await handleAuth(userCredential.user);
      
    } catch (error) {
      console.error("Firebase email auth error:", error);
      if (error.code === "auth/email-already-in-use") {
        toast.error("This email is already registered. Please log in.");
      } else if (error.code === "auth/user-not-found") {
        toast.error("No user found with this email.");
      } else if (error.code === "auth/wrong-password") {
        toast.error("Incorrect password. Please try again.");
      } else if (error.code === "auth/invalid-email") {
        toast.error("Please enter a valid email address.");
      } else if (error.code === "auth/weak-password") {
        toast.error("Password should be at least 6 characters.");
      } else {
        toast.error("Authentication failed. Please try again.");
      }
    }
  };

  const handleGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      setIsSignup(false);
      await handleAuth(result.user);
    } catch (error) {
      console.error("Google login error:", error);
      toast.error("Authentication failed. Please try again.");
    }
  };

  const handleFacebook = async () => {
    const provider = new FacebookAuthProvider();
    try {
      const result = await signInWithRedirect(auth, provider);
      setIsSignup(false);
      await handleAuth(result.user);
    } catch (error) {
      toast.error("Authentication failed. Please try again.");
      console.error("Facebook login error:", error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gray-100 dark:bg-gray-900 transition-colors">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 shadow-lg rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-800 dark:text-white">
          {isSignup ? "Create an Account" : "Welcome to Rysen"}
        </h1>

        <div className="flex gap-3 mb-4 justify-center">
          <button
            className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition"
            onClick={handleGoogle}
          >
            <FaGoogle />
            Create Account Using Gmail
          </button>
        </div>

        <div className="relative text-center text-gray-400 dark:text-gray-300 my-4">
          <span className="bg-white dark:bg-gray-800 px-2 z-10 relative">
            or continue with email
          </span>
          <div className="absolute left-0 top-1/2 w-full border-t border-gray-300 dark:border-gray-600 z-0"></div>
        </div>

        <input
          type="email"
          placeholder="Email"
          className="w-full px-4 py-2 mb-3 rounded border dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          className="w-full px-4 py-2 mb-4 rounded border dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded transition"
          onClick={handleEmailAuth}
        >
          {isSignup ? "Sign Up" : "Sign In"}
        </button>

        <p className="text-center mt-4 text-sm text-gray-600 dark:text-gray-300">
          {isSignup ? "Already have an account?" : "Don't have an account?"}
          <button
            className="ml-1 text-indigo-600 hover:underline dark:text-indigo-400"
            onClick={() => setIsSignup(!isSignup)}
          >
            {isSignup ? "Sign in" : "Sign up"}
          </button>
        </p>

        <div className="text-center mt-6">
          <button
            onClick={toggleTheme}
            className="text-sm text-gray-600 dark:text-gray-300 hover:underline"
          >
            Toggle to {theme === "light" ? "Dark" : "Light"} Mode
          </button>
        </div>
      </div>
    </div>
  );
};

export default SigninPage;
