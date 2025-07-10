import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen justify-center items-center bg-gradient-to-b from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="text-center space-y-6">
        <img src="/logo.svg" alt="Rysen Logo" className="h-16 mx-auto" />
        <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white">
          Welcome to <span className="text-indigo-600 dark:text-indigo-400">Rysen</span>
        </h1>
        <p className="text-lg text-gray-700 dark:text-gray-300">
          Your spiritual companion on the journey to God
        </p>

        <div className="space-x-4">
          <Link to="/login" className="px-6 py-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700">
            Get Started
          </Link>
          
        </div>
      </div>
    </div>
  );
}