import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function DonationSuccessPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Optionally delay redirect or show follow-up logic
    const timer = setTimeout(() => {
      navigate("/welcome"); // or home/dashboard route
    }, 5000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg text-center max-w-md">
        <h1 className="text-2xl font-semibold text-green-600 mb-4">
          Thank you for supporting Rysen!
        </h1>
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          Your generous donation helps us continue building this spiritual
          companion. May God bless your generosity!
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Redirecting you shortly...
        </p>
      </div>
    </div>
  );
}