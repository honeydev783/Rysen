// import { useEffect, useState, useRef } from "react";
// import { useNavigate } from "react-router-dom";
// import { useVoiceRecorder } from "../utils/useVoiceRecorder";
// import { transcribeAudio } from "../utils/whisper";
// import {
//   Mic,
//   Settings,
//   LogOut,
//   Heart,
//   Copy,
//   Share2,
//   Flag,
//   Clock,
//   PlusCircle,
// } from "lucide-react";
// import { signOut } from "firebase/auth";
// import { auth } from "../firebase";
// import api from "../utils/api";
// import { useAuth } from "../context/AuthContext"; // 👈 import useAuth

// interface Message {
//   id?: string;
//   sender: "user" | "ai";
//   text: string;
//   timestamp?: string;
//   follow_ups?: string[]; // ← new!
// }

// interface ChatSession {
//   id: string;
//   topic?: string;
//   summary?: string;
//   messages: Message[];
//   created_at: string;
// }

// const ChatPage = () => {
//   const navigate = useNavigate();
//   const { user } = useAuth(); // 👈 useAuth to get user info
//   const [message, setMessage] = useState("");
//   const [messages, setMessages] = useState<Message[]>([]);
//   const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
//   const [currentSession, setCurrentSession] = useState<ChatSession | null>(
//     null
//   );
//   const [showSessions, setShowSessions] = useState(false);
//   const [isLoading, setIsLoading] = useState(false);
//   const { isRecording, startRecording, stopRecording } = useVoiceRecorder();
//   const chatEndRef = useRef<HTMLDivElement>(null);

//   // Voice to text logic
//   const handleMicClick = async () => {
//     if (!isRecording) {
//       try {
//         await startRecording();
//       } catch (err) {
//         console.error("Microphone permission denied", err);
//       }
//     } else {
//       try {
//         const audioBlob = await stopRecording();
//         const whisperApiKey = import.meta.env.VITE_OPENAI_API_KEY;
//         const text = await transcribeAudio(audioBlob, whisperApiKey);
//         setMessage(text);
//       } catch (err) {
//         console.error("Whisper transcription failed", err);
//       }
//     }
//   };

//   useEffect(() => {
//     if (user?.uid) {
//       loadSessions();
//     }
//   }, [user]);

//   useEffect(() => {
//     scrollToBottom();
//   }, [messages]);

//   const scrollToBottom = () => {
//     chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
//   };

//   // Load last 3 sessions from backend
//   const loadSessions = async () => {
//     try {
//       const res = await api.get("/api/chat/sessions?limit=3&uid=" + user?.uid);
//       setChatSessions(res.data.sessions);
//       if (res.data.sessions.length > 0) {
//         const latest = res.data.sessions[0];
//         setCurrentSession(latest);
//         setMessages(latest.messages);
//       } else {
//         startNewSession();
//       }
//     } catch (err) {
//       console.error("Failed to load sessions", err);
//     }
//   };

//   // Start a new session
//   const startNewSession = async () => {
//     const welcomeMsg: Message = {
//       sender: "ai",
//       text: "Welcome to RYSEN, your spiritual companion. How may I accompany you today?",
//     };
//     try {
//       const res = await api.post("/api/chat/session", { uid: user?.uid });
//       const newSession: ChatSession = {
//         id: res.data.id,
//         created_at: new Date().toISOString(),
//         messages: [welcomeMsg],
//       };
//       setCurrentSession(newSession);
//       setMessages([welcomeMsg]);
//       setChatSessions((prev) => [newSession, ...prev].slice(0, 3)); // max 3 sessions
//     } catch (err) {
//       console.error("Failed to create session", err);
//     }
//   };

//   // Send user message
//   // const handleSend = async () => {
//   //   if (!message.trim() || !currentSession) return;
//   //   const userMsg: Message = { sender: "user", text: message };
//   //   setMessages((prev) => [...prev, userMsg]);
//   //   setMessage("");
//   //   setIsLoading(true);
//   //   try {
//   //     const res = await api.post("/api/chat/message", {
//   //       chat_session_id: currentSession.id,
//   //       sender: "user",
//   //       text: message,
//   //     });
//   //     const aiReply = res.data;

