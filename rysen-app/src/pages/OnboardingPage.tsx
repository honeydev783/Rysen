import { useState, useEffect, useRef } from "react";
import { IoIosArrowBack } from "react-icons/io";
import { getAuth } from "firebase/auth";
import { toast } from "react-hot-toast";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

interface FormData {
  name: string;
  ageRange: string;
  sex: string;
  lifeStage: string;
  spiritualMaturity: string;
  spiritualGoals: string[];
  avatar: string;
}
type Step1NameProps = {
  formData: FormData;
  setFormData: (formData: FormData) => void;
};

function Step1Name({ formData, setFormData }: Step1NameProps) {
  const { user, setUser } = useAuth();
  return (
    <div>
      <h1
        className={`text-[24px] font-roboto font-semibold   mb-4 ${
          user?.theme === "light" ? "text-[#333333]" : "dark:text-white"
        }`}
      >
        What is your name?
      </h1>
      <input
        type="text"
        placeholder="Enter your name"
        className={`w-full px-4 py-3 rounded-[8px]   placeholder:text-[#aaa] outline-none ${
          user?.theme === "light"
            ? "bg-[#f5f5f5] text-[#333333]"
            : "dark:bg-[#282828]  dark:text-white"
        }`}
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
      />
    </div>
  );
}
type ProgressBarProps = { currentStep: number; totalSteps: number };
function ProgressBar({ currentStep, totalSteps }: ProgressBarProps) {
  const { user, setUser } = useAuth();
  return (
    <div
      className={`flex-1 h-2  dark:bg-[#282828] rounded overflow-hidden ${
        user?.theme === "light" ? "bg-[#EBECF0]" : "bg-[#43454E]"
      }`}
    >
      <div
        className="h-full bg-[#DB9A98]"
        style={{ width: `${(currentStep / totalSteps) * 100}%` }}
      ></div>
    </div>
  );
}

type PropsStep2DOB = {
  selectedYear: number | null;
  setSelectedYear: (year: number) => void;
};

// Wrapper component to handle Picker props

