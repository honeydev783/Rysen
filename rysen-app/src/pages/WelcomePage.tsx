import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const WelcomePage = () => {
  const navigate = useNavigate();

  // Optional: track whether user has already seen the welcome page
  useEffect(() => {
    localStorage.setItem("hasSeenWelcome", "true");
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-b from-white to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-colors duration-300">
      <div className="max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 md:p-10 space-y-6">
        <div className="text-center space-y-4">
          <blockquote className="italic text-xl text-gray-700 dark:text-gray-200">
            “Come to Me, all you who are weary and burdened, and I will give you rest.”
          </blockquote>
          <p className="text-sm text-gray-500 dark:text-gray-400">~ Matthew 11:28</p>
        </div>

        <div className="text-gray-800 dark:text-gray-100 space-y-4 text-[17px] leading-relaxed">
          <p className="font-semibold text-center text-2xl text-indigo-600 dark:text-indigo-400">Welcome to RYSEN</p>
          <p>
            A space for prayerful guidance and reflection, rooted in the Holy Scriptures, the wisdom of the Saints,
            and the sacred teachings of the Catholic Church.
          </p>
          <p>
            Whether you're seeking clarity, comfort, or deeper understanding, this tool is here to meet you where
            you are on your faith journey — helping you reflect, pray, and grow closer to God.
          </p>
          <p>
            Begin this session in the name of Jesus, asking the Holy Spirit to inspire and enlighten your heart, and
            entrusting your path to Mary, our Blessed Mother.
          </p>
          <p>
            This companion offers faithful counsel, always in the light of Holy Mother Church. It is meant to support,
            and can never replace, the grace found in the Sacraments, personal prayer, and trusted spiritual direction.
          </p>
        </div>

        <div className="text-center">
          <button
            onClick={() => navigate("/chat")}
            className="mt-6 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-full shadow-lg transition-all duration-200"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomePage;
