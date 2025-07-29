import { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import OnboardingPage from "./pages/Onbarding";
// import SigninPage from "./pages/homePage";
import DonationModal from "./components/DonationModal";
import DonationSuccessPage from "./pages/DonationSuccessPage";
import ChatPage from "./pages/ChatPage";
import SettingsPage from "./pages/Settings";
import WelcomePage from "./pages/WelcomePage";
import AboutPage from "./pages/AboutPage";
import { Toaster } from "react-hot-toast";
import TermsOfServicePage from "./pages/TermsOfServicePage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import PrayerPage from "./pages/PrayerPage";
import BiblePage from "./pages/BiblePage";
import HomeScreen from "./pages/HomeScreen";
import LoginPage from "./pages/LoginPage";
import OnboardingPageNew from "./pages/OnboardingPage";
function AppContent() {
  const { user, loading } = useAuth();
  const [showDonation, setShowDonation] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showiOSGuide, setShowiOSGuide] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showSkipping, setShowSkipping] = useState(true);
  // Handle install prompts
  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone;

    if (isStandalone) return;

    const pwaPromptShown = localStorage.getItem("pwaPromptShown");

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!pwaPromptShown) {
        setShowInstallPrompt(true);
        localStorage.setItem("pwaPromptShown", "true");
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

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
        }
        setDeferredPrompt(null);
      });
    }
    setShowInstallPrompt(false);
  };

  return (
    <>
      <Toaster position="top-center" reverseOrder={false} />
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

      {showDonation && (
        <DonationModal
          onClose={() => setShowDonation(false)}
          showSkipping={showSkipping}
        />
      )}

      <Routes>
        <Route path="/home" element={<HomeScreen />} />
        {/* <Route path="/home" element={<SigninPage />} /> */}
        <Route path="/donate-success" element={<DonationSuccessPage />} />
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/onboard"
          element={
            <OnboardingPageNew
              showDonationPrompt={() => setShowDonation(true)}
            />
          }
        />
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <OnboardingPage
                onFinish={() => {}}
                showDonationPrompt={() => setShowDonation(true)}
              />
            </ProtectedRoute>
          }
        />
        <Route path="/chat" element={<ChatPage />} />
        <Route
          path="/prayer"
          element={
            <ProtectedRoute>
              <PrayerPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bible"
          element={
            <ProtectedRoute>
              <BiblePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <SettingsPage
              showDonation={() => setShowDonation(true)}
              hideSkipping={() => setShowSkipping(false)}
            />
          }
        />
        {/* <Route path="/" element={<HomeScreen />} /> */}
        <Route
          path="/"
          element={
            loading ? (
              <div className="h-screen flex items-center justify-center text-gray-500 dark:text-gray-400"></div>
            ) : user ? (
              user.onboarded ? (
                <Navigate to="/welcome" replace />
              ) : (
                <Navigate to="/onboard" replace />
              )
            ) : (
              <Navigate to="/home" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}
