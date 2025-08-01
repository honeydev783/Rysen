import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useVoiceRecorder } from "../utils/useVoiceRecorder";
import { transcribeAudio } from "../utils/whisper";
import {
  Home,
  BookPlus,
  Mic,
  Settings,
  LogOut,
  Clock,
  PlusCircle,
  BookOpen,
} from "lucide-react";
import { FaPrayingHands } from "react-icons/fa"; // FontAwesome Prayer icon

import { signOut, getAuth } from "firebase/auth";
import { auth, db } from "../firebase";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import FeedbackIcons from "../components/FeedbackIcons";
import { doc, getDoc } from "firebase/firestore";
import BottomBar from "../components/BottomBar";
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
interface WelcomeMessages {
  [avatar: string]: string[];
}

interface placeHolders {
  [avatar: string]: string[];
}

const welcomeMessages: WelcomeMessages = {
  Pio: [
    "Hello and welcome. This space is here if you want to share or explore what’s on your heart or mind.",
    "Greetings. Feel free to share whatever is weighing on you or any questions you have.",
    "Welcome. You’re invited to reflect or seek clarity on what matters most to you.",
  ],
  Thérèse: [
    "Hello and welcome. This is a gentle place to share what’s on your heart, big or small.",
    "Greetings. You can use this space to express whatever you’re thinking or feeling.",
    "Welcome. Feel free to speak openly here about anything you want to explore or understand better.",
  ],
  Kim: [
    "Hello and welcome! This is a space to talk through what’s on your mind or life.",
    "Hi there! Use this space to share your thoughts or questions whenever you need.",
    "Greetings! Glad you’re here. Feel free to explore what’s important to you today.",
  ],
  Dan: [
    "Hello and welcome. This is a space to share your thoughts or questions about everyday life.",
    "Greetings. Use this space whenever you want to reflect on what’s happening or seek some clarity.",
    "Welcome. You’re invited to share here whatever you need to think through or understand better.",
  ],
};

const placeHolders: placeHolders = {
  Pio: [
    "What’s on your heart today?",
    "What would you like to talk about?",
    "What’s been on your mind lately?",
  ],
  Thérèse: [
    "What’s quietly resting on your heart?",
    "What would you like to share today?",
    "What’s been on your mind or heart?",
  ],
  Kim: [
    "What’s been on your mind lately?",
    "What’s on your mind right now?",
    "What’s something you want to discuss?",
  ],
  Dan: [
    "What’s on your mind today?",
    "What’s been on your mind lately?",
    "What would you like to talk about?",
  ],
};

const getRandomWelcomeMessage = (avatarType: string) => {
  const messages = welcomeMessages[avatarType];
  const index = Math.floor(Math.random() * messages.length);
  console.log("randome number1===>", index);
  return messages[index];
};

const getRamdomPlaceholder = (avatarType: string) => {
  const holders = placeHolders[avatarType];
  const index = Math.floor(Math.random() * holders.length);
  console.log("randome number2===>", index);

  return holders[index];
};
// const parseBoldItalicText = (text: string) => {
//   const parts = text.split(/(\*\*[\s\S]*?\*\*)/g); // [\s\S] matches everything including newlines

