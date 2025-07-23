import { useEffect, useState } from "react";
import { getToken } from "firebase/messaging";
import { getAuth } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteField,
} from "firebase/firestore";
import { db, messaging } from "../firebase";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";
import { HeartIcon } from "@heroicons/react/24/outline";
const ageOptions = ["Under 16", "16–24", "25–34", "35–49", "50+"];

const avatarOptions = [
  {
    key: "Pio",
    name: "Pio",
    image: "/avatars/avatar1.png",
    description:
      "Inspired by the life and works of Saint Padre Pio, a man of deep prayer, miraculous healing, and tireless dedication to the confessional.",
  },
  {
    key: "Thérèse",
    name: "Thérèse",
    image: "/avatars/avatar2.png",
    description:
      "Inspired by the life and works of St. Thérèse of Lisoux, the Little Flower, who taught us to find holiness in small, simple acts of love with great trust in God’s mercy.",
  },
  {
    key: "Kim",
    name: "Kim",
    image: "/avatars/avatar3.png",
    description:
      "Kim is a bubbly, friendly youth leader who’s passionate about her faith and loves walking alongside others in their spiritual journey.",
  },
  {
    key: "Dan",
    name: "Dan",
    image: "/avatars/avatar4.png",
    description:
      "Dan is a 40-something father of three who understands the real-life challenges of living out faith while managing work, family, and daily struggles.",
  },
];

