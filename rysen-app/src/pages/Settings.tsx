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
import {
  HeartIcon,
  ShareIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/24/outline";
import { ChevronRightIcon, ChevronLeftIcon } from "@heroicons/react/20/solid";

interface SettingsPageProps {
  showDonation: () => void;
  hideSkipping: () => void;
}

const ageOptions = ["Under 16", "16–24", "25–34", "35–49", "50+"];

const avatarOptions = [
  {
    key: "Pio",
    name: "Pio",
    image: "/avatars/avatar1.png",
    description: "Inspired by the life and works of Saint Padre Pio.",
  },
  {
    key: "Thérèse",
    name: "Thérèse",
    image: "/avatars/avatar2.png",
    description: "Inspired by St. Thérèse of Lisoux, the Little Flower.",
  },
  {
    key: "Kim",
    name: "Kim",
    image: "/avatars/avatar3.png",
    description: "Bubbly, friendly youth leader passionate about faith.",
  },
  {
    key: "Dan",
    name: "Dan",
    image: "/avatars/avatar4.png",
    description: "Father of three, understands real-life faith challenges.",
  },
];

export default function SettingsPage({
  showDonation,
  hideSkipping,
}: SettingsPageProps) {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState(null); // null | 'personal' | 'personalization' | 'privacy'
  const [loading, setLoading] = useState(false);
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

  useEffect(() => {
    const fetchUserSettings = async () => {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;
      const docRef = doc(db, "users", user.uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) setFormData((prev) => ({ ...prev, ...snap.data() }));
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

  const saveSettings = async () => {
    setLoading(true);
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;
    try {
      await setDoc(doc(db, "users", user.uid), formData, { merge: true });
      toast.success("Settings updated.");
      navigate("/chat");
    } catch (err) {
      toast.error("Failed to update settings.");
      console.error(err);
    }
    setLoading(false);
  };

  const clearChatHistory = async () => {
    const user = getAuth().currentUser;
    if (!user) return navigate("/signin");
    try {
      await api.delete(`/api/chat-sessions/user/${user.uid}`);
      toast.success("Chat history cleared.");
    } catch (err) {
      toast.error("Failed to clear chat history.");
    }
  };

  const clearPastoralMemory = async () => {
    const user = getAuth().currentUser;
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid), { memory: deleteField() });
    toast.success("Pastoral memory cleared.");
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: "Rysen – Catholic AI Spiritual Companion",
          text: "Find peace and guidance. Try Rysen today!",
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
    hideSkipping();
    showDonation();
  };

  const sendFeedback = () => {
    toast.success("Redirecting to feedback...");
  };

  const openLink = (url) => window.open(url, "_blank");
  return (
    <div className="min-h-screen w-full bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
      <div className="flex flex-col max-w-xl mx-auto bg-white dark:bg-gray-800 min-h-screen">
        {/* Header row: back + save */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() =>
              activeSection ? setActiveSection(null) : navigate(-1)
            }
            className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
          >
            {activeSection ? (
              <ChevronLeftIcon className="w-6 h-6" />
            ) : (
              <span className="text-2xl leading-none">&times;</span>
            )}
          </button>

          {(activeSection === "personal" ||
            activeSection === "personalization") && (
            <button
              onClick={saveSettings}
              disabled={loading}
              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
            >
              {loading ? "Saving..." : "Save"}
            </button>
          )}
        </div>

        {/* Title */}
        <h2 className="text-xl font-semibold px-4 py-2 border-b border-gray-200 dark:border-gray-700">
          {activeSection === "personal"
            ? "Personal Details"
            : activeSection === "personalization"
            ? "App Personalization"
            : activeSection === "privacy"
            ? "Privacy & Security"
            : "Settings"}
        </h2>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          {!activeSection && (
            <>
              {[
                { key: "personal", label: "Personal Details" },
                { key: "personalization", label: "App Personalization" },
                { key: "privacy", label: "Privacy & Security" },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => setActiveSection(item.key)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-gray-200 dark:bg-gray-700"
                >
                  <span>{item.label}</span>
                  <ChevronRightIcon className="w-5 h-5" />
                </button>
              ))}

              <div className="space-y-2 mt-6">
                <button
                  onClick={handleShare}
                  className="flex items-center gap-2 text-[#DB9A98]"
                >
                  <ShareIcon className="w-5 h-5" />
                  Share Rysen with Others
                </button>
                <button
                  onClick={redirectToDonate}
                  className="flex items-center gap-2 text-[#DB9A98]"
                >
                  <HeartIcon className="w-5 h-5" />
                  Make a Donation
                </button>
                <button
                  onClick={sendFeedback}
                  className="flex items-center gap-2 text-[#DB9A98]"
                >
                  <PaperAirplaneIcon className="w-5 h-5" />
                  Send Feedback
                </button>
              </div>
            </>
          )}

          {/* Personal Details content here */}
          {activeSection === "personal" && (
            <>
              {/* Name + Age */}
              <div className="mb-6">
                <label className="block mb-2">Name</label>
                <input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
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
                  onChange={(e) =>
                    setFormData({ ...formData, sex: e.target.value })
                  }
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
            </>
          )}

          {/* App Personalization content */}
          {activeSection === "personalization" && (
            <>
              {/* Avatar */}
              <div className="mb-6">
                <label className="block mb-4 text-lg font-medium">
                  Your Spiritual Companion
                </label>
                <div className="grid grid-cols-2 gap-4">
                  {avatarOptions.map((avatar) => (
                    <button
                      key={avatar.key}
                      onClick={() =>
                        setFormData({ ...formData, avatar: avatar.key })
                      }
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
            </>
          )}

          {/* Privacy & Security */}
          {activeSection === "privacy" && (
            <div className="space-y-3">
              <button
                onClick={() => navigate("/terms")}
                className="w-full flex justify-between px-4 py-3 rounded-xl bg-gray-200 dark:bg-gray-700"
              >
                RYSEN - Terms of Service{" "}
                <ChevronRightIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => navigate("/privacy")}
                className="w-full flex justify-between px-4 py-3 rounded-xl bg-gray-200 dark:bg-gray-700"
              >
                RYSEN - Privacy Policy <ChevronRightIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => navigate("/about")}
                className="w-full flex justify-between px-4 py-3 rounded-xl bg-gray-200 dark:bg-gray-700"
              >
                RYSEN - About Us <ChevronRightIcon className="w-5 h-5" />
              </button>
              <button
                onClick={clearChatHistory}
                className="w-full px-4 py-2 rounded bg-red-500 text-white"
              >
                Clear Chat History
              </button>
              <button
                onClick={clearPastoralMemory}
                className="w-full px-4 py-2 rounded bg-red-500 text-white"
              >
                Delete Pastoral Memory
              </button>
              <button className="w-full flex justify-between px-4 py-3 rounded-xl bg-gray-200 dark:bg-gray-700">
                Opt out of Sharing App Analytics
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // return (
  //   <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white px-4 py-8">
  //     <div className="max-w-xl mx-auto bg-white dark:bg-gray-800 p-6 rounded-xl shadow">
  //       <div className="flex items-center mb-6">
  //         {activeSection ? (
  //           <button onClick={() => setActiveSection(null)} className="mr-2">
  //             <ChevronLeftIcon className="w-6 h-6 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white" />
  //           </button>
  //         ) : (
  //           <button onClick={() => navigate(-1)} className="mr-2 text-2xl">
  //             &times;
  //           </button>
  //         )}
  //         <h2 className="text-2xl font-semibold">
  //           {activeSection === "personal"
  //             ? "Personal Details"
  //             : activeSection === "personalization"
  //             ? "App Personalization"
  //             : activeSection === "privacy"
  //             ? "Privacy & Security"
  //             : "Settings"}
  //         </h2>
  //       </div>

  //       {/* Main Section */}
  //       {!activeSection && (
  //         <div className="space-y-3">
  //           {[
  //             { key: "personal", label: "Personal Details" },
  //             { key: "personalization", label: "App Personalization" },
  //             { key: "privacy", label: "Privacy & Security" },
  //           ].map((item) => (
  //             <button
  //               key={item.key}
  //               onClick={() => setActiveSection(item.key)}
  //               className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-gray-200 dark:bg-gray-700"
  //             >
  //               <span>{item.label}</span>
  //               <ChevronRightIcon className="w-5 h-5" />
  //             </button>
  //           ))}
  //           <div className="space-y-2 mt-6">
  //             <button
  //               onClick={handleShare}
  //               className="flex items-center gap-2 text-[#DB9A98]"
  //             >
  //               <ShareIcon className="w-5 h-5" />
  //               Share Rysen with Others
  //             </button>
  //             <button
  //               onClick={redirectToDonate}
  //               className="flex items-center gap-2 text-[#DB9A98]"
  //             >
  //               <HeartIcon className="w-5 h-5" />
  //               Make a Donation
  //             </button>
  //             <button
  //               onClick={sendFeedback}
  //               className="flex items-center gap-2 text-[#DB9A98]"
  //             >
  //               <PaperAirplaneIcon className="w-5 h-5" />
  //               Send Feedback
  //             </button>
  //           </div>
  //         </div>
  //       )}

  //       {/* Personal Details */}
  //       {activeSection === "personal" && (
  //         <>
  //           <div className="mb-6">
  //             <label className="block mb-2">Name</label>
  //             <input
  //               value={formData.name}
  //               onChange={(e) =>
  //                 setFormData({ ...formData, name: e.target.value })
  //               }
  //               className="w-full p-2 border rounded dark:bg-gray-700"
  //               placeholder="Your Name"
  //             />

  //             <label className="block mt-4 mb-2">Age Range</label>
  //             <select
  //               value={formData.age_range}
  //               onChange={(e) =>
  //                 setFormData({ ...formData, age_range: e.target.value })
  //               }
  //               className="w-full p-2 border rounded dark:bg-gray-700"
  //             >
  //               <option value="">Select Age Range</option>
  //               {ageOptions.map((opt) => (
  //                 <option key={opt}>{opt}</option>
  //               ))}
  //             </select>
  //           </div>

  //           {/* Sex + Life Stage */}
  //           <div className="mb-6">
  //             <label className="block mb-2">Sex</label>
  //             <select
  //               value={formData.sex}
  //               onChange={(e) =>
  //                 setFormData({ ...formData, sex: e.target.value })
  //               }
  //               className="w-full p-2 border rounded dark:bg-gray-700"
  //             >
  //               <option value="">Select</option>
  //               <option>Male</option>
  //               <option>Female</option>
  //               <option>Prefer not to say</option>
  //             </select>

  //             <label className="block mt-4 mb-2">Life Stage</label>
  //             <select
  //               value={formData.life_stage}
  //               onChange={(e) =>
  //                 setFormData({ ...formData, life_stage: e.target.value })
  //               }
  //               className="w-full p-2 border rounded dark:bg-gray-700"
  //             >
  //               <option value="">Select</option>
  //               <option>Single</option>
  //               <option>Married</option>
  //               <option>Married with children</option>
  //               <option>Religious (Priest, Nun, etc)</option>
  //             </select>
  //           </div>

  //           {/* Spiritual Maturity */}
  //           <div className="mb-6">
  //             <label className="block mb-2">Spiritual Maturity</label>
  //             <input
  //               type="range"
  //               min="1"
  //               max="3"
  //               step="0.01"
  //               value={formData.spiritual_maturity}
  //               onChange={(e) =>
  //                 setFormData({
  //                   ...formData,
  //                   spiritual_maturity: parseFloat(e.target.value),
  //                 })
  //               }
  //               className="w-full"
  //             />
  //             <div className="flex justify-between text-sm">
  //               <span>Exploring</span>
  //               <span>Growing</span>
  //               <span>Mature</span>
  //             </div>
  //           </div>

  //           {/* Spiritual Goals */}
  //           <div className="mb-6">
  //             <label className="block mb-2">Spiritual Goals</label>
  //             <div className="flex flex-wrap gap-2">
  //               {[
  //                 "Grow my prayer life",
  //                 "Get closer to God",
  //                 "Learn more about my faith",
  //                 "Find peace in suffering",
  //                 "Help me discern life decisions",
  //                 "Strengthen my marriage or family life",
  //                 "Support me through grief",
  //                 "Overcome temptation",
  //               ].map((goal) => (
  //                 <button
  //                   key={goal}
  //                   onClick={() => toggleGoal(goal)}
  //                   className={`px-3 py-1 rounded-full border text-sm ${
  //                     formData.spiritual_goals.includes(goal)
  //                       ? "bg-indigo-600 text-white"
  //                       : "bg-gray-200 dark:bg-gray-700"
  //                   }`}
  //                 >
  //                   {goal}
  //                 </button>
  //               ))}
  //             </div>
  //           </div>
  //         </>
  //       )}

  //       {/* App Personalization */}
  //       {activeSection === "personalization" && (
  //         <>
  //           <div className="mb-6">
  //             <label className="block mb-4 text-lg font-medium">
  //               Your Spiritual Companion
  //             </label>
  //             <div className="grid grid-cols-2 gap-4">
  //               {avatarOptions.map((avatar) => (
  //                 <button
  //                   key={avatar.key}
  //                   onClick={() =>
  //                     setFormData({ ...formData, avatar: avatar.key })
  //                   }
  //                   className={`border rounded-xl p-3 text-left transition ${
  //                     formData.avatar === avatar.key
  //                       ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-800 dark:border-indigo-400"
  //                       : "border-gray-300 dark:border-gray-700"
  //                   }`}
  //                 >
  //                   <strong className="text-sm">{avatar.name}</strong>
  //                   <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
  //                     {avatar.description}
  //                   </p>
  //                 </button>
  //               ))}
  //             </div>
  //           </div>
  //         </>
  //       )}

  //       {/* Privacy & Security */}
  //       {activeSection === "privacy" && (
  //         <div className="space-y-3">
  //           <button
  //             onClick={() => openLink("/terms")}
  //             className="w-full flex justify-between px-4 py-3 rounded-xl bg-gray-200 dark:bg-gray-700"
  //           >
  //             RYSEN - Terms of Service <ChevronRightIcon className="w-5 h-5" />
  //           </button>
  //           <button
  //             onClick={() => openLink("/privacy")}
  //             className="w-full flex justify-between px-4 py-3 rounded-xl bg-gray-200 dark:bg-gray-700"
  //           >
  //             RYSEN - Privacy Policy <ChevronRightIcon className="w-5 h-5" />
  //           </button>
  //           <button
  //             onClick={() => openLink("/about")}
  //             className="w-full flex justify-between px-4 py-3 rounded-xl bg-gray-200 dark:bg-gray-700"
  //           >
  //             RYSEN - About Us <ChevronRightIcon className="w-5 h-5" />
  //           </button>
  //           <button
  //             onClick={clearChatHistory}
  //             className="w-full px-4 py-2 rounded bg-red-500 text-white"
  //           >
  //             Clear Chat History
  //           </button>
  //           <button
  //             onClick={clearPastoralMemory}
  //             className="w-full px-4 py-2 rounded bg-red-500 text-white"
  //           >
  //             Delete Pastoral Memory
  //           </button>
  //           <button className="w-full flex justify-between px-4 py-3 rounded-xl bg-gray-200 dark:bg-gray-700">
  //             Opt out of Sharing App Analytics
  //           </button>
  //         </div>
  //       )}

  //       {/* Save Button */}
  //       {activeSection && (
  //         <div className="mt-8 text-right">
  //           <button
  //             onClick={saveSettings}
  //             disabled={loading}
  //             className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
  //           >
  //             {loading ? "Saving..." : "Save Settings"}
  //           </button>
  //         </div>
  //       )}
  //     </div>
  //   </div>
  // );
}