//   return parts.map((part, i) => {
//     if (/^\*\*[\s\S]*\*\*$/.test(part)) {
//       const content = part.slice(2, -2); // remove the leading and trailing **
//       return (
//         <span key={i} className="font-bold italic whitespace-pre-line block">
//           {content}
//         </span>
//       );
//     } else {
//       return (
//         <span key={i} className="whitespace-pre-line block">
//           {part}
//         </span>
//       );
//     }
//   });
// };
const parseBoldItalicText = (text: string) => {
  // Match both **bold** and *bold*
  const parts = text.split(/(\*\*[\s\S]*?\*\*|\*[\s\S]*?\*)/g);

  return parts.map((part, i) => {
    // Match **bold** or *bold*
    if (/^\*\*[\s\S]*\*\*$/.test(part) || /^\*[\s\S]*\*$/.test(part)) {
      const content = part.startsWith("**")
        ? part.slice(2, -2)
        : part.slice(1, -1);
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
const getAvatarFileName = (user: any) => {
  console.log("avatar user===>", user);
  if (user.avatar == "Pio" && user.theme == "dark") {
    return "Pio - Dark mode.svg";
  } else if (user.avatar == "Pio" && user.theme == "light") {
    return "Pio - Light mode.svg";
  } else if (user.avatar == "Kim" && user.theme == "light") {
    return "Kim - Light mode.svg";
  } else if (user.avatar == "Kim" && user.theme == "dark") {
    return "Kim - Dark mode.svg";
  } else if (user.avatar == "Dan" && user.theme == "light") {
    return "Dan - Light mode.svg";
  } else if (user.avatar == "Dan" && user.theme == "dark") {
    return "Dan - Dark mode.svg";
  } else if (user.avatar == "Thérèse" && user.theme == "light") {
    return "Therese - Light mode.svg";
  } else if (user.avatar == "Thérèse" && user.theme == "dark") {
    return "Therese - Dark mode.svg";
  }
};
const ChatPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(
    null
  );
  const [showSessions, setShowSessions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingText, setTypingText] = useState("Typing");

  const { isRecording, startRecording, stopRecording } = useVoiceRecorder();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const pendingFollowUpRef = useRef<string | null>(null);
  const [avatarFile, setAvatarFile] = useState("");
  const [userProfile, setUserProfile] = useState({
    name: "",
    age_range: "",
    sex: "",
    life_stage: "",
    spiritual_maturity: "",
    spiritual_goals: [] as string[],
    avatar: "",
    responseStyle: ""
  });
  const [welcomeMessage, setWelcomeMsg] = useState(null);
  const [enable, setEnable] = useState(false);
  const [placeholder, setPlaceholder] = useState(
    "What would you like to talk about?"
  );
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
        setUserProfile({ ...userProfile, ...snap.data() });
      }
      setEnable(true);
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
    if (user?.uid) {
      loadSessions();
      const fileName = getAvatarFileName(user);
      console.log("file name==>", fileName);
      setAvatarFile(fileName);
    }
  }, [user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (pendingFollowUpRef.current && message === pendingFollowUpRef.current) {
      handleSend(); // sends the message
      pendingFollowUpRef.current = null; // reset
    }
  }, [message]);

  const loadSessions = async () => {
    try {
      const res = await api.get("/api/chat/sessions?limit=3&uid=" + user?.uid);
      setChatSessions(res.data.sessions.slice(0, 3));
      console.log("Loaded sessions:", res.data.sessions);
      startNewSession();
      // if (res.data.sessions.length > 0) {
      //   const latest = res.data.sessions[0];
      //   setCurrentSession(latest);
      //   setMessages(latest.messages);
      //   if (latest.messages.length == 0) {
      //     const welcomeMsg: Message = {
      //       sender: "ai",
      //       text: "Welcome to RYSEN, your spiritual companion. How may I accompany you today?",
      //     };
      //     setMessages([welcomeMsg]);
      //     // setChatSessions((prev) => [latest, ...prev].slice(0, 3));
      //     currentSession!.messages.push(welcomeMsg);
      //   }
      //   console.log("Loaded sessions:", res.data.sessions);
      //   console.log("Current session:", latest);
      // } else {
      //   startNewSession();
      // }
    } catch (err) {
      console.error("Failed to load sessions", err);
    }
  };

  const startNewSession = async () => {
    setMessage("");
    const msg = getRandomWelcomeMessage(user.avatar);
    console.log("welcomemessage===>", msg);
    setWelcomeMsg(msg);
    const plasceholder = getRamdomPlaceholder(user.avatar);
    setPlaceholder(plasceholder);
    const welcomeMsg: Message = {
      sender: "ai",
      text: msg,
    };
    try {
      const res = await api.post("/api/chat/session", {
        uid: user?.uid,
        topic: "chat",
      });
      const newSession: ChatSession = {
        id: res.data.id,
        created_at: new Date().toISOString(),
        messages: [welcomeMsg],
      };
      setCurrentSession(newSession);
      setMessages([welcomeMsg]);
      // setChatSessions((prev) => [newSession, ...prev].slice(0, 3));
    } catch (err) {
      console.error("Failed to create session", err);
    }
  };

  const handleSend = async () => {
    if (!message.trim() || !currentSession) return;

    const userMsg: Message = { sender: "user", text: message };
    // setMessages((prev) => [...prev, userMsg]);
    setMessage("");
    setIsLoading(true);
    setIsTyping(true);

    // Show typing...
    const typingMsg: Message = { sender: "typing", text: "..." };
    setMessages((prev) => [...prev, userMsg, typingMsg]);

    try {
      const res = await api.post("/api/chat/message", {
        chat_session_id: currentSession.id,
        sender: "user",
        text: message,
        profile: userProfile,
        user_email: user?.email,
        user_id: user?.uid,
      });

      const aiReply: Message = {
        id: res.data.id,
        sender: res.data.sender,
        text: res.data.text,
        timestamp: res.data.timestamp,
        follow_ups: res.data.follow_ups,
      };

      // Replace typing with real reply
      setMessages((prev) => {
        const withoutTyping = prev.filter((m) => m.sender !== "typing");
        return [...withoutTyping, aiReply];
      });

      // Update session
      setChatSessions((prev) =>
        prev.map((s) =>
          s.id === currentSession.id
            ? { ...s, messages: [...s.messages, userMsg, aiReply] }
            : s
        )
      );
    } catch (err) {
      console.error("Failed to send message", err);
    } finally {
      setIsTyping(false);
      setIsLoading(false);
    }
  };

  const handleFollowUpClick = (q: string) => {
    pendingFollowUpRef.current = q;
    setMessage(q);
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
  // const handleFeedback = async (reaction: string, messageId?: string) => {
  //   if (!messageId) return;
  //   try {
  //     await api.post("/api/feedback", {
  //       message_id: messageId,
  //       reaction,
  //       user_email: auth.currentUser?.email || "anonymous@rysen.app",
  //     });
  //   } catch (err) {
  //     console.error("Feedback failed", err);
  //   }
  // };

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

  const resumeSession = async (session: ChatSession) => {
    try {
      const res = await api.get(
        `/api/chat/session/${session.id}?uid=${user?.uid}`
      );
      setCurrentSession(res.data.session);
      setMessages(res.data.session.messages);
    } catch (err) {
      console.error("Failed to load session", err);
      setCurrentSession(session);
      setMessages(session.messages);
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col  ${
        user?.theme === "light"
          ? "bg-white text-[#333333]"
          : "bg-[#212121] text-white"
      }`}
    >
      <header className="flex justify-between items-center p-4 border-b ">
        <h1 className="font-roboto font-semibold text-[24px]">
          Spiritual Guidance
        </h1>
        <div className="flex items-center space-x-4">
          <PlusCircle
            onClick={() => {
              startNewSession();
              setShowSessions(false);
            }}
            className="cursor-pointer"
          />
          <Clock
            onClick={() => setShowSessions(!showSessions)}
            className="cursor-pointer"
          />
          {/* <FaPrayingHands
            onClick={() => console.log("Prayer clicked")}
            className="w-5 h-5 cursor-pointer"
            title="Prayer"
          />
          <BookOpen
            onClick={() => console.log("Bible Study clicked")}
            className="cursor-pointer"
          /> */}
          <Settings
            onClick={() => navigate("/settings")}
            className="cursor-pointer"
          />
          {/* <LogOut
            onClick={handleLogout}
            className="cursor-pointer text-red-500"
          /> */}
        </div>
      </header>

      {showSessions && (
        <div className="flex overflow-x-auto space-x-2 p-2 border-b dark:border-gray-800">
          {chatSessions.map((session) => (
            <button
              key={session.id}
              onClick={() => resumeSession(session)}
              className={`px-3 py-1 rounded-full text-sm ${
                currentSession?.id === session.id
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 dark:bg-gray-700"
              }`}
            >
              {new Date(session.created_at).toDateString()}
            </button>
          ))}
        </div>
      )}

      <div
        className={`flex-1 overflow-y-auto p-4 space-y-3  ${
          user?.theme === "light"
            ? "bg-gradient-to-b from-[#FFF2E0] to-[#FEFBF5]"
            : "bg-gradient-to-b from-[#4B3C12] to-[#281111]"
        }`}
      >
        {messages.map((msg, idx) => (
          <div>
            {(msg.sender === "ai" || msg.sender === "typing") && idx != 0 && (
              <div className="flex flex-row justify-content items-center px-4">
                <div>
                  <img
                    src={`/avatars/${avatarFile}`}
                    className="w-7 h-7 rounded-full object-cover"
                  />
                </div>
                <div
                  className={`pl-3 font-roboto font-regular text-[13px] ${
                    user?.theme === "light"
                      ? "text-[#666666]"
                      : "text-[#CCCDD1]"
                  }`}
                >
                  {user?.avatar}
                </div>
              </div>
            )}
            {user?.theme === "light" ? (
              <div
                key={idx}
                className={`w-fit max-w-[80%] px-4 py-3 rounded-xl relative text-[#333333] font-roboto font-mixed text-[15px]
            ${
              msg.sender === "ai" || msg.sender === "typing"
                ? "text-left "
                : "bg-[#ECDBC5]  font-iter self-end text-right ml-auto "
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
            ) : (
              <div
                key={idx}
                className={`w-fit max-w-[80%] px-4 py-3 rounded-xl relative text-white font-roboto font-mixed text-[15px]
            ${
              msg.sender === "ai" || msg.sender === "typing"
                ? "text-left "
                : "bg-[#976B19]  font-iter self-end text-right ml-auto "
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
            )}

            {msg.sender === "ai" && msg.follow_ups && (
              <div className="flex flex-wrap mt-2 gap-2 animate-rise rounded-[10px]">
                {msg.follow_ups.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleFollowUpClick(q)}
                    className={`px-3 py-1  rounded-[10px]  hover:bg-yellow-200 hover:text-black active:scale-95 transition-all  font-roboto font-mixed text-[15px] ${
                      user?.theme === "light"
                        ? "bg-[#F3F3F3] text-[#333333]"
                        : "bg-[#333333] text-white"
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <footer
        className={`p-4  flex gap-2  ${
          user?.theme === "light" ? "bg-[#FEFBF5]" : "bg-[#281111]"
        }`}
      >
        <div
          className={`flex flex-col w-full mx-2  rounded-[6px] ${
            user?.theme === "light" ? "bg-[#FAFAFA]" : "bg-[#333333]"
          }`}
        >
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={placeholder}
            className={`w-full flex-1 rounded-xl px-4 py-2  focus:outline-none ${
              user?.theme === "light" ? "bg-[#FAFAFA]" : "bg-[#333333]"
            }`}
          />
          <div className="flex flex-row justify-between w-full py-2 px-2">
            {user?.theme === "light" ? (
              <button onClick={handleMicClick} className={`p-2 rounded-xl`}>
                <Mic
                  className={isRecording ? `text-red-500` : `text-[#666666]`}
                />
              </button>
            ) : (
              <button onClick={handleMicClick} className={`p-2 rounded-xl`}>
                <Mic className={isRecording ? `text-red-500` : `text-white`} />
              </button>
            )}

            <button
              onClick={handleSend}
              disabled={isLoading}
              className={` rounded-full p-2 ${
                user?.theme === "light"
                  ? "bg-[#3D3D3D] text-[#E3E3E3]"
                  : "bg-white text-white"
              }`}
            >
              <FaTelegramPlane
                className={` rotate-45 ${
                  user?.theme === "light" ? "text-[#E3E3E3]" : "text-[#666666]"
                }`}
                size={24}
              />
            </button>
          </div>
        </div>
      </footer>
      <BottomBar handleBibleButtonClick={() => navigate("/bible")} />
    </div>
  );
};

export default ChatPage;