interface SettingsPageProps {
  showDonation: () => void;
  hideSkipping: () => void;
}
export default function SettingsPage({
  showDonation,
  hideSkipping,
}: SettingsPageProps) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    age_range: "",
    sex: "",
    life_stage: "",
    spiritual_maturity: 1.0,
    spiritual_goals: [] as string[],
    avatar: "",
    notificationsEnabled: false,
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchUserSettings = async () => {
      const auth = getAuth();
      const user = auth.currentUser;
      console.log("user===>", user);
      if (!user) return;

      const docRef = doc(db, "users", user.uid);
      const snap = await getDoc(docRef);
      console.log("snap===>", snap.data());
      if (snap.exists()) {
        setFormData({ ...formData, ...snap.data() });
      }
    };

    fetchUserSettings();
  }, []);

  const toggleGoal = (goal: string) => {
    setFormData((prev) => {
      const exists = prev.spiritual_goals.includes(goal);
      return {
        ...prev,
        spiritual_goals: exists
          ? prev.spiritual_goals.filter((g) => g !== goal)
          : [...prev.spiritual_goals, goal],
      };
    });
  };

  const toggleNotifications = async () => {
    const enabled = !formData.notificationsEnabled;
    setFormData((prev) => ({ ...prev, notificationsEnabled: enabled }));

    const auth = getAuth();
    const user = auth.currentUser;
    if (enabled) {
      try {
        const token = await getToken(messaging, {
          vapidKey:
            "BCMW_1bVlIj4L6Tcm9NyYTZb5uDfjisopKjKybhNfMXgs3s-JFYDVGyOSRgC7FWwHTkAUL5qbgE_aX7dcMaAP88",
        });
        await updateDoc(doc(db, "users", user.uid), {
          notificationsEnabled: true,
          fcmToken: token,
        });

        toast.success("Notifications enabled!");
      } catch (err) {
        toast.error("Failed to enable notifications.");
        console.error(err);
      }
    } else {
      await updateDoc(doc(db, "users", user.uid), {
        notificationsEnabled: false,
        fcmToken: "",
      });
      toast.success("Notifications disabled.");
    }

    // await updateDoc(doc(db, "users", user.uid), {
    //   notificationsEnabled: enabled,
    // });

    // toast.success(`Notifications ${enabled ? "enabled" : "disabled"}.`);
  };

  const saveSettings = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    try {
      await setDoc(doc(db, "users", user.uid), formData, { merge: true });
      toast.success("Settings updated.");
      navigate("/chat");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update settings.");
    }
  };

  const clearChatHistory = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      navigate("/signin");
      return;
    }
    try {
      await api.delete(`/api/chat-sessions/user/${user.uid}`);
      console.log("Deleted all chat sessions.");
      toast.success("Chat history cleared.");
    } catch (error: any) {
      if (error.response?.status === 404) {
        toast.error("No chat sessions found to delete.");
        console.warn("No sessions found.");
      } else {
        toast.error("Failed to clear chat history.");
        console.error("Failed to delete chat sessions:", error);
      }
    }
  };

  const clearPastoralMemory = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    await updateDoc(doc(db, "users", user.uid), {
      memory: deleteField(),
    });

    toast.success("Pastoral memory cleared.");
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: "Rysen – Catholic AI Spiritual Companion",
          text: "Find peace and guidance in your walk with Christ. Try Rysen today!",
          url: "https://rysen.app",
        })
        .then(() => toast.success("Thanks for sharing!"))
        .catch(() => toast.error("Share canceled."));
    } else {
      navigator.clipboard.writeText("https://rysen.app");
      toast.success("Link copied to clipboard.");
    }
  };

  const redirectToDonate = () => {
    // window.location.href = "/donate";
    hideSkipping();
    showDonation();
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white px-4 py-8">
      <div className="max-w-xl mx-auto bg-white dark:bg-gray-800 p-6 rounded-xl shadow relative">
        <div className="flex justify-end">
          <button
            onClick={() => {
              navigate(-1);
            }}
            className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white text-2xl font-semibold leading-none"
          >
            &times;
          </button>
        </div>

        <h2 className="text-2xl font-semibold mb-6">Settings</h2>

        {/* Name + Age */}
        <div className="mb-6">
          <label className="block mb-2">Name</label>
          <input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full p-2 border rounded dark:bg-gray-700"
            placeholder="Your Name"
          />

          <label className="block mt-4 mb-2">Age Range</label>
          <select
            value={formData.age_range}
            onChange={(e) =>
              setFormData({ ...formData, age_range: e.target.value })
            }
            className="w-full p-2 border rounded dark:bg-gray-700"
          >
            <option value="">Select Age Range</option>
            {ageOptions.map((opt) => (
              <option key={opt}>{opt}</option>
            ))}
          </select>
        </div>

        {/* Sex + Life Stage */}
        <div className="mb-6">
          <label className="block mb-2">Sex</label>
          <select
            value={formData.sex}
            onChange={(e) => setFormData({ ...formData, sex: e.target.value })}
            className="w-full p-2 border rounded dark:bg-gray-700"
          >
            <option value="">Select</option>
            <option>Male</option>
            <option>Female</option>
            <option>Prefer not to say</option>
          </select>

          <label className="block mt-4 mb-2">Life Stage</label>
          <select
            value={formData.life_stage}
            onChange={(e) =>
              setFormData({ ...formData, life_stage: e.target.value })
            }
            className="w-full p-2 border rounded dark:bg-gray-700"
          >
            <option value="">Select</option>
            <option>Single</option>
            <option>Married</option>
            <option>Married with children</option>
            <option>Religious (Priest, Nun, etc)</option>
          </select>
        </div>

        {/* Spiritual Maturity */}
        <div className="mb-6">
          <label className="block mb-2">Spiritual Maturity</label>
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={formData.spiritual_maturity}
            onChange={(e) =>
              setFormData({
                ...formData,
                spiritual_maturity: parseFloat(e.target.value),
              })
            }
            className="w-full"
          />
          <div className="flex justify-between text-sm">
            <span>Exploring</span>
            <span>Growing</span>
            <span>Mature</span>
          </div>
        </div>

        {/* Spiritual Goals */}
        <div className="mb-6">
          <label className="block mb-2">Spiritual Goals</label>
          <div className="flex flex-wrap gap-2">
            {[
              "Grow my prayer life",
              "Get closer to God",
              "Learn more about my faith",
              "Find peace in suffering",
              "Help me discern life decisions",
              "Strengthen my marriage or family life",
              "Support me through grief",
              "Overcome temptation",
            ].map((goal) => (
              <button
                key={goal}
                onClick={() => toggleGoal(goal)}
                className={`px-3 py-1 rounded-full border text-sm ${
                  formData.spiritual_goals.includes(goal)
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700"
                }`}
              >
                {goal}
              </button>
            ))}
          </div>
        </div>

        {/* Avatar */}
        <div className="mb-6">
          <label className="block mb-4 text-lg font-medium">
            Your Spiritual Companion
          </label>
          <div className="grid grid-cols-2 gap-4">
            {avatarOptions.map((avatar) => (
              <button
                key={avatar.key}
                onClick={() => setFormData({ ...formData, avatar: avatar.key })}
                className={`border rounded-xl p-3 text-left transition ${
                  formData.avatar === avatar.key
                    ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-800 dark:border-indigo-400"
                    : "border-gray-300 dark:border-gray-700"
                }`}
              >
                <strong className="text-sm">{avatar.name}</strong>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                  {avatar.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Extras */}
        <div className="space-y-3 mt-8">
          {/* <button
            onClick={toggleNotifications}
            className="w-full px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            {formData.notificationsEnabled ? "Disable" : "Enable"} Notifications
          </button> */}
          <button
            onClick={clearChatHistory}
            className="w-full px-4 py-2 rounded bg-red-500 text-white hover:bg-red-600"
          >
            Clear Chat History
          </button>
          <button
            onClick={clearPastoralMemory}
            className="w-full px-4 py-2 rounded bg-red-500 text-white hover:bg-red-600"
          >
            Clear Pastoral Memory
          </button>
          <button
            onClick={handleShare}
            className="w-full px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
          >
            Share Rysen with Others
          </button>
          {/* <button
            onClick={redirectToDonate}
            className="w-full px-4 py-2 rounded bg-yellow-500 text-white hover:bg-yellow-600"
          >
            Make a Donation
          </button> */}
          <button
            onClick={redirectToDonate}
            className="flex items-center gap-2 w-full text-left text-[#DB9A98] hover:text-[#DB9A98]"
          >
            <HeartIcon className="w-5 h-5" />
            <span>Make a Donation</span>
          </button>
        </div>

        {/* Save Button */}
        <div className="mt-8 text-right">
          <button
            onClick={saveSettings}
            disabled={loading}
            className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
          >
            {loading ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