function Step2DOB({ selectedYear, setSelectedYear }: PropsStep2DOB) {
  const { user, setUser } = useAuth();
  const yearListRef = useRef(null);
  // Generate years from 1900 to current year + 10
  const currentYear = new Date().getFullYear();
  const years = Array.from(
    { length: currentYear - 1910 - 15 },
    (_, i) => 1910 + i
  );

  // Scroll to selected year on mount
  useEffect(() => {
    const index = years.indexOf(selectedYear);
    if (yearListRef.current) {
      yearListRef.current.scrollTop = index * 48; // Adjust based on item height
    }
  }, []);

  const handleYearClick = (year) => {
    setSelectedYear(year);
    // const index = years.indexOf(year);
    // if (yearListRef.current) {
    //   yearListRef.current.scrollTo({
    //     top: index * 48,
    //     behavior: "smooth",
    //   });
    // }
  };
  return (
    <div>
      <h1
        className={`text-[24px] font-roboto font-semibold  mb-4 ${
          user?.theme === "light" ? "text-[#333333]" : "dark:text-white"
        }`}
      >
        What year were you born?
      </h1>
      <div className="relative h-48 overflow-hidden">
        <div
          ref={yearListRef}
          className="absolute inset-0 overflow-y-scroll scrollbar-hide"
        >
          {years.map((year) =>
            user?.theme === "light" ? (
              <div
                key={year}
                onClick={() => handleYearClick(year)}
                className={`flex items-center justify-center h-12 text-[24px] font-roboto font-semibold text-[#BEBEBE] cursor-pointer transition-colors duration-200 ${
                  year === selectedYear
                    ? "bg-[#FDEBEA] text-[#333333] font-bold rounded-[80px]"
                    : "text-gray-700 hover:bg-gray-200 rounded-[80px]"
                }`}
              >
                {year}
              </div>
            ) : (
              <div
                key={year}
                onClick={() => handleYearClick(year)}
                className={`flex items-center justify-center h-12 text-[24px] font-roboto font-semibold text-[#ffffff] cursor-pointer transition-colors duration-200 ${
                  year === selectedYear
                    ? "bg-[#A55D51] text-white font-bold rounded-[80px]"
                    : "text-gray-700 hover:bg-gray-200 rounded-[80px]"
                }`}
              >
                {year}
              </div>
            )
          )}
        </div>
        {user?.theme === "light" ? (
          <>
            <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-[#FFFFFF] to-transparent pointer-events-none z-10" />
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#FFFFFF] to-transparent pointer-events-none z-10" />
          </>
        ) : (
          <>
            <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-[#171717] to-transparent pointer-events-none z-10" />
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#171717] to-transparent pointer-events-none z-10" />
          </>
        )}
      </div>
    </div>
  );
}

const options = ["Male", "Female", "Prefer not to say"];
type Step3GenderProps = {
  selected: string | null;
  setSelected: (s: string) => void;
};
function Step3Gender({ selected, setSelected }: Step3GenderProps) {
  const { user, setUser } = useAuth();
  return (
    <div>
      <h1
        className={`text-[24px] font-roboto font-semibold   mb-4 ${
          user?.theme === "light" ? "text-[#333333]" : "dark:text-white"
        }`}
      >
        What is your gender?
      </h1>
      <div className="flex flex-col gap-2">
        {options.map((opt) =>
          user?.theme === "light" ? (
            <button
              key={opt}
              onClick={() => setSelected(opt)}
              className={`w-full py-3 rounded-[80px] font-roboto font-medium text-[#333333] ${
                selected === opt ? "bg-[#FDEBEA]" : "bg-[#FAFAFA]"
              }`}
            >
              {opt}
            </button>
          ) : (
            <button
              key={opt}
              onClick={() => setSelected(opt)}
              className={`w-full py-3 rounded-[80px] font-roboto font-medium text-white ${
                selected === opt ? "bg-[#A55D51]" : "bg-[#282828]"
              }`}
            >
              {opt}
            </button>
          )
        )}
      </div>
    </div>
  );
}

type Step4LifeStageProps = {
  selected: string | null;
  setSelected: (s: string) => void;
};

const lifeStages = [
  "Single",
  "Married",
  "Married with children",
  "Engaged",
  "Widowed",
  "Divorced or separated",
  "Religious (Priest, Brother, Sister, Nun)",
  "In consecrated or lay vocation",
  "Prefer not to say",
];

function Step4LifeStage({ selected, setSelected }: Step4LifeStageProps) {
  const { user, setUser } = useAuth();
  return (
    <div>
      <h1
        className={`text-[24px] font-roboto font-semibold mb-4 ${
          user?.theme === "light" ? "text-[#333333]" : "dark:text-white"
        }`}
      >
        What best describes your life stage?
      </h1>
      <div className="flex flex-col gap-2">
        {lifeStages.map((stage) =>
          user?.theme === "light" ? (
            <button
              key={stage}
              onClick={() => setSelected(stage)}
              className={`w-full py-3 rounded-[80px] font-roboto font-medium text-[#333333] ${
                selected === stage ? "bg-[#FDEBEA]" : "bg-[#FAFAFA]"
              }`}
            >
              {stage}
            </button>
          ) : (
            <button
              key={stage}
              onClick={() => setSelected(stage)}
              className={`w-full py-3 rounded-[80px] font-roboto font-medium text-white ${
                selected === stage ? "bg-[#A55D51]" : "bg-[#282828]"
              }`}
            >
              {stage}
            </button>
          )
        )}
      </div>
    </div>
  );
}

type Step5SpiritualMaturityProps = {
  selected: string | null;
  setSelected: (s: string) => void;
};
const items = [
  {
    title: "Curious & Exploring",
    desc: "I'm asking questions and seeking to understand who Jesus is and what faith means.",
  },
  {
    title: "Beginning the Journey",
    desc: "I’ve recently started following Jesus and am learning what it means to live out my faith.",
  },
  {
    title: "Growing & Learning",
    desc: "I'm walking with Jesus and actively seeking to grow through prayer, Scripture, and community",
  },
  {
    title: "Rooted & Trusting",
    desc: "My faith is a central part of my life, and I seek to trust God more deeply in all areas.",
  },
  {
    title: "Leading & Discipling",
    desc: "I'm helping others grow in their faith and serving regularly in my church or community.",
  },
  {
    title: "In a Season of Doubt or Dryness",
    desc: "I'm struggling in my faith right now, but I still want to stay open to God.",
  },
  {
    title: "Returning & Reconnecting",
    desc: "I'm coming back to my faith after being away or disconnected for a while",
  },
  // add other buttons...
];
function Step5SpiritualMaturity({
  selected,
  setSelected,
}: Step5SpiritualMaturityProps) {
  const { user, setUser } = useAuth();
  return (
    <div>
      <h1
        className={`text-[24px] font-roboto font-semibold ${
          user?.theme === "light" ? "text-[#333333]" : "dark:text-white"
        }`}
      >
        Where are you in your spiritual journey?
      </h1>
      <p
        className={`text-[13px] font-roboto   mb-4 ${
          user?.theme === "light" ? "text-[#666666]" : "dark:text-[#CCCDD1]"
        }`}
      >
        Choose the one that best describes your current place with God
      </p>
      <div className="flex flex-col gap-2">
        {items.map((item) =>
          user?.theme === "light" ? (
            <button
              key={item.title}
              onClick={() => setSelected(item.title)}
              className={`w-full text-left px-4 py-3 rounded-[8px] ${
                selected === item.title ? "bg-[#FDEBEA]" : "bg-[#FAFAFA]"
              }`}
            >
              <div className="text-[15px] text-[#333333]">{item.title}</div>
              <div className="text-[10px] text-[#333333]">{item.desc}</div>
            </button>
          ) : (
            <button
              key={item.title}
              onClick={() => setSelected(item.title)}
              className={`w-full text-left px-4 py-3 rounded-[8px] ${
                selected === item.title ? "bg-[#A55D51]" : "bg-[#282828]"
              }`}
            >
              <div className="text-[15px] text-white">{item.title}</div>
              <div className="text-[10px] text-white">{item.desc}</div>
            </button>
          )
        )}
      </div>
    </div>
  );
}

type Step6GoalsProps = {
  selected: string[];
  setSelected: (s: string[]) => void;
};

const goals = [
  "Grow my prayer life",
  "Get closer to God",
  "Learn about my faith",
  "Find peace in suffering",
  "Help me discern life decisions",
  "Strengthen my marriage or family life",
  "Support me through grief",
  "Overcome temptation",
];

function Step6Goals({ selected, setSelected }: Step6GoalsProps) {
  const { user, setUser } = useAuth();
  const toggleGoal = (goal: string) => {
    if (selected.includes(goal)) {
      setSelected(selected.filter((g) => g !== goal));
    } else {
      setSelected([...selected, goal]);
    }
  };

  return (
    <div>
      <h1
        className={`text-[24px] font-roboto font-semibold ${
          user?.theme === "light" ? "text-[#333333]" : "dark:text-white"
        }`}
      >
        What are your faith goals?
      </h1>
      <p
        className={`text-[13px] mb-4 ${
          user?.theme === "light" ? "text-[#666666]" : "dark:text-[#CCCDD1]"
        }`}
      >
        Select all that apply
      </p>
      <div className="flex flex-col gap-2">
        {goals.map((goal) =>
          user?.theme === "light" ? (
            <button
              key={goal}
              onClick={() => toggleGoal(goal)}
              className={`w-full py-3 rounded-[80px] font-roboto font-medium text-[#333333] ${
                selected.includes(goal) ? "bg-[#FDEBEA]" : "bg-[#FAFAFA]"
              }`}
            >
              {goal}
            </button>
          ) : (
            <button
              key={goal}
              onClick={() => toggleGoal(goal)}
              className={`w-full py-3 rounded-[80px] font-roboto font-medium text-white ${
                selected.includes(goal) ? "bg-[#A55D51]" : "bg-[#282828]"
              }`}
            >
              {goal}
            </button>
          )
        )}
      </div>
    </div>
  );
}

const companions = [
  {
    name: "Pio",
    desc: "Modeled on Saint Padre Pio, a man of prayer, healing, and tireless devotion to the confessional.",
    img: "/avatars/Pio - Dark mode.svg",
  },
  {
    name: "Thérèse",
    desc: "Inspired by St. Thérèse of Lisieux, who found holiness in small, loving acts and deep trust in God's mercy.",
    img: "/avatars/Therese - Dark mode.svg",
  },
  {
    name: "Kim",
    desc: "A joyful and faith-filled youth leader who loves walking with others on their spiritual journey.",
    img: "/avatars/Kim - Dark mode.svg",
  },
  {
    name: "Dan",
    desc: "A devoted father juggling faith, family and work, grounded in real-life spiritual struggles.",
    img: "/avatars/Dan - Dark mode.svg",
  },
];
type Step7CompanionProps = {
  selected: string | null;
  setSelected: (s: string) => void;
  showDonationPrompt: () => void;
};
function Step7Companion({
  selected,
  setSelected,
  showDonationPrompt,
}: Step7CompanionProps) {
  const { user, setUser } = useAuth();
  return (
    <div>
      <h1
        className={`text-[24px] font-roboto font-semibold ${
          user?.theme === "light" ? "text-[#333333]" : "dark:text-white"
        }`}
      >
        Who would you like to journey with as your spiritual companion?
      </h1>
      <p
        className={`text-[13px] mb-4 ${
          user?.theme === "light" ? "text-[#666666]" : "dark:text-[#CCCDD1]"
        }`}
      >
        You can change it in settings later
      </p>
      <div className="grid grid-cols-2 gap-3 pt-4">
        {companions.map((comp) =>
          user?.theme === "light" ? (
            <div
              key={comp.name}
              onClick={() => setSelected(comp.name)}
              className={`flex flex-col items-center rounded-[10px] overflow-hidden cursor-pointer bg-[#282828]`}
            >
              <div className="flex items-center justify-center">
                <img src={comp.img} />
              </div>
              <div
                className={`flex justify-center items-center flex-col ${
                  selected === comp.name ? "bg-[#FDEBEA]" : "bg-[#FAFAFA]"
                }`}
              >
                <div className="text-[15px] text-[#666666] px-4  pt-2 ">
                  {comp.name}
                </div>
                <div className="text-[10px] text-[#666666] px-4 pb-4 text-center">
                  {comp.desc}
                </div>
              </div>
            </div>
          ) : (
            <div
              key={comp.name}
              onClick={() => setSelected(comp.name)}
              className={`flex flex-col items-center rounded-[10px] overflow-hidden cursor-pointer bg-[#282828]`}
            >
              <div className="flex items-center justify-center">
                <img src={comp.img} />
              </div>
              <div
                className={`flex justify-center items-center flex-col ${
                  selected === comp.name ? "bg-[#A55D51]" : "bg-[#282828]"
                }`}
              >
                <div className="text-[15px] text-white px-4  pt-2 ">
                  {comp.name}
                </div>
                <div className="text-[10px] text-white px-4 pb-4 text-center">
                  {comp.desc}
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
interface OnboardingPageProps {
  showDonationPrompt: () => void;
}
export default function OnboardingPageNew({
  showDonationPrompt,
}: OnboardingPageProps) {
  const { user, setUser } = useAuth();
  const [step, setStep] = useState(1);
  const [selectedYear, setSelectedYear] = useState<number | null>(1996);
  const [selectedGender, setSelectedGender] = useState<string | null>(null);
  const [selectedLifeStage, setSelectedLifeStage] = useState<string | null>(
    null
  );
  const [selectedSpiritualMaturity, setSelectedSpiritualMaturity] = useState<
    string | null
  >(null);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [selectedCompanion, setSelectedCompanion] = useState<string | null>(
    "Thérèse"
  );

  const [formData, setFormData] = useState<{
    name: string;
    ageRange: string;
    sex: string;
    lifeStage: string;
    spiritualMaturity: string;
    spiritualGoals: string[];
    avatar: string;
  }>({
    name: "",
    ageRange: "",
    sex: "",
    lifeStage: "",
    spiritualMaturity: "",
    spiritualGoals: [],
    avatar: "",
  });
  const submitOnboarding = async () => {
    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      console.log(
        "form data in step7==>",
        selectedYear,
        selectedGender,
        selectedLifeStage,
        selectedSpiritualMaturity,
        selectedGoals,
        selectedCompanion
      );
      const updatedFormData = {
        ...formData,
        ageRange: selectedYear?.toString(),
        sex: selectedGender,
        lifeStage: selectedLifeStage,
        spiritualMaturity: selectedSpiritualMaturity,
        spiritualGoals: selectedGoals,
        avatar: selectedCompanion,
      };

      setFormData(updatedFormData);
      console.log("formData (preview):", updatedFormData);
      await api.post(`/onboarding`, updatedFormData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Success: trigger donation modal
      showDonationPrompt();
    } catch (error) {
      console.error("Failed to save onboarding:", error);
      toast.error("Something went wrong saving your onboarding.");
    }
  };
  const nextStep = () => {
    setStep((prev) => Math.min(prev + 1, 7));
  };
  const prevStep = () => setStep((prev) => Math.max(prev - 1, 1));

  return (
    <div
      className={`h-screen flex flex-col px-6 pt-6 ${
        user?.theme === "light" ? "bg-white" : "dark:bg-[#171717]"
      }`}
    >
      {/* Top row with back arrow & progress bar */}
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={prevStep}>
          <IoIosArrowBack
            size={24}
            className={`${
              user?.theme === "light" ? "text-[#333333]" : "dark:text-white"
            } `}
          />
        </button>
        <ProgressBar currentStep={step} totalSteps={7} />
      </div>

      {/* spacing */}
      <div className="mt-[60px] flex-1 overflow-y-auto">
        {step === 1 && (
          <Step1Name formData={formData} setFormData={setFormData} />
        )}
        {step === 2 && (
          <Step2DOB
            selectedYear={selectedYear}
            setSelectedYear={setSelectedYear}
          />
        )}
        {step === 3 && (
          <Step3Gender
            selected={selectedGender}
            setSelected={setSelectedGender}
          />
        )}
        {step === 4 && (
          <Step4LifeStage
            selected={selectedLifeStage}
            setSelected={setSelectedLifeStage}
          />
        )}
        {step === 5 && (
          <Step5SpiritualMaturity
            selected={selectedSpiritualMaturity}
            setSelected={setSelectedSpiritualMaturity}
          />
        )}
        {step === 6 && (
          <Step6Goals selected={selectedGoals} setSelected={setSelectedGoals} />
        )}
        {step === 7 && (
          <Step7Companion
            selected={selectedCompanion}
            setSelected={setSelectedCompanion}
            showDonationPrompt={showDonationPrompt}
          />
        )}
      </div>

      {/* Bottom buttons */}
      <div className="mb-6 shrink-0">
        <button
          onClick={step < 7 ? nextStep : submitOnboarding}
          className={`w-full   py-3 rounded-[33px] font-roboto font-medium text-[15px] ${
            user?.theme === "light"
              ? "bg-[#333333] text-white"
              : "dark:bg-white  dark:text-[#333333]"
          }`}
        >
          Continue
        </button>
        <div
          className={`mt-2 text-center text-[15px] font-roboto font-medium  cursor-pointer ${
            user?.theme === "light" ? "text-[#717171]" : "text-[#999999]"
          }`}
          onClick={nextStep}
        >
          Skip
        </div>
      </div>
    </div>
  );
}
