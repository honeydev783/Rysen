import React, { useState } from "react";
import { MailIcon } from "lucide-react"; // mail icon from lucide
import { FaGoogle } from "react-icons/fa"; // Google icon
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

interface User {
  uid: string;
  name: string;
  login_count: string;
  onboarded: boolean;
  email: string;
  // Add other user properties as needed
}
const HomeScreen = () => {
  const { setUser } = useAuth(); // 👈 get setUser from context
  const [isSignup, setIsSignup] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [loading, setLoading] = useState(false);
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
      setUser({
        name: userData.name,
        login_count: userData.login_count,
        email: userData.email,
        onboarded: userData.onboarded,
        uid: userData.uid,
        theme: userData.theme,
        responseStyle: userData.responseStyle,
        avatar: userData.avatar,
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
  const handleGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      setGoogleLoading(true);
      const result = await signInWithPopup(auth, provider);
      setIsSignup(false);
      await handleAuth(result.user);
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
      <div className="relative min-h-screen bg-[#171717]">
        {/* Fullscreen GIF background */}
        <img
          src="/SplashGif.gif"
          alt="Spiritual Animation"
          className="absolute inset-0 object-cover w-full h-full"
        />

        {/* Gradient overlay starting from middle with stronger fade */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to bottom, rgba(23,23,23,0) 45%, rgba(23,23,23,0.98) 62%, #171717 100%)",
          }}
        />

        {/* Content */}
        <div className="relative flex flex-col justify-end min-h-screen px-4 pb-6 text-center">
          <h1 className="text-white font-roboto font-semibold text-[24px]">
            Welcome to Rysen
          </h1>
          <p className="text-white font-roboto font-normal text-[15px] mt-2">
            Your space for prayerful guidance, spiritual reflection, and
            companionship on the journey of faith.
          </p>

          <div className="mt-8 w-full max-w-sm mx-auto">
            <button
              className="flex items-center justify-center gap-2 w-full bg-white rounded-[33px] py-3"
              onClick={() => navigate("/login")}
            >
              <MailIcon size={18} color="#333333" />
              <span className="text-[#333333] font-roboto font-medium text-[15px]">
                Create Account Using Email
              </span>
            </button>

            <div className="mt-4" />

            <button
              className="flex items-center justify-center gap-2 w-full bg-[#333333] rounded-[33px] py-3"
              onClick={handleGoogle}
            >
              <FaGoogle size={15} color="#E3E3E3" />
              <span className="text-white font-roboto font-medium text-[15px]">
                Create account using Gmail
              </span>
            </button>
          </div>

          <div
            className="flex justify-center gap-1 mt-6"
            onClick={() => navigate("/login")}
          >
            <span className="text-[#CCCDD1] font-roboto font-normal text-[15px]">
              Already have an account?
            </span>
            <span className="text-[#DB9A98] font-roboto font-normal text-[15px] cursor-pointer">
              Log In
            </span>
          </div>
        </div>
      </div>
    );
  }
};

export default HomeScreen;
