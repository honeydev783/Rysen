import { useState } from "react";
import { getAuth } from "firebase/auth";
import axios from "axios";
import { toast } from "react-hot-toast";
import  api  from "../utils/api";
const ageOptions = ["Under 16", "16–24", "25–34", "35–49", "50+"];
const avatarOptions = [
  {
    key: "Pio",
    name: "Pio",
    image: "/avatars/avatar1.png", // Place image in public folder or import statically
    description:
      "Inspired by the life and works of Saint Padre Pio, a man of deep prayer, miraculous healing, and tireless dedication to the confessional.",
  },
  {
    key: "Thérèse",
    name: "Thérèse",
    image: "/avatars/avatar2.png",
    description: "Inspired by the life and works of St. Thérèse of Lisoux, the Little Flower, who taught us to find holiness in small, simple acts of love with great trust in God’s mercy.",
  },
  {
    key: "Kim",
    name: "Kim",
    image: "/avatars/avatar3.png",
    description: "Kim is a bubbly, friendly youth leader who’s passionate about her faith and loves walking alongside others in their spiritual journey.",
  },
  {
    key: "Dan",
    name: "Dan",
    image: "/avatars/avatar4.png",
    description:
      "Dan is a 40-something father of three who understands the real-life challenges of living out faith while managing work, family, and daily struggles.",
  },
  {
    key: "Nonna",
    name: "Nonna",
    image: "/avatars/avatar4.png",
    description:
      "Nonna is a warm, comforting grandmotherly figure who’s lived through many seasons of life and found deep wisdom in faith, love, and perseverance.",
  },
];
interface OnboardingPageProps {
  onFinish: () => void;
  showDonationPrompt: () => void;
}
export default function OnboardingPage({ onFinish, showDonationPrompt }: OnboardingPageProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<{
    name: string;
    ageRange: string;
    sex: string;
    lifeStage: string;
    spiritualMaturity: number;
    spiritualGoals: string[];
    avatar: string;
  }>({
    name: "",
    ageRange: "",
    sex: "",
    lifeStage: "",
    spiritualMaturity: 1.0,
    spiritualGoals: [],
    avatar: "",
  });

  const submitOnboarding = async () => {
    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      console.log("formData===>", formData);
      await api.post(
        `/onboarding`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Success: trigger donation modal
      showDonationPrompt();
      onFinish();
    } catch (error) {
      console.error("Failed to save onboarding:", error);
      toast.error("Something went wrong saving your onboarding.");
    }
  };

  const next = () => setStep(step + 1);
  const prev = () => setStep(step - 1);

  const toggleGoal = (goal: string) => {
    setFormData((prev) => {
      const exists = prev.spiritualGoals.includes(goal);
      return {
        ...prev,
        spiritualGoals: exists
          ? prev.spiritualGoals.filter((g) => g !== goal)
          : [...prev.spiritualGoals, goal],
      };
    });
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white px-4 py-8">
      <div className="max-w-xl mx-auto bg-white dark:bg-gray-800 p-6 rounded-xl shadow">
        <h2 className="text-xl font-semibold mb-4">Step {step} of 3</h2>

        {step === 1 && (
          <div>
            <label className="block mb-2">Name *</label>
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
              value={formData.ageRange}
              onChange={(e) =>
                setFormData({ ...formData, ageRange: e.target.value })
              }
              className="w-full p-2 border rounded dark:bg-gray-700"
            >
              <option value="">Select Age Range</option>
              {ageOptions.map((opt) => (
                <option key={opt}>{opt}</option>
              ))}
            </select>
          </div>
        )}

        {step === 2 && (
          <div>
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
              value={formData.lifeStage}
              onChange={(e) =>
                setFormData({ ...formData, lifeStage: e.target.value })
              }
              className="w-full p-2 border rounded dark:bg-gray-700"
            >
              <option value="">Select</option>
              <option>Single</option>
              <option>Married</option>
              <option>Married with children</option>
              <option>Religious (Priest, Nun, etc)</option>
            </select>

            <label className="block mt-4 mb-2">Spiritual Maturity</label>
            <input
              type="range"
              min="1"
              max="3"
              step="0.01"
              value={formData.spiritualMaturity}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  spiritualMaturity: parseFloat(e.target.value),
                })
              }
              className="w-full"
            />
            <div className="flex justify-between text-sm">
              <span>Exploring</span>
              <span>Growing</span>
              <span>Mature</span>
            </div>

            <label className="block mt-4 mb-2">Spiritual Goals</label>
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
                    formData.spiritualGoals.includes(goal)
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-200 dark:bg-gray-700"
                  }`}
                >
                  {goal}
                </button>
              ))}
            </div>
          </div>
        )}
        {step === 3 && (
          <div>
            <label className="block mb-4 text-lg font-medium">
              Choose Your Spiritual Companion
            </label>
            <div className="grid grid-cols-2 gap-4">
              {avatarOptions.map((avatar) => (
                <button
                  key={avatar.key}
                  onClick={() =>
                    setFormData({ ...formData, avatar: avatar.key })
                  }
                  className={`border rounded-xl p-3 flex flex-col items-center text-center transition ${
                    formData.avatar === avatar.key
                      ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-800 dark:border-indigo-400"
                      : "border-gray-300 dark:border-gray-700"
                  }`}
                >
                  {/* <img
                    src={avatar.image}
                    alt={avatar.name}
                    className="w-20 h-20 object-cover rounded-full mb-2"
                  /> */}
                  <strong className="text-sm">{avatar.name}</strong>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                    {avatar.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Additional steps: Avatar Selection, Donation Prompt, Welcome Message */}

        <div className="mt-6 flex justify-between">
          {step > 1 && (
            <button
              onClick={prev}
              className="px-4 py-2 rounded bg-gray-300 dark:bg-gray-600"
            >
              Back
            </button>
          )}
          <button
            onClick={step < 3 ? next : submitOnboarding}
            className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
          >
            {step < 3 ? "Next" : "Finish"}
          </button>
        </div>
      </div>
    </div>
  );
}
