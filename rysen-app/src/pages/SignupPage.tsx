import { useState } from "react";
import { auth, googleProvider, facebookProvider } from "../firebase";
import { createUserWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { useNavigate, Link } from "react-router-dom";
import { FcGoogle } from "react-icons/fc";
import { FaFacebookF } from "react-icons/fa";
export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const signUp = async () => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      navigate("/onboarding");
    } catch (err) {
      alert("Signup failed: " + (err as Error).message);
    }
  };

  const signUpWithGoogle = () =>
    signInWithPopup(auth, googleProvider).then(() => navigate("/onboarding"));
  const signUpWithFacebook = () =>
    signInWithPopup(auth, facebookProvider).then(() => navigate("/onboarding"));

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 bg-gradient-to-br from-white to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-md p-6 bg-white dark:bg-gray-900 rounded-xl shadow-xl">
        <h2 className="text-2xl font-semibold mb-6 text-center text-indigo-700 dark:text-white">
          Create Your Account
        </h2>

        <input
          type="email"
          placeholder="Email"
          className="w-full mb-3 p-3 border rounded dark:bg-gray-800 dark:text-white"
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          className="w-full mb-4 p-3 border rounded dark:bg-gray-800 dark:text-white"
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          onClick={signUp}
          className="w-full mb-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          Sign Up
        </button>

        <div className="flex flex-col gap-3 mt-4">
          <div className="flex flex-row justify-center items-center gap-3 bg-white text-gray-800 border rounded py-2 hover:bg-gray-100">
            <FcGoogle size={20} />
            <button onClick={signUpWithGoogle} className="">
              Sign up with Google
            </button>
          </div>
          <div className="flex flex-row justify-center items-center gap-3 bg-blue-600 text-white rounded py-2 hover:bg-blue-700">
            <FaFacebookF size={18} />
            <button onClick={signUpWithFacebook} className="">
              Sign up with Facebook
            </button>
          </div>
          
        </div>

        <p className="text-center mt-6 text-sm text-gray-500 dark:text-gray-400">
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-indigo-600 dark:text-indigo-400 underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
