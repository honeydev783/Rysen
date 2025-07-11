import { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import OnboardingPage from "./pages/Onbarding";
import SigninPage from "./pages/SigninPage";
import DonationModal from "./components/DonationModal";
import DonationSuccessPage from "./pages/DonationSuccessPage"; // create this page
import ChatPage from "./pages/ChatPage";
import SettingsPage from "./pages/Settings";
import { Toaster } from "react-hot-toast";
import WelcomePage from "./pages/WelcomePage";
import { useNavigate } from "react-router-dom";

interface User {
  uid: string;
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
  // const navigate = useNavigate();
  // PWA install prompt handling
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showiOSGuide, setShowiOSGuide] = useState(false);
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
  // Detect PWA and show install prompt or guide
  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone;
    console.log("isStandalone===>", isStandalone);
    if (isStandalone) return; // already installed

    const pwaPromptShown = localStorage.getItem("pwaPromptShown");

    // Android: listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e: any) => {
      console.log("isStandalone===>handleBeforeInstallPrompt", isStandalone);
      e.preventDefault();
      setDeferredPrompt(e);

      if (!pwaPromptShown) {
        setShowInstallPrompt(true);
        localStorage.setItem("pwaPromptShown", "true");
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // iOS: show guide if Safari on iOS and not standalone
    const isIos = /iphone|ipad|ipod/.test(
      window.navigator.userAgent.toLowerCase()
    );
    const isInSafari = /^((?!chrome|android).)*safari/i.test(
      navigator.userAgent
    );

    if (isIos && isInSafari && !isStandalone && !pwaPromptShown) {
      setShowiOSGuide(true);
      localStorage.setItem("pwaPromptShown", "true");
    }

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
  }, []);

  const installPWA = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === "accepted") {
          console.log("PWA installed");
        } else {
          console.log("PWA dismissed");
        }
        setDeferredPrompt(null);
      });
    }
    setShowInstallPrompt(false);
  };
  return (
    <ThemeProvider>
      <Toaster position="top-center" reverseOrder={false} />
      <Router>
        {/* PWA Android Banner */}
        {showInstallPrompt && (
          <div className="fixed bottom-4 left-4 right-4 bg-white dark:bg-gray-800 shadow-xl border border-gray-300 dark:border-gray-700 p-4 rounded-xl z-50 flex flex-col md:flex-row items-center justify-between">
            <p className="text-sm mb-2 md:mb-0 text-center md:text-left text-gray-800 dark:text-white">
              Install Rysen for a better experience.
            </p>
            <div className="flex gap-2">
              <button
                onClick={installPWA}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
              >
                Install
              </button>
              <button
                onClick={() => {
                  setShowInstallPrompt(false);
                  localStorage.removeItem("pwaPromptShown");
                }}
                className="text-sm text-gray-600 dark:text-gray-300 hover:underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* PWA iOS Guide */}
        {showiOSGuide && (
          <div className="fixed bottom-4 left-4 right-4 bg-white dark:bg-gray-800 shadow-xl border border-gray-300 dark:border-gray-700 p-4 rounded-xl z-50">
            <p className="text-sm text-gray-800 dark:text-white mb-2">
              Install Rysen by tapping <strong>Share</strong> then{" "}
              <strong>"Add to Home Screen"</strong>.
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setShowiOSGuide(false);
                  localStorage.removeItem("pwaPromptShown");
                }}
                className="text-sm text-gray-600 dark:text-gray-300 hover:underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        {/* Donation Modal */}
        {showDonation && (
          <DonationModal onClose={() => setShowDonation(false)} />
        )}
        <Routes>
          <Route
            path="/signin"
            element={<SigninPage onLogin={handleLogin} />}
          />
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
          <Route path="/welcome" element={<WelcomePage />} />
          <Route
            path="/"
            element={
              user ? (
                hasOnboarded ? (
                  <Navigate to="/welcome" replace />
                ) : (
                  <Navigate to="/onboarding" replace />
                )
              ) : (
                <Navigate to="/signin" replace />
              )
            }
          />
          <Route
            path="/chat"
            element={<ChatPage showDonation={() => setShowDonation(true)} />}
          />
          <Route
            path="/settings"
            element={
              <SettingsPage showDonation={() => setShowDonation(true)} />
            }
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
