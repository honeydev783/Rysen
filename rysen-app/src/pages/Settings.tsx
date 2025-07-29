import { useEffect, useState } from "react";
import { getAuth, signOut } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteField,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";
import {
  HeartIcon,
  ShareIcon,
  StarIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";
import { ChevronRightIcon, ChevronLeftIcon } from "@heroicons/react/20/solid";
import { TrashIcon, LogOut, Trash2Icon, ExternalLink } from "lucide-react";
import { useAuth } from "../context/AuthContext";
interface SettingsPageProps {
  showDonation: () => void;
  hideSkipping: () => void;
}

const avatarOptions = [
  {
    key: "Pio",
    description:
      "Modeled on Saint Padre Pio, a man of prayer, healing, and tireless devotion to the confessional.",
    img: "/avatars/Pio - Dark mode.svg",
  },
  {
    key: "Thérèse",
    description:
      "Inspired by St. Thérèse of Lisieux, who found holiness in small, loving acts and deep trust in God's mercy.",
    img: "/avatars/Therese - Dark mode.svg",
  },
  {
    key: "Kim",
    description:
      "A joyful and faith-filled youth leader who loves walking with others on their spiritual journey.",
    img: "/avatars/Kim - Dark mode.svg",
  },
  {
    key: "Dan",
    description:
      "A devoted father juggling faith, family and work, grounded in real-life spiritual struggles.",
    img: "/avatars/Dan - Dark mode.svg",
  },
];

export default function SettingsPage({
  showDonation,
  hideSkipping,
}: SettingsPageProps) {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const [activeSection, setActiveSection] = useState(null); // null | 'personal' | 'personalization' | 'privacy'
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    age_range: "",
    sex: "",
    life_stage: "",
    spiritual_maturity: "",
    spiritual_goals: [] as string[],
    avatar: "",
    theme: "",
    responseStyle: "",
    notificationsEnabled: false,
  });
  const [themeStyle, setThemeStyle] = useState("dark");
  const [responseStyle, setResponseStyle] = useState("default");
  useEffect(() => {
    const fetchUserSettings = async () => {
      const auth = getAuth();
      const user = auth.currentUser;
      console.log("feching...");
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
    if (!user) return navigate("/home");
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
  const handleLogout = async () => {
    await signOut(auth);
    localStorage.clear();
    navigate("/home");
  };

  return (
    <div
      className={`min-h-screen w-full ${
        user?.theme === "light"
          ? "bg-white text-[#333333]"
          : "bg-[#171717] text-white"
      }`}
    >
      <div className="flex flex-col max-w-xl mx-auto min-h-screen">
        {/* Header row: back + save */}
        <div className="flex justify-between items-center p-4  dark:border-gray-700">
          <button
            onClick={() =>
              activeSection ? setActiveSection(null) : navigate(-1)
            }
            className="hover:text-gray-800  dark:hover:text-white"
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
              className="font-roboto  font-medium text-[#15px] text-[#DB9A98]"
            >
              {loading ? "Saving..." : "Save"}
            </button>
          )}
        </div>

        {/* Title */}
        <h2 className="font-roboto font-semibold text-[24px] px-4 py-2   dark:border-gray-700">
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
                  className={`w-full flex items-center font-roboto font-regular text-[15px] border-b  justify-between px-4 py-3 ${
                    user?.theme === "light"
                      ? "border-b-[#F8F9FA]"
                      : "border-b-[#36373B]"
                  }`}
                >
                  <span>{item.label}</span>
                  <ChevronRightIcon className="w-5 h-5" />
                </button>
              ))}

              <div className="space-y-2 mt-6">
                <button
                  onClick={handleShare}
                  className={`flex items-center pt-4 gap-2 font-roboto font-medium text-[15px]  ${
                    user?.theme === "light"
                      ? "text-[#A76361]"
                      : "text-[#DB9A98]"
                  }`}
                >
                  <ShareIcon className="w-4 h-4" />
                  Share The RYSEN app with Others
                </button>
                <button
                  onClick={redirectToDonate}
                  className={`flex items-center pt-4 gap-2 font-roboto font-medium text-[15px]  ${
                    user?.theme === "light"
                      ? "text-[#A76361]"
                      : "text-[#DB9A98]"
                  }`}
                >
                  <HeartIcon className="w-4 h-4" />
                  Make a Donation
                </button>
                <button
                  onClick={sendFeedback}
                  className={`flex items-center pt-4 gap-2 font-roboto font-medium text-[15px]  ${
                    user?.theme === "light"
                      ? "text-[#A76361]"
                      : "text-[#DB9A98]"
                  }`}
                >
                  <StarIcon className="w-5 h-5" />
                  Send Feedback
                </button>

                <button
                  onClick={handleLogout}
                  className={`flex items-center pt-4 font-roboto font-medium text-[15px] gap-2  ${
                    user?.theme === "light"
                      ? "text-[#FA4D56]"
                      : "text-[#ED686E]"
                  }`}
                >
                  <LogOut className="w-5 h-5" />
                  Log Out
                </button>
              </div>
            </>
          )}

          {/* Personal Details content here */}
          {activeSection === "personal" && (
            <>
              {/* Name + Age */}
              <div className="mb-6">
                <label className="block mb-2 font-roboto font-medium text-[15px]">
                  Name
                </label>
                <input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className={`w-full p-2 border rounded-[6px]  font-roboto font-regular text-[15px] ${
                    user?.theme === "light" ? "bg-[#FAFAFA]" : "bg-[#282828]"
                  }`}
                  placeholder="Your Name"
                />

                <label className="block mt-4 mb-2 font-roboto font-medium text-[15px]">
                  Year or birth
                </label>
                <input
                  value={formData.age_range}
                  onChange={(e) =>
                    setFormData({ ...formData, age_range: e.target.value })
                  }
                  className={`w-full p-2 border rounded-[6px]  font-roboto font-regular text-[15px] ${
                    user?.theme === "light" ? "bg-[#FAFAFA]" : "bg-[#282828]"
                  }`}
                />
                {/* <option value="">Select Age Range</option>
                  {ageOptions.map((opt) => (
                    <option key={opt}>{opt}</option>
                  ))}
                </select> */}
              </div>

              {/* Sex + Life Stage */}
              <div className="mb-6 ">
                <label className="block mb-2 font-roboto font-medium text-[15px]">
                  Gender
                </label>
                <select
                  value={formData.sex}
                  onChange={(e) =>
                    setFormData({ ...formData, sex: e.target.value })
                  }
                  className={`w-full p-2 border rounded-[6px]  font-roboto font-regular text-[15px] ${
                    user?.theme === "light" ? "bg-[#FAFAFA]" : "bg-[#282828]"
                  }`}
                >
                  <option value="">Select</option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Prefer not to say</option>
                </select>

                <label className="block mt-4 mb-2 mb-2 font-roboto font-medium text-[15px]">
                  Life Stage
                </label>
                <select
                  value={formData.life_stage}
                  onChange={(e) =>
                    setFormData({ ...formData, life_stage: e.target.value })
                  }
                  className={`w-full p-2 border rounded-[6px]  font-roboto font-regular text-[15px] ${
                    user?.theme === "light" ? "bg-[#FAFAFA]" : "bg-[#282828]"
                  }`}
                >
                  <option value="">Select</option>
                  <option>Single</option>
                  <option>Married</option>
                  <option>Married with children</option>
                  <option>Engaged</option>
                  <option>Widowed</option>
                  <option>Divorced or separated</option>
                  <option>Religious (Priest, Brother, Sister, Nun)</option>
                  <option>In consecrated or lay vocation</option>
                  <option>Prefer not to say</option>
                </select>
              </div>

              {/* Spiritual Maturity */}
              <div className="mb-6">
                <label className="block mb-2 font-roboto font-medium text-[15px]">
                  Spiritual Maturity
                </label>
                <select
                  value={formData.spiritual_maturity}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      spiritual_maturity: e.target.value,
                    })
                  }
                  className={`w-full p-2 border rounded-[6px]  font-roboto font-regular text-[15px] ${
                    user?.theme === "light" ? "bg-[#FAFAFA]" : "bg-[#282828]"
                  }`}
                >
                  <option value="">Select</option>
                  <option>Curious & Exploring</option>
                  <option>Beginning the Journey</option>
                  <option>Growing & Learning</option>
                  <option>Rooted & Trusting</option>
                  <option>Leading & Discipling</option>
                  <option>In a Season of Doubt or Dryness</option>
                  <option>Returning & Reconnecting</option>
                </select>
              </div>

              {/* Spiritual Goals */}
              <div className="mb-6">
                <label className="block mb-2 font-roboto font-medium text-[15px]">
                  Spiritual Goals
                </label>
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
                  ].map((goal) =>
                    user?.theme === "light" ? (
                      <button
                        key={goal}
                        onClick={() => toggleGoal(goal)}
                        className={`px-3 py-2 rounded-[80px] border  font-roboto font-medium text-[15px] text-[#333333] ${
                          formData.spiritual_goals.includes(goal)
                            ? "bg-[#FDEBEA]"
                            : "bg-[#FAFAFA]"
                        }`}
                      >
                        {goal}
                      </button>
                    ) : (
                      <button
                        key={goal}
                        onClick={() => toggleGoal(goal)}
                        className={`px-3 py-2 rounded-[80px] border  font-roboto font-medium text-[15px] ${
                          formData.spiritual_goals.includes(goal)
                            ? "bg-[#A55D51] text-white"
                            : "bg-[#282828] "
                        }`}
                      >
                        {goal}
                      </button>
                    )
                  )}
                </div>
              </div>
            </>
          )}

          {/* App Personalization content */}
          {activeSection === "personalization" && (
            <>
              {/* Avatar */}
              <div className="mb-6">
                <label className="block mb-4 font-roboto  font-medium text-[15px]">
                  Spiritual Companion
                </label>
                <div className="grid grid-cols-2 gap-4">
                  {avatarOptions.map((item) =>
                    user?.theme === "light" ? (
                      <div
                        className={`flex flex-col  rounded overflow-hidden cursor-pointer text-[#666666] ${
                          formData.avatar === item.key
                            ? "bg-[#FDEBEA] "
                            : "bg-[#FAFAFA]"
                        }`}
                      >
                        <div className="flex items-center justify-center">
                          <img src={item.img} className="w-full " />
                        </div>
                        <button
                          key={item.key}
                          onClick={() =>
                            setFormData({ ...formData, avatar: item.key })
                          }
                          className={`p-3 text-center transition ${
                            formData.avatar === item.key
                              ? "bg-[#FDEBEA]"
                              : "bg-[#FAFAFA]"
                          }`}
                        >
                          <strong className="text-sm">{item.key}</strong>
                          <p className="text-xs  mt-1">{item.description}</p>
                        </button>
                      </div>
                    ) : (
                      <div
                        className={`flex flex-col  rounded overflow-hidden cursor-pointer text-white ${
                          formData.avatar === item.key
                            ? "bg-[#A55D51]"
                            : "bg-[#282828]"
                        }`}
                      >
                        <div className="flex items-center justify-center">
                          <img src={item.img} className="w-full " />
                        </div>
                        <button
                          key={item.key}
                          onClick={() =>
                            setFormData({ ...formData, avatar: item.key })
                          }
                          className={`p-3 text-center transition ${
                            formData.avatar === item.key
                              ? "bg-[#A55D51]"
                              : "bg-[#282828]"
                          }`}
                        >
                          <strong className="text-sm">{item.key}</strong>
                          <p className="text-xs mt-1">{item.description}</p>
                        </button>
                      </div>
                    )
                  )}
                </div>
                <div
                  className={`mt-4 border-y  ${
                    user?.theme === "light"
                      ? "border-y-[#E7E8EC] text-[#333333]"
                      : "border-y-[#37373B] text-white"
                  }`}
                >
                  <label className="block  font-roboto  font-regular text-[15px]">
                    Appearance
                  </label>
                  <div className="flex space-x-6 items-center mb-2">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="theme"
                        value="light"
                        className={`form-radio  w-4 h-4 ${
                          user?.theme === "light"
                            ? "accent-[#A76361]"
                            : "accent-[#DB9A98]"
                        }`}
                        checked={formData.theme === "light"}
                        onChange={(e) => {
                          setThemeStyle(e.target.value);
                          setFormData({ ...formData, theme: e.target.value });
                          setUser({ ...user, theme: e.target.value });
                        }}
                      />
                      <span className="font-roboto font-regular text-[15px]">
                        Light Mode
                      </span>
                    </label>

                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="theme"
                        value="dark"
                        className={`form-radio  w-4 h-4 ${
                          user?.theme === "light"
                            ? "accent-[#A76361]"
                            : "accent-[#DB9A98]"
                        }`}
                        checked={formData.theme === "dark"}
                        onChange={(e) => {
                          setThemeStyle(e.target.value);
                          setFormData({ ...formData, theme: e.target.value });
                          setUser({ ...user, theme: e.target.value });
                        }}
                      />
                      <span className="font-roboto font-regular text-[15px]">
                        Dark Mode
                      </span>
                    </label>
                  </div>
                </div>
                <div
                  className={`mt-4 border-y  ${
                    user?.theme === "light"
                      ? "border-y-[#E7E8EC] text-[#333333]"
                      : "border-y-[#37373B] text-white"
                  }`}
                >
                  <label className="block  font-roboto  font-regular text-[15px]">
                    Response Style
                  </label>
                  <div className="flex space-x-6 items-center mb-2">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="response"
                        value="default"
                        className={`form-radio  w-4 h-4 ${
                          user?.theme === "light"
                            ? "accent-[#A76361]"
                            : "accent-[#DB9A98]"
                        }`}
                        checked={formData.responseStyle === "default"}
                        onChange={(e) => {
                          setResponseStyle(e.target.value);
                          setFormData({
                            ...formData,
                            responseStyle: e.target.value,
                          });
                        }}
                      />
                      <span className="font-roboto font-regular text-[15px]">
                        Default
                      </span>
                    </label>

                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="response"
                        value="precise"
                        className={`form-radio  w-4 h-4 ${
                          user?.theme === "light"
                            ? "accent-[#A76361]"
                            : "accent-[#DB9A98]"
                        }`}
                        checked={formData.responseStyle === "precise"}
                        onChange={(e) => {
                          setResponseStyle(e.target.value);
                          setFormData({
                            ...formData,
                            responseStyle: e.target.value,
                          });
                        }}
                      />
                      <span className="font-roboto font-regular text-[15px]">
                        Precise
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Privacy & Security */}
          {activeSection === "privacy" && (
            <div
              className={`space-y-3 ${
                user?.theme === "light" ? "text-[#333333]" : "text-white"
              }`}
            >
              <button
                onClick={() => navigate("/terms")}
                className={`w-full flex items-center font-roboto font-regular text-[15px] border-b  justify-between px-4 py-3 ${
                  user?.theme === "light"
                    ? "border-b-[#EAEBEF]"
                    : "border-b-[#36373B]"
                }`}
              >
                RYSEN - Terms of Service <ExternalLink className="w-6 h-6" />
              </button>
              <button
                onClick={() => navigate("/privacy")}
                className={`w-full flex items-center font-roboto font-regular text-[15px] border-b  justify-between px-4 py-3 ${
                  user?.theme === "light"
                    ? "border-b-[#EAEBEF]"
                    : "border-b-[#36373B]"
                }`}
              >
                RYSEN - Privacy Policy <ExternalLink className="w-6 h-6" />
              </button>
              <button
                onClick={() => navigate("/about")}
                className={`w-full flex items-center font-roboto font-regular text-[15px] border-b  justify-between px-4 py-3 ${
                  user?.theme === "light"
                    ? "border-b-[#EAEBEF]"
                    : "border-b-[#36373B]"
                }`}
              >
                RYSEN - About Us <ExternalLink className="w-6 h-6" />
              </button>
              <button
                onClick={clearChatHistory}
                className={`flex items-center gap-2 font-roboto font-medium text-[15px] pt-4  ${
                  user?.theme === "light" ? "text-[#A76361]" : "text-[#DB9A98]"
                }`}
              >
                <Trash2Icon className="w-4 h-4" />
                Clear Chat History
              </button>
              <button
                onClick={clearPastoralMemory}
                className={`flex items-center gap-2 font-roboto font-medium text-[15px] pt-4  ${
                  user?.theme === "light" ? "text-[#A76361]" : "text-[#DB9A98]"
                }`}
              >
                <Trash2Icon className="w-4 h-4" />
                Delete Pastoral Memory
              </button>
              <button
                className={`flex items-center gap-2 font-roboto font-medium text-[15px] pt-4  ${
                  user?.theme === "light" ? "text-[#A76361]" : "text-[#DB9A98]"
                }`}
              >
                <Trash2Icon className="w-4 h-4" />
                Opt out of Sharing App Analytics
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
