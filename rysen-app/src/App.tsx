import { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import OnboardingPage from "./pages/Onbarding";
import SigninPage from "./pages/SigninPage";
import DonationModal from "./components/DonationModal";
import DonationSuccessPage from "./pages/DonationSuccessPage"; // create this page
import ChatPage from "./pages/ChatPage";
import SettingsPage from "./pages/Settings";
import { Toaster } from "react-hot-toast";
// import { Settings } from "lucide-react";

interface User {
  uid : string;
  name: string;
  email: string;
  login_count: string;
  onboarded: boolean;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [showDonation, setShowDonation] = useState(false);
  const [email, setEmail] = useState("");

  const handleLogin = (userData: User) => {
    setUser(userData);
    localStorage.setItem("login_count", userData.login_count);
    localStorage.removeItem("greeted");
    setEmail(userData.email);
    setHasOnboarded(userData.onboarded);
     // so greeting shows again on login
  };

  const handleFinishOnboarding = () => {
    setHasOnboarded(true);
  };

  return (
    <ThemeProvider>
      <Toaster position="top-center" reverseOrder={false} />
      <Router>
        {showDonation && (
          <DonationModal
            onClose={() => setShowDonation(false)}
          />
        )}
        <Routes>
          <Route path="/signin" element={<SigninPage onLogin={handleLogin} />} />
          <Route
            path="/onboarding"
            element={
              user ? (
                <OnboardingPage
                  onFinish={handleFinishOnboarding}
                  showDonationPrompt={() => setShowDonation(true)}
                />
              ) : (
                <Navigate to="/signin" replace />
              )
            }
          />
          <Route path="/donate-success" element={<DonationSuccessPage />} />
          <Route
            path="/"
            element={
              user ? (
                hasOnboarded ? (
                  <div className="flex items-center justify-center h-screen bg-white dark:bg-black text-black dark:text-white">
                    <h1 className="text-2xl font-semibold">Welcome to Rysen!</h1>
                  </div>
                ) : (
                  <Navigate to="/onboarding" replace />
                )
              ) : (
                <Navigate to="/signin" replace />
              )
            }
          />
          <Route path="/chat" element={<ChatPage showDonation={()=>setShowDonation(true)} />} />
          <Route path="/settings" element={<SettingsPage showDonation={()=>setShowDonation(true)} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
