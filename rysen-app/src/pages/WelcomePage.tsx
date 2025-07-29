import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const WelcomePage = () => {
  const navigate = useNavigate();
  const [visibleItems, setVisibleItems] = useState(0);
  // Optional: track whether user has already seen the welcome page
  useEffect(() => {
    localStorage.setItem("hasSeenWelcome", "true");
  }, []);
  useEffect(() => {
    const timeouts = [];
    const totalItems = 6; // number of paragraphs + button
    const interval = 2000; // every 3 seconds next item

    for (let i = 1; i <= totalItems; i++) {
      timeouts.push(setTimeout(() => setVisibleItems(i), i * interval));
    }

    return () => timeouts.forEach((t) => clearTimeout(t));
  }, []);
  return (
    <div className="relative min-h-screen bg-[#171717]">
      {/* Fullscreen GIF background */}
      <img
        src="/Welcome.png"
        alt="HomePage"
        className="absolute inset-0 object-cover w-full h-full"
      />

      {/* Gradient overlay starting from middle with stronger fade */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, rgba(23,23,23,0) 45%, rgba(23,23,23,0.98) 62%, #171717 100%)",
        }}
      />

      {/* Content */}
      {/* <div className="relative flex flex-col justify-end min-h-screen px-4 pb-6 text-center ">
        <p className="text-white font-roboto font-semibold text-[20px] text-left mt-2  fade-in-up">
          “Come to Me, all you who are weary and burdened, and I will give you
          rest.”
        </p>
        <p className="text-white font-roboto font-regular text-[13px] text-left mt-2  fade-in-up">
          ~ Matthew 11:28
        </p>

        <p className="text-white font-roboto font-bold text-[17px] pt-6 text-left fade-in-up">
          Welcome to Rysen
        </p>
        <p className="text-white font-roboto font-regular text-[15px] text-left fade-in-up">
          A space for prayerful guidance and reflection, rooted in the Holy
          Scriptures, the wisdom of the Saints, and the sacred teachings of the
          Catholic Church.
        </p>

        <p className="text-white font-roboto font-regular text-[15px] text-left pt-2  fade-in-up">
          Begin this session in the name of Jesus, asking the Holy Spirit to
          inspire and enlighten your heart, and entrusting your path to Mary,
          our Blessed Mother.
        </p>

        <div className="mt-8 w-full max-w-sm mx-auto  fade-in-up">
          <button
            className="flex items-center justify-center gap-2 w-full bg-white rounded-[33px] py-3"
            onClick={() => navigate("/login")}
          >
            <span className="text-[#333333] font-roboto font-medium text-[15px]">
              Continue
            </span>
          </button>
        </div>
      </div> */}
      <div className="relative flex flex-col justify-end min-h-screen px-4 pb-6 text-center overflow-hidden">
        <div
          className="flex flex-col  transition-transform duration-[2000ms] ease-out"
          style={{
            transform: `translateY(-${visibleItems * 1}px)`,
          }}
        >
          <p
            className={`text-white font-roboto font-semibold text-[20px] text-left mt-2 fade-in ${
              visibleItems >= 1 ? "visible" : ""
            }`}
          >
            “Come to Me, all you who are weary and burdened, and I will give you
            rest.”
          </p>

          <p
            className={`text-white font-roboto font-regular text-[13px] text-left mt-2 fade-in ${
              visibleItems >= 2 ? "visible" : ""
            }`}
          >
            ~ Matthew 11:28
          </p>

          <p
            className={`text-white font-roboto font-bold text-[17px] pt-6 text-left fade-in ${
              visibleItems >= 3 ? "visible" : ""
            }`}
          >
            Welcome to Rysen
          </p>

          <p
            className={`text-white font-roboto font-regular text-[15px] text-left fade-in ${
              visibleItems >= 4 ? "visible" : ""
            }`}
          >
            A space for prayerful guidance and reflection, rooted in the Holy
            Scriptures, the wisdom of the Saints, and the sacred teachings of
            the Catholic Church.
          </p>

          <p
            className={`text-white font-roboto font-regular text-[15px] text-left pt-2 fade-in ${
              visibleItems >= 5 ? "visible" : ""
            }`}
          >
            Begin this session in the name of Jesus, asking the Holy Spirit to
            inspire and enlighten your heart, and entrusting your path to Mary,
            our Blessed Mother.
          </p>

          <div
            className={`mt-8 w-full max-w-sm mx-auto fade-in ${
              visibleItems >= 6 ? "visible" : ""
            }`}
          >
            <button
              className="flex items-center justify-center gap-2 w-full bg-white rounded-[33px] py-3"
              onClick={() => navigate("/chat")}
            >
              <span className="text-[#333333] font-roboto font-medium text-[15px]">
                Continue
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomePage;
