import { useState } from "react";
import { FaEye, FaEyeSlash, FaFacebookF, FaGoogle } from "react-icons/fa";
import { IoIosArrowBack } from "react-icons/io";
import { useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext"; // 👈 import useAuth
import { toast } from "react-hot-toast";
import api from "../utils/api";
import { ClipLoader } from "react-spinners";

interface User {
  uid: string;
  name: string;
  login_count: string;
  onboarded: boolean;
  email: string;
  // Add other user properties as needed
}

export default function LoginPage() {
  const { user, setUser } = useAuth(); // 👈 get setUser from
  const [isSignup, setIsSignup] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const navigate = useNavigate();
  const handleAuth = async (firebaseUser: any, type: string) => {
    const idToken = await firebaseUser.getIdToken();
    console.log("idToken===>", idToken);
    try {
      let endpoint;
      if (type == "email") {
        endpoint = isSignup ? "/auth/signup" : "/auth/signin";
      } else {
        endpoint = "/auth/signin";
      }
      const response = await api.post(`${endpoint}`, {
        id_token: idToken,
      });
      console.log("response==>", response.data);
      const userData = response.data;
      toast.success(isSignup ? "Signup successful!" : "Login successful!");
      if (isSignup) {
        setIsSignup(false);
        setLoading(false);
        return;
      }
      setUser({
        name: userData.name,
        login_count: userData.login_count,
        email: userData.email,
        onboarded: userData.onboarded,
        uid: userData.uid,
        theme: userData.theme,
        responseStyle: userData.responseStyle,
      });

      if (userData.onboarded) {
        setGoogleLoading(false);
        setLoading(false);
        navigate("/welcome");
      } else {
        setGoogleLoading(false);
        setLoading(false);
        navigate("/onboard");
      }
    } catch (err) {
      console.error("Error calling FastAPI backend:", err);
    }
  };

  const handleEmailAuth = async () => {
    if (isSignup && !acceptedTerms) {
      toast.error(
        "You must accept the Terms and confirm you're 16+ to sign up."
      );
      return;
    }
    try {
      setLoading(true);
      const userCredential = isSignup
        ? await createUserWithEmailAndPassword(auth, email, password)
        : await signInWithEmailAndPassword(auth, email, password);
      console.log("userCredential====>", userCredential);

      await handleAuth(userCredential.user, "email");
    } catch (error) {
      console.error("Firebase email auth error:", error);
      if (error.code === "auth/email-already-in-use") {
        toast.error("This email is already registered. Please log in.");
        setLoading(false);
        return;
      } else if (error.code === "auth/user-not-found") {
        toast.error("No user found with this email.");
        setLoading(false);
        return;
      } else if (error.code === "auth/invalid-credential") {
        toast.error("Please check your Email or Password.");
        setLoading(false);
        return;
      } else if (error.code === "auth/wrong-password") {
        toast.error("Incorrect password. Please try again.");
        setLoading(false);
        return;
      } else if (error.code === "auth/invalid-email") {
        toast.error("Please enter a valid email address.");
        setLoading(false);
        return;
      } else if (error.code === "auth/weak-password") {
        toast.error("Password should be at least 6 characters.");
        setLoading(false);
        return;
      } else {
        toast.error("Authentication failed. Please try again.");
        setLoading(false);
        return;
      }
    }
  };

  const handleGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      setGoogleLoading(true);
      const result = await signInWithPopup(auth, provider);
      setIsSignup(false);
      await handleAuth(result.user, "google");
    } catch (error) {
      console.error("Google login error:", error);
      toast.error("Authentication failed. Please try again.");
    }
  };
  if (googleLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gray-100  transition-colors">
        <img src="/full-black-logo.png" />
      </div>
    );
  } else {
    return (
      <div
        className={`min-h-screen flex flex-col px-6 pt-6 relative bg-[#FFFFFF]`}
      >
        {/* Top-left back arrow */}
        <button
          className="text-[#333333] dark:text-white"
          onClick={() => navigate(-1)}
        >
          <IoIosArrowBack size={24} />
        </button>

        {/* Spacing ~100 */}
        <div className="mt-[80px] max-w-md mx-auto w-full">
          {/* Welcome text */}
          <h1 className="text-[24px] font-roboto font-semibold text-[#333333] dark:text-white text-center">
            Welcome to Rysen
          </h1>

          {/* spacing 32 */}
          <div className="mt-8">
            {/* Email */}
            <label className="block mb-2 text-[15px] font-roboto font-medium text-[#333333] dark:text-white">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-[8px] bg-[#f5f5f5] dark:bg-[#282828] text-[#333333] dark:text-white placeholder:text-[#aaa] outline-none"
              placeholder="Enter your email"
            />
          </div>

          {/* spacing */}
          <div className="mt-4">
            {/* Password */}
            <label className="block mb-2 text-[15px] font-roboto font-medium text-[#333333] dark:text-white">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="w-full px-4 py-3 rounded-[8px] bg-[#f5f5f5] dark:bg-[#282828] text-[#333333] dark:text-white placeholder:text-[#aaa] outline-none"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#333333] dark:text-white"
              >
                {showPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
              </button>
            </div>
          </div>

          {/* spacing */}
          <div className="mt-4 flex items-start gap-2">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="accent-[#494A51] w-4 h-4 bg-[#282828] border border-[#494A51]"
            />
            <p className="text-[13px] text-[#666666] dark:text-[#CCCDD1]">
              By checking this box, I confirm I am 16 or older and agree to the{" "}
              <span className="text-[#DB9A98] cursor-pointer">
                Privacy Policy
              </span>{" "}
              and{" "}
              <span className="text-[#DB9A98] cursor-pointer">
                Terms of Service
              </span>
              .
            </p>
          </div>

          {/* spacing 40 */}
          <div className="mt-10">
            <button
              className="w-full bg-[#333333] dark:bg-white text-white dark:text-[#333333] py-3 rounded-[33px] font-roboto font-medium text-[15px]"
              onClick={handleEmailAuth}
            >
              {isSignup ? "Create Account" : "Log In"}
            </button>
          </div>

          {/* spacing 16 */}
          <div className="mt-4 flex items-center justify-center gap-2 text-[#999] dark:text-[#CCCDD1]">
            <div className="flex-1 h-px bg-[#ccc] dark:bg-[#333]" />
            <span className="text-[13px]">or continue with</span>
            <div className="flex-1 h-px bg-[#ccc] dark:bg-[#333]" />
          </div>

          {/* icons */}
          <div className="mt-4 flex justify-center gap-4">
            {/* <button
              className="w-10 h-10 rounded-full bg-[#e3e3e3] dark:bg-[#333333] flex items-center justify-center"
              onClick={handleGoogle}
            >
              <FaFacebookF
                size={20}
                className="text-[#4267B2] dark:text-[#E3E3E3]"
              />
            </button> */}
            <button
              className="w-10 h-10 rounded-full bg-[#e3e3e3] dark:bg-[#333333] flex items-center justify-center"
              onClick={handleGoogle}
            >
              <FaGoogle
                size={20}
                className="text-[#666666] dark:text-[#666666]"
              />
            </button>
          </div>

          {/* bottom text */}
          <div className="mt-8 text-center">
            <span className="text-[15px] text-[#999999] dark:text-[#CCCDD1]">
              Already have an account?{" "}
            </span>
            <span
              className="text-[15px] text-[#DB9A98] cursor-pointer"
              onClick={() => setIsSignup(false)}
            >
              Log In
            </span>
          </div>
          {loading && (
            <div className="fixed inset-0 z-50 bg-black  flex items-center justify-center">
              {/* <ClipLoader color="#fff" size={48} /> */}
              <img src="/full-white-logo.png" />
            </div>
          )}
        </div>
      </div>
    );
  }
}
