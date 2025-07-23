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

  const [userProfile, setUserProfile] = useState({
    name: "",
    age_range: "",
    sex: "",
    life_stage: "",
    spiritual_maturity: 1.0,
    spiritual_goals: [] as string[],
    avatar: "",
  });
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
    if (user?.uid) loadSessions();
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
      setChatSessions(res.data.sessions);
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
    const welcomeMsg: Message = {
      sender: "ai",
      text: "Welcome to RYSEN, your spiritual companion. How may I accompany you today?",
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
      setChatSessions((prev) => [newSession, ...prev].slice(0, 3));
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
    <div className="min-h-screen flex flex-col bg-white dark:bg-black text-black dark:text-white">
      <header className="flex justify-between items-center p-4 border-b dark:border-gray-800">
        <h1 className="text-xl font-semibold">RYSEN</h1>
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
          <LogOut
            onClick={handleLogout}
            className="cursor-pointer text-red-500"
          />
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
            {msg.sender === "typing" ? typingText : parseBoldItalicText(msg.text) }
            {msg.sender === "ai" && msg.follow_ups && (
              <div className="flex flex-wrap mt-2 gap-2 animate-rise">
                {msg.follow_ups.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleFollowUpClick(q)}
                    className="px-3 py-1 text-sm rounded-full bg-yellow-100 dark:bg-yellow-700 hover:bg-yellow-200 active:scale-95 transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
            {msg.sender === "ai" &&  idx !== 0 && (
              <FeedbackIcons
                msg={msg}
                handleFeedback={handleFeedback}
                userEmail={user?.email}
              />
            )}
            {/* {msg.sender === "ai" && (
              <div className="absolute bottom-1 right-2 flex space-x-2 mt-2">
                <Heart
                  className="w-4 h-4 cursor-pointer"
                  onClick={() => handleFeedback("heart", msg.id)}
                />
                <Copy
                  className="w-4 h-4 cursor-pointer"
                  onClick={() => navigator.clipboard.writeText(msg.text)}
                />
                <Share2
                  className="w-4 h-4 cursor-pointer"
                  onClick={() => handleFeedback("share", msg.id)}
                />
                <Flag
                  className="w-4 h-4 cursor-pointer text-red-500"
                  onClick={() => handleFeedback("flag", msg.id)}
                />
              </div>
            )} */}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <footer className="p-4 border-t dark:border-gray-800 flex gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="How may I accompany you today?"
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
      <BottomBar handleBibleButtonClick = {() => navigate('/bible')} />
    </div>
  );
};

export default ChatPage;