//   //     setMessages((prev) => [...prev, aiReply]); // AI reply
//   //     setChatSessions((prev) =>
//   //       prev.map((s) =>
//   //         s.id === currentSession.id
//   //           ? { ...s, messages: [...s.messages, userMsg, aiReply] }
//   //           : s
//   //       )
//   //     );
//   //   } catch (err) {
//   //     console.error("Failed to send message", err);
//   //   } finally {
//   //     setIsLoading(false);
//   //   }
//   // };
//   const handleSend = async () => {
//     if (!message.trim() || !currentSession) return;
//     const userMsg: Message = { sender: "user", text: message };
//     setMessages((prev) => [...prev, userMsg]);
//     setMessage("");
//     setIsLoading(true);

//     // Show typing effect while waiting
//     const typingMsg: Message = { sender: "ai", text: "..." };
//     setMessages((prev) => [...prev, userMsg, typingMsg]);

//     try {
//       const res = await api.post("/api/chat/message", {
//         chat_session_id: currentSession.id,
//         sender: "user",
//         text: message,
//       });

//       const aiReply: Message = {
//         id: res.data.id,
//         sender: res.data.sender,
//         text: res.data.text,
//         timestamp: res.data.timestamp,
//         follow_ups: res.data.follow_ups,
//       };

//       // Replace typingMsg with real AI reply
//       setMessages((prev) => {
//         const withoutTyping = prev.filter((m) => m !== typingMsg);
//         return [...withoutTyping, aiReply];
//       });

//       setChatSessions((prev) =>
//         prev.map((s) =>
//           s.id === currentSession.id
//             ? { ...s, messages: [...s.messages, userMsg, aiReply] }
//             : s
//         )
//       );
//     } catch (err) {
//       console.error("Failed to send message", err);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   // Feedback
//   const handleFeedback = async (reaction: string, messageId?: string) => {
//     if (!messageId) return;
//     try {
//       await api.post("/api/feedback", {
//         message_id: messageId,
//         reaction,
//         user_email: auth.currentUser?.email || "anonymous@rysen.app",
//       });
//     } catch (err) {
//       console.error("Feedback failed", err);
//     }
//   };

//   // Logout
//   const handleLogout = async () => {
//     await signOut(auth);
//     localStorage.clear();
//     navigate("/signin");
//   };

//   // Resume old session
//   const resumeSession = async (session: ChatSession) => {
//     // setCurrentSession(session);
//     // setMessages(session.messages);
//     try {
//       const res = await api.get(
//         `/api/chat/session/${session.id}?uid=${user?.uid}`
//       );
//       const updatedSession = res.data.session;
//       setCurrentSession(updatedSession);
//       setMessages(updatedSession.messages);
//     } catch (err) {
//       console.error("Failed to load session", err);
//       setCurrentSession(session);
//       setMessages(session.messages);
//     }
//   };

//   return (
//     <div className="h-screen bg-white dark:bg-black text-black dark:text-white flex flex-col">
//       <header className="flex justify-between items-center p-4 border-b dark:border-gray-800">
//         <h1 className="text-xl font-semibold">RYSEN</h1>
//         <div className="flex items-center space-x-4">
//           <PlusCircle
//             className="cursor-pointer"
//             onClick={() => {
//               startNewSession();
//               setShowSessions(false); // hide session list when new chat starts
//             }}
//           />
//           <Clock
//             className="cursor-pointer"
//             onClick={() => setShowSessions(!showSessions)}
//           />
//           <Settings
//             className="cursor-pointer"
//             onClick={() => navigate("/settings")}
//           />
//           <LogOut
//             className="cursor-pointer text-red-500"
//             onClick={handleLogout}
//           />
//         </div>
//       </header>

//       {/* Session list */}
//       {showSessions && (
//         <div className="flex overflow-x-auto space-x-2 p-2 border-b dark:border-gray-800">
//           {chatSessions.map((session) => (
//             <button
//               key={session.id}
//               onClick={() => resumeSession(session)}
//               className={`px-3 py-1 rounded-full text-sm ${
//                 currentSession?.id === session.id
//                   ? "bg-blue-600 text-white"
//                   : "bg-gray-200 dark:bg-gray-700"
//               }`}
//             >
//               {session.topic ||
//                 new Date(session.created_at).toLocaleDateString()}
//             </button>
//           ))}
//         </div>
//       )}

