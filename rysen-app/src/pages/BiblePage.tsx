import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useVoiceRecorder } from "../utils/useVoiceRecorder";
import { transcribeAudio } from "../utils/whisper";
import { Mic, Settings, LogOut, Clock, PlusCircle } from "lucide-react";
import { signOut, getAuth } from "firebase/auth";
import { auth, db } from "../firebase";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import FeedbackIcons from "../components/FeedbackIcons";
import { doc, getDoc } from "firebase/firestore";
import BottomBar from "../components/BottomBar";
import WelcomePage from "./WelcomePage";
import { toWordsOrdinal } from "number-to-words";

interface Message {
  id?: string;
  sender: "user" | "ai" | "typing";
  text: string;
  timestamp?: string;
  follow_ups?: string[];
}

interface ChatSession {
  id: string;
  topic?: string;
  summary?: string;
  messages: Message[];
  created_at: string;
}

interface MassReading {
  date: string;
  saint: string;
  season: string;
  season_week: string;
  year: string;
  readings: {
    first: string;
    gospel: string;
    psalm: string;
    second?: string;
  };
}

const avatarOptions = [
  {
    key: "Pio",
    name: "St. Padre Pio",
    darkimage: "/avatars/Pio - Dark mode.svg",
    lightimage: "/avatars/Pio - Light mode.svg",
    message:
      "Begin your time with Scripture.\n  Choose one of today’s readings to sit with the Word. At the end, you’ll have the opportunity to reflect more deeply. \n You can also learn from the life of today’s saint.\n",
    placeholder: "Bring your intention to the Lord",
  },
  {
    key: "Thérèse",
    name: "St. Teresa of Avila",
    darkimage: "/avatars/Therese - Dark mode.svg",
    lightimage: "/avatars/Therese - Light mode.svg",
    message:
      "Let your heart rest in the Word today. \n Select a reading below to spend time with Jesus. A quiet reflection is available at the end if you feel drawn to go further. \n You may also like to learn about the saint we remember today. \n",
    placeholder: "Share your heart with Jesus",
  },
  {
    key: "Dan",
    name: "Dan",
    darkimage: "/avatars/Dan - Dark mode.svg",
    lightimage: "/avatars/Dan - Light mode.svg",
    message:
      "Step away from the noise for a moment. \n Choose a reading below to spend a few minutes in Scripture. There’s a reflection at the end if you’d like to take it further. \n And if you’re curious, you can also read about the saint of the day.",
    placeholder: "Whatever’s on your mind, place it here in prayer.",
  },
  {
    key: "Kim",
    name: "Kim",
    darkimage: "/avatars/Kim - Dark mode.svg",
    lightimage: "/avatars/Kim - Light mode.svg",
    message:
      "Take a moment to connect with Scripture. \n Tap on one of today’s readings to read the full passage. If it speaks to you, there’s a reflection at the end to help you go deeper. \n You can also read about the saint we’re remembering today.",
    placeholder: "What’s on your heart right now? - let it out.",
  },
];
const getMessageByKey = (key: string) => {
  const found = avatarOptions.find((item) => item.key === key);
  return found?.message || "Message not found.";
};

const getPlaceholderByKey = (key: string) => {
  const found = avatarOptions.find((item) => item.key === key);
  return found?.placeholder || "Bring your intention to the Lord";
};
const parseBoldItalicText = (text: string) => {
  const parts = text.split(/(\*\*[\s\S]*?\*\*)/g); // [\s\S] matches everything including newlines

  return parts.map((part, i) => {
    if (/^\*\*[\s\S]*\*\*$/.test(part)) {
      const content = part.slice(2, -2); // remove the leading and trailing **
      return (
        <span key={i} className="font-bold italic whitespace-pre-line block">
          {content}
        </span>
      );
    } else {
      return (
        <span key={i} className="whitespace-pre-line block">
          {part}
        </span>
      );
    }
  });
};

const BiblePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingText, setTypingText] = useState("Typing");
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(
    null
  );
  const { isRecording, startRecording, stopRecording } = useVoiceRecorder();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [welcomeMessage, setWelcomeMessage] = useState<string>("");
  const [placeholder, setPlaceholder] = useState<string>(
    "Bring your intention to the Lord"
  );
  const [showReadings, setShowReadings] = useState(false);
  const [massReadings, setMassReadings] = useState<MassReading | null>(null);
  const [userProfile, setUserProfile] = useState({
    name: "",
    age_range: "",
    sex: "",
    life_stage: "",
    spiritual_maturity: 1.0,
    spiritual_goals: [] as string[],
    avatar: "",
  });
  const [showButtons, setShowButtons] = useState(false);
  useEffect(() => {
    const fetchUserSettings = async () => {
      const auth = getAuth();
      const user = auth.currentUser;
      console.log("user===>", user);
      if (!user) return;

      const docRef = doc(db, "users", user.uid);
      const snap = await getDoc(docRef);
      console.log("snap===>", snap.data());
      const firstMessage = getMessageByKey(snap.data()?.avatar || "Pio");
      console.log("fetchUserSettings useEffect");
      startNewSession(firstMessage);
      setWelcomeMessage(firstMessage);
      setPlaceholder(getPlaceholderByKey(snap.data()?.avatar || "Pio"));
      if (snap.exists()) {
        setUserProfile({ ...userProfile, ...snap.data() });
      }
    };

    fetchUserSettings();
  }, []);

  useEffect(() => {
    const setInitialSession = async () => {
      if (!user) {
        console.error("User not authenticated");
        return;
      }
      try {
        const res = await api.post("/api/chat/session", {
          uid: user?.uid,
          topic: "prayer",
        });
        const newSession: ChatSession = {
          id: res.data.id,
          created_at: new Date().toISOString(),
          messages: [],
        };
        setCurrentSession(newSession);
      } catch (err) {
        console.error("Failed to create chat session", err);
      }
    };
    setInitialSession();
  }, [user]);

  useEffect(() => {
    if (!isTyping) return;

    const dots = ["Typing", "Typing.", "Typing..", "Typing..."];
    let index = 0;

    const interval = setInterval(() => {
      setTypingText(dots[index % dots.length]);
      index++;
    }, 500);

    return () => clearInterval(interval);
  }, [isTyping]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  const startNewSession = async (message: string) => {
    setMessage("");
    const welcomeMsg: Message = {
      sender: "ai",
      text: message,
    };

    setMessages([welcomeMsg]);
    try {
      const today = new Date().toISOString().split("T")[0];
      console.log("today", today);
      if (localStorage.getItem(today)) {
        console.log(
          "readings==>",
          JSON.parse(localStorage.getItem(today) || "{}")
        );
        setMassReadings(JSON.parse(localStorage.getItem(today) || "{}"));
        setShowReadings(true);
      } else {
        const res = await api.get("/api/mass-readings");
        setMassReadings(res.data);
        localStorage.setItem(today, JSON.stringify(res.data));
        setShowReadings(true);
      }

      //   console.log("Mass readings response:===>", res, res.data);
    } catch (err) {
      console.error("Failed to create session", err);
    }
  };
  const handleSend = async () => {
    if (!message.trim()) return;

    const userMsg: Message = { sender: "user", text: message };
    // setMessages((prev) => [...prev, userMsg]);
    setMessage("");
    setIsLoading(true);
    setIsTyping(true);

    // Show typing...
    const typingMsg: Message = { sender: "typing", text: "..." };
    setMessages((prev) => [...prev, userMsg, typingMsg]);

    try {
      const res = await api.post("/api/prayer/message", {
        chat_session_id: currentSession?.id,
        sender: "user",
        text: message,
        profile: userProfile,
      });
      console.log("Prayer API response:===>", res.data);
      const aiReply: Message = {
        id: res.data.id,
        sender: res.data.sender,
        text: res.data.text,
        timestamp: res.data.timestamp,
      };

      // Replace typing with real reply
      setMessages((prev) => {
        const withoutTyping = prev.filter((m) => m.sender !== "typing");
        return [...withoutTyping, aiReply];
      });
    } catch (err) {
      console.error("Failed to send message", err);
    } finally {
      setIsTyping(false);
      setIsLoading(false);
      setShowButtons(true);
    }
  };

  const handleFeedback = async (type: string, msgId: string, extra?: any) => {
    console.log(
      "Feedback clicked===>",
      type,
      msgId,
      extra,
      auth.currentUser?.email
    );
    try {
      await api.post("/api/feedback", {
        message_id: msgId,
        reaction: type,
        user_email: extra?.user_email || auth.currentUser?.email,
      });
    } catch (err) {
      console.error("Feedback failed", err);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    localStorage.clear();
    navigate("/signin");
  };

  const handleMicClick = async () => {
    if (!isRecording) {
      try {
        await startRecording();
      } catch (err) {
        console.error("Mic permission denied", err);
      }
    } else {
      try {
        const audioBlob = await stopRecording();
        console.log("Audio blob:", audioBlob);
        const text = await transcribeAudio(
          audioBlob,
          import.meta.env.VITE_OPENAI_API_KEY
        );
        console.log("Transcribed text:", text);
        setMessage(text);
      } catch (err) {
        console.error("Whisper failed", err);
      }
    }
  };

  const handleSaintClick = async (title: string, saint: string) => {
    setShowReadings(false);
    setMessages([]);
    const messageText = title + ":" + saint;
    const userMsg: Message = { sender: "user", text: messageText };
    setIsTyping(true);
    const typingMsg: Message = { sender: "typing", text: "..." };
    setMessages((prev) => [...prev, userMsg, typingMsg]);
    try {
      const res = await api.post("/api/bible/saint", {
        saint_name: saint,
        chat_session_id: currentSession?.id,
        sender: "user",
        text: messageText,
        avatar_name : userProfile.avatar || "Pio",
      });
      const aiReply: Message = {
        id: res.data.id,
        sender: res.data.sender,
        text: res.data.text,
        timestamp: res.data.timestamp,
      };

      // Replace typing with real reply
      setMessages((prev) => {
        const withoutTyping = prev.filter((m) => m.sender !== "typing");
        return [...withoutTyping, aiReply];
      });
      console.log("Scripture response:", res.data);
    } catch (err) {
      console.error("Failed to handle scripture click", err);
    } finally {
      setIsTyping(false);
      setShowButtons(true);
    }
  }
  const handleScriptureClick = async (title: string, scripture: string) => {
    setShowReadings(false);
    setMessages([]);
    const messageText = title + ":" + scripture;
    const userMsg: Message = { sender: "user", text: messageText };
    setIsTyping(true);
    const typingMsg: Message = { sender: "typing", text: "..." };
    setMessages((prev) => [...prev, userMsg, typingMsg]);

    try {
      const res = await api.post("/api/bible/scripture", {
        reading_title: title,
        scripture_reference: scripture,
        chat_session_id: currentSession?.id,
        sender: "user",
        text: messageText,
      });
      const aiReply: Message = {
        id: res.data.id,
        sender: res.data.sender,
        text: res.data.text,
        timestamp: res.data.timestamp,
      };

      // Replace typing with real reply
      setMessages((prev) => {
        const withoutTyping = prev.filter((m) => m.sender !== "typing");
        return [...withoutTyping, aiReply];
      });
      console.log("Scripture response:", res.data);
    } catch (err) {
      console.error("Failed to handle scripture click", err);
    } finally {
      setIsTyping(false);
      setShowButtons(true);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-black text-black dark:text-white">
      <header className="flex justify-between items-center p-4 border-b dark:border-gray-800">
        <h1 className="text-xl font-semibold">RYSEN</h1>
        <div className="flex items-center space-x-4">
          <Settings
            onClick={() => navigate("/settings")}
            className="cursor-pointer"
          />
          <LogOut
            onClick={handleLogout}
            className="cursor-pointer text-red-500"
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`w-fit max-w-[80%] px-4 py-3 rounded-xl relative
            ${
              msg.sender === "ai" || msg.sender === "typing"
                ? "bg-gray-100 dark:bg-gray-800 text-left"
                : "bg-blue-600 text-white self-end text-right ml-auto"
            }`}
          >
            {msg.sender === "typing"
              ? typingText
              : parseBoldItalicText(msg.text)}

            {msg.sender === "ai" && (
              <FeedbackIcons
                msg={msg}
                handleFeedback={handleFeedback}
                userEmail={user?.email}
              />
            )}
          </div>
        ))}
        <div ref={chatEndRef} />
        {showReadings && massReadings && (
          <div className="p-4 space-y-6">
            {/* Date and Liturgical Title */}
            <div className="text-center">
              <h2 className="text-lg font-medium text-gray-600 dark:text-gray-300">
                {massReadings?.date}
              </h2>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
                {toWordsOrdinal(parseInt(massReadings?.season_week ?? "0"))}th
                Week in {massReadings?.season_week} (Year {massReadings?.year})
              </h3>
            </div>

            {/* Reading Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <button
                className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl p-4 shadow hover:shadow-lg transition"
                onClick={() =>
                  handleScriptureClick(
                    "First Reading",
                    massReadings?.readings.first || ""
                  )
                }
              >
                <h4 className="font-semibold text-blue-600 dark:text-blue-400">
                  First Reading
                </h4>
                <p className="text-gray-700 dark:text-gray-300">
                  {massReadings?.readings.first}
                </p>
              </button>
              {massReadings?.readings.second && (
                <button
                  className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl p-4 shadow hover:shadow-lg transition"
                  onClick={() =>
                    handleScriptureClick(
                      "Second Reading",
                      massReadings?.readings.second || ""
                    )
                  }
                >
                  <h4 className="font-semibold text-green-600 dark:text-green-400">
                    Second Reading
                  </h4>
                  <p className="text-gray-700 dark:text-gray-300">
                    {massReadings?.readings.second}
                  </p>
                </button>
              )}

              <button
                className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl p-4 shadow hover:shadow-lg transition"
                onClick={() =>
                  handleScriptureClick(
                    "Responsorial Psalm",
                    massReadings?.readings.psalm || ""
                  )
                }
              >
                <h4 className="font-semibold text-purple-600 dark:text-purple-400">
                  Responsorial Psalm
                </h4>
                <p className="text-gray-700 dark:text-gray-300">
                  {massReadings?.readings.psalm}
                </p>
              </button>

              <button
                className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl p-4 shadow hover:shadow-lg transition"
                onClick={() =>
                  handleScriptureClick(
                    "Gospel Reading",
                    massReadings?.readings.gospel || ""
                  )
                }
              >
                <h4 className="font-semibold text-red-600 dark:text-red-400">
                  Gospel Reading
                </h4>
                <p className="text-gray-700 dark:text-gray-300">
                  {massReadings?.readings.gospel}
                </p>
              </button>

              <button className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl p-4 shadow hover:shadow-lg transition"
                onClick={() =>
                  handleSaintClick(
                    "Saint of the Day ",
                    massReadings?.saint || ""
                  )
                }
              >
                <h4 className="font-semibold text-yellow-600 dark:text-yellow-400">
                  Saint of the Day
                </h4>
                <p className="text-gray-700 dark:text-gray-300">
                  {massReadings?.saint}
                </p>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* {!showButtons && (
        <footer className="p-4 border-t dark:border-gray-800 flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={placeholder}
            className="flex-1 rounded-xl px-4 py-2 bg-gray-100 dark:bg-gray-800 focus:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={isLoading}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl"
          >
            Send
          </button>
          <button
            onClick={handleMicClick}
            className={`p-2 rounded-xl ${
              isRecording ? "bg-red-500" : "bg-gray-200 dark:bg-gray-700"
            }`}
          >
            <Mic className="text-white" />
          </button>
        </footer>
      )} */}
      <footer className="p-4 border-t dark:border-gray-800 flex gap-2">
        {showButtons && (
          <>
            <button
              onClick={() => {
                startNewSession(welcomeMessage);
                setShowButtons(false);
              }}
              className="bg-green-600 text-white px-4 py-2 rounded-xl flex-1"
            >
              Study This Verse
            </button>
            <button
              onClick={() => navigate("/chat")}
              className="bg-gray-400 text-white px-4 py-2 rounded-xl flex-1"
            >
              Select New Reading
            </button>
          </>
        )}
      </footer>

      <BottomBar />
    </div>
  );
};

export default BiblePage;
