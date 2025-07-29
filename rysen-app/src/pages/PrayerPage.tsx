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
import { FaTelegramPlane } from "react-icons/fa";
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

const avatarOptions = [
  {
    key: "Pio",
    name: "St. Padre Pio",
    darkimage: "/avatars/Pio - Dark mode.svg",
    lightimage: "/avatars/Pio - Light mode.svg",
    message:
      "Welcome. You are not alone in what you carry today. God already sees the depths of your heart.If the words feel far away, that’s okay - just share what’s on your heart.This space will help you by giving you a prayer you can offer to God. ** “The Lord is close to the brokenhearted; He rescues those whose spirits are crushed.” (Psalm 34:18)**",
    placeholder: "Bring your intention to the Lord",
  },
  {
    key: "Thérèse",
    name: "St. Teresa of Avila",
    darkimage: "/avatars/Therese - Dark mode.svg",
    lightimage: "/avatars/Therese - Light mode.svg",
    message:
      "Peace to your heart.Even a few honest words can be a beautiful prayer. If you don’t know what to say, simply write what you are feeling - a sorrow, a hope, or something you are thankful for. This space will gently help you find the words to speak with Jesus in prayer. **“Even before a word is on my tongue, Lord, You know it completely.” (Psalm 139:4)**",
    placeholder: "Share your heart with Jesus",
  },
  {
    key: "Dan",
    name: "Dan",
    darkimage: "/avatars/Dan - Dark mode.svg",
    lightimage: "/avatars/Dan - Light mode.svg",
    message:
      "Welcome. It’s good that you’re here. If something’s weighing on you, or even just stirring inside - take a moment to write it down. This space will help by turning your words into a prayer you can speak to God. **“Cast all your cares on Him, because He cares for you.” (1 Peter 5:7)** ",
    placeholder: "Whatever’s on your mind, place it here in prayer.",
  },
  {
    key: "Kim",
    name: "Kim",
    darkimage: "/avatars/Kim - Dark mode.svg",
    lightimage: "/avatars/Kim - Light mode.svg",
    message:
      "Hi, and welcome! Don’t worry if you don’t know how to pray or what to say. Just write what’s on your heart - a need, a joy, a question. This space will take your words and help shape them into a prayer you can offer to God.",
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

const PrayerPage = () => {
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
  const [userProfile, setUserProfile] = useState({
    name: "",
    age_range: "",
    sex: "",
    life_stage: "",
    spiritual_maturity: "",
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
    try {
      const res = await api.post("/api/chat/session", {
        uid: user?.uid,
        topic: "prayer",
      });
      const newSession: ChatSession = {
        id: res.data.id,
        created_at: new Date().toISOString(),
        messages: [welcomeMsg],
      };
      setCurrentSession(newSession);
      setMessages([welcomeMsg]);
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
        user_email: user?.email,
        user_id: user?.uid,
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
    navigate("/home");
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

  return (
    <div className="h-screen flex flex-col bg-[#212121] text-black dark:text-white">
      <header className="flex justify-between items-center p-4 border-b dark:border-gray-800">
        <h1 className="font-roboto font-semibold text-white text-[24px]">
          Personal Prayer
        </h1>
        <div className="flex items-center space-x-4">
          <Settings
            onClick={() => navigate("/settings")}
            className="cursor-pointer text-white"
          />
          {/* <LogOut
            onClick={handleLogout}
            className="cursor-pointer text-red-500"
          /> */}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-[#27234E] to-[#17161C]">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`w-fit max-w-[80%] px-4 py-3 rounded-xl relative text-white font-roboto font-mixed text-[15px]
            ${
              msg.sender === "ai" || msg.sender === "typing"
                ? "text-left"
                : "bg-[#976B19]  self-end text-right ml-auto"
            }`}
          >
            {msg.sender === "typing"
              ? typingText
              : parseBoldItalicText(msg.text)}

            {msg.sender === "ai" && idx !== 0 && (
              <FeedbackIcons
                msg={msg}
                handleFeedback={handleFeedback}
                userEmail={user?.email}
              />
            )}
          </div>
        ))}
        <div ref={chatEndRef} />
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
      <footer className="p-4  bg-[#17161C] flex gap-2">
        {showButtons ? (
          <>
            <button
              onClick={() => {
                startNewSession(welcomeMessage);
                setShowButtons(false);
              }}
              className="bg-white text-[#333333] px-4 py-2 rounded-xl flex-1 font-roboto font-medium text-[15px]"
            >
              New Intention
            </button>
            <button
              onClick={() => navigate("/chat")}
              className="bg-[#333333] text-white px-4 py-2 rounded-xl flex-1 text-[15px]"
            >
              Close
            </button>
          </>
        ) : (
          // <>
          //   <input
          //     type="text"
          //     value={message}
          //     onChange={(e) => setMessage(e.target.value)}
          //     placeholder={placeholder}
          //     className="flex-1 rounded-xl px-4 py-2 bg-gray-100 dark:bg-gray-800 focus:outline-none"
          //   />
          //   <button
          //     onClick={handleSend}
          //     disabled={isLoading}
          //     className="bg-blue-600 text-white px-4 py-2 rounded-xl"
          //   >
          //     Send
          //   </button>
          //   <button
          //     onClick={handleMicClick}
          //     className={`p-2 rounded-xl ${
          //       isRecording ? "bg-red-500" : "bg-gray-200 dark:bg-gray-700"
          //     }`}
          //   >
          //     <Mic className="text-white" />
          //   </button>
          // </>
          <div className="flex flex-col w-full mx-2 bg-[#333333] rounded-[6px]">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="How may I accompany you today?"
              className="w-full flex-1 text-white rounded-xl px-4 py-2 bg-[#333333] focus:outline-none"
            />
            <div className="flex flex-row justify-between w-full py-2 px-2">
              <button onClick={handleMicClick} className={`p-2 rounded-xl`}>
                <Mic className={isRecording ? `text-red-500` : `text-white`} />
              </button>

              <button
                onClick={handleSend}
                disabled={isLoading}
                className="bg-white text-white  rounded-full p-2"
              >
                <FaTelegramPlane
                  className="text-[#666666] rotate-45"
                  size={24}
                />
              </button>
            </div>
          </div>
        )}
      </footer>

      <BottomBar handleBibleButtonClick={() => navigate("/bible")} />
    </div>
  );
};

export default PrayerPage;