//       {/* Chat controls */}
//       {/* Chat */}
//       <div className="flex-1 overflow-y-auto p-4 space-y-3">
//         {messages.map((msg, idx) => (
//           <div
//             key={idx}
//             className={`w-fit max-w-[80%] px-4 py-3 rounded-xl relative ${
//               msg.sender === "ai"
//                 ? "bg-gray-100 dark:bg-gray-800 text-left"
//                 : "bg-blue-600 text-white self-end text-right ml-auto"
//             }`}
//           >
//             {msg.text}
//             {/* Show follow-up bubbles */}
//             {msg.sender === "ai" && msg.follow_ups && (
//               <div className="flex flex-wrap mt-2 gap-2 animate-rise">
//                 {msg.follow_ups.map((q, i) => (
//                   <button
//                     key={i}
//                     onClick={() => setMessage(q)}
//                     className="px-3 py-1 text-sm rounded-full bg-yellow-100 dark:bg-yellow-700 hover:bg-yellow-200 transition-all"
//                   >
//                     {q}
//                   </button>
//                 ))}
//               </div>
//             )}
//             {msg.sender === "ai" && (
//               <div className="absolute bottom-1 right-2 flex space-x-2 mt-2">
//                 <Heart
//                   className="w-4 h-4 cursor-pointer"
//                   onClick={() => handleFeedback("heart", msg.id)}
//                 />
//                 <Copy
//                   className="w-4 h-4 cursor-pointer"
//                   onClick={() => navigator.clipboard.writeText(msg.text)}
//                 />
//                 <Share2
//                   className="w-4 h-4 cursor-pointer"
//                   onClick={() => handleFeedback("share", msg.id)}
//                 />
//                 <Flag
//                   className="w-4 h-4 cursor-pointer text-red-500"
//                   onClick={() => handleFeedback("flag", msg.id)}
//                 />
//               </div>
//             )}
//           </div>
//         ))}
//         <div ref={chatEndRef} />
//       </div>

//       {/* Input */}
//       <footer className="p-4 border-t dark:border-gray-800 flex gap-2">
//         <input
//           type="text"
//           value={message}
//           onChange={(e) => setMessage(e.target.value)}
//           placeholder="How may I accompany you today?"
//           className="flex-1 rounded-xl px-4 py-2 bg-gray-100 dark:bg-gray-800 focus:outline-none"
//         />
//         <button
//           onClick={handleSend}
//           className="bg-blue-600 text-white px-4 py-2 rounded-xl"
//           disabled={isLoading}
//         >
//           Send
//         </button>
//         <button
//           className={`p-2 rounded-xl ${
//             isRecording ? "bg-red-500" : "bg-gray-200 dark:bg-gray-700"
//           }`}
//           onClick={handleMicClick}
//         >
//           <Mic className="text-white" />
//         </button>
//       </footer>
//     </div>
//   );
// };

// export default ChatPage;
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useVoiceRecorder } from "../utils/useVoiceRecorder";
import { transcribeAudio } from "../utils/whisper";
import {
  Mic,
  Settings,
  LogOut,
  Heart,
  Copy,
  Share2,
  Flag,
  Clock,
  PlusCircle,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import FeedbackIcons from "../components/FeedbackIcons";
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

  const loadSessions = async () => {
    try {
      const res = await api.get("/api/chat/sessions?limit=3&uid=" + user?.uid);
      setChatSessions(res.data.sessions);
      if (res.data.sessions.length > 0) {
        const latest = res.data.sessions[0];
        setCurrentSession(latest);
        setMessages(latest.messages);
        if (latest.messages.length == 0) {
          const welcomeMsg: Message = {
            sender: "ai",
            text: "Welcome to RYSEN, your spiritual companion. How may I accompany you today?",
          };
          setMessages([welcomeMsg]);
          // setChatSessions((prev) => [latest, ...prev].slice(0, 3));
          currentSession!.messages.push(welcomeMsg);
        }
        console.log("Loaded sessions:", res.data.sessions);
        console.log("Current session:", latest);
      } else {
        startNewSession();
      }
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
      const res = await api.post("/api/chat/session", { uid: user?.uid });
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
        const text = await transcribeAudio(
          audioBlob,
          import.meta.env.VITE_OPENAI_API_KEY
        );
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
    <div className="h-screen flex flex-col bg-white dark:bg-black text-black dark:text-white">
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
              {session.topic ||
                new Date(session.created_at).toLocaleDateString()}
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
            {msg.sender === "typing" ? typingText : msg.text}
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
            {msg.sender === "ai" && (
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
    </div>
  );
};

export default ChatPage;
