// import { useEffect, useState } from "react";
// import { useNavigate } from "react-router-dom";
// import { Mic, Settings, LogOut } from "lucide-react";
// import { signOut } from "firebase/auth";
// import { auth } from "../firebase";

// interface Message {
//   sender: "user" | "ai";
//   text: string;
// }

// interface ChatPageProps {
//   showDonation: () => void;
// }

// const ChatPage = ({ showDonation }: ChatPageProps) => {
//   const navigate = useNavigate();
//   const [message, setMessage] = useState("");
//   const [messages, setMessages] = useState<Message[]>([]);

//   useEffect(() => {
//     const loginCount = parseInt(localStorage.getItem("login_count") || "1");
//     const greeted = localStorage.getItem("greeted");

//     const firstMessage: Message = {
//       sender: "ai",
//       text:
//         loginCount <= 1
//           ? "Welcome to Rysen, your spiritual companion. You can start chatting with your chosen avatar anytime. Tap the prayer icon for personalized prayers, or explore the settings to personalize your journey."
//           : `Welcome back! How can we journey together today?`,
//     };

//     setMessages([firstMessage]);
//     localStorage.setItem("greeted", "true");
//   }, []);

//   const handleSend = () => {
//     if (!message.trim()) return;

//     const userMsg: Message = { sender: "user", text: message };
//     setMessages((prev) => [...prev, userMsg]);

//     const aiResponse: Message = {
//       sender: "ai",
//       text: "Thank you for your message. I'm here to support your journey.",
//     };

//     setTimeout(() => {
//       setMessages((prev) => [...prev, aiResponse]);
//     }, 600);

//     setMessage("");
//   };

//   const handleLogout = async () => {
//     await signOut(auth);
//     localStorage.clear();
//     navigate("/signin");
//   };

//   return (
//     <div className="h-screen bg-white dark:bg-black text-black dark:text-white flex flex-col">
//       <header className="flex justify-between items-center p-4 border-b dark:border-gray-800">
//         <h1 className="text-xl font-semibold">Rysen</h1>
//         <div className="flex items-center space-x-4">
//           <Settings
//             className="cursor-pointer hover:text-blue-500 transition"
//             onClick={() => navigate("/settings")}
//           />
//           <LogOut
//             className="cursor-pointer hover:text-red-500 transition"
//             onClick={handleLogout}
//           />
//         </div>
//       </header>

//       <div className="flex-1 overflow-y-auto p-4 space-y-3">
//         {messages.map((msg, idx) => (
//           <div
//             key={idx}
//             className={`max-w-[80%] px-4 py-2 rounded-xl ${
//               msg.sender === "ai"
//                 ? "bg-gray-100 dark:bg-gray-800 text-left"
//                 : "bg-blue-600 text-white self-end text-right"
//             }`}
//           >
//             {msg.text}
//           </div>
//         ))}
//       </div>

//       <footer className="p-4 border-t dark:border-gray-800 flex gap-2">
//         <input
//           type="text"
//           value={message}
//           onChange={(e) => setMessage(e.target.value)}
//           placeholder="Type a message..."
//           className="flex-1 rounded-xl px-4 py-2 bg-gray-100 dark:bg-gray-800 focus:outline-none"
//         />
//         <button
//           onClick={handleSend}
//           className="bg-blue-600 text-white px-4 py-2 rounded-xl"
//         >
//           Send
//         </button>
//         <button className="p-2 bg-gray-200 dark:bg-gray-700 rounded-xl">
//           <Mic className="text-gray-600 dark:text-white" />
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
import { Mic, Settings, LogOut, Heart, Copy, Share2, Flag } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import axios from "axios";
import api from "../utils/api";
interface Message {
  id?: string;
  sender: "user" | "ai";
  text: string;
  is_voice?: boolean;
  timestamp?: string;
}

interface ChatSession {
  id: string;
  topic?: string;
  summary?: string;
  messages: Message[];
  created_at: string;
}

interface ChatPageProps {
  showDonation: () => void;
}

const ChatPage = ({ showDonation }: ChatPageProps) => {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { isRecording, startRecording, stopRecording } = useVoiceRecorder();
  const handleMicClick = async () => {
    if (!isRecording) {
      try {
        await startRecording();
      } catch (err) {
        console.error("Microphone permission denied", err);
      }
    } else {
      try {
        const audioBlob = await stopRecording();
        const whisperApiKey = import.meta.env.VITE_OPENAI_API_KEY;
        const text = await transcribeAudio(audioBlob, whisperApiKey);
        setMessage(text);
      } catch (err) {
        console.error("Whisper transcription failed", err);
      }
    }
  };

  useEffect(() => {
    startNewSession();
  }, []);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const startNewSession = async () => {
    const firstMessage: Message = {
      sender: "ai",
      text: "Welcome to RYSEN, your spiritual companion. You may begin with a question or reflection.",
    };

    try {
      const res = await axios.post("/chat/session", {});
      setSessionId(res.data.id);
      setMessages([firstMessage]);
    } catch (error) {
      console.error("Failed to create session", error);
    }
  };

  const handleSend = async () => {
    if (!message.trim() || !sessionId) return;

    const userMsg: Message = { sender: "user", text: message };
    setMessages((prev) => [...prev, userMsg]);
    setMessage("");
    setIsLoading(true);

    try {
      const res = await api.post("/chat/message", {
        chat_session_id: sessionId,
        sender: "user",
        text: message,
      });

      // const aiRes = await axios.post("/chat/message", {
      //   chat_session_id: sessionId,
      //   sender: "ai",
      //   text: await getAIResponse(message),
      // });

      // setMessages((prev) => [...prev, aiRes.data]);
    } catch (error) {
      console.error("Failed to send message", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getAIResponse = async (userText: string) => {
    // Simulate AI response here, replace with real API logic
    return `Let us reflect together on that...`;
  };

  const handleLogout = async () => {
    await signOut(auth);
    localStorage.clear();
    navigate("/signin");
  };

  const handleFeedback = async (reaction: string, messageId?: string) => {
    if (!messageId) return;
    await axios.post("/api/feedback", {
      message_id: messageId,
      reaction,
      user_email: auth.currentUser?.email || "anonymous@rysen.app",
    });
  };
  const handlePrayerRequest = async () => {
    if (!sessionId) return;

    const userMsg: Message = { sender: "user", text: "[Prayer Request]" };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await axios.post("/api/chat/message", {
        chat_session_id: sessionId,
        sender: "user",
        text: "[Prayer Request]",
        trigger: "prayer",
      });

      setMessages((prev) => [...prev, res.data]);
    } catch (err) {
      console.error("Prayer generation failed", err);
    } finally {
      setIsLoading(false);
    }
  };
  const handleBibleStudy = async () => {
    if (!sessionId) return;

    const userMsg: Message = { sender: "user", text: "[Bible Study]" };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await axios.post("/api/chat/message", {
        chat_session_id: sessionId,
        sender: "user",
        text: "[Bible Study]",
        trigger: "bible_study",
      });

      setMessages((prev) => [...prev, res.data]);
    } catch (err) {
      console.error("Bible study generation failed", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen bg-white dark:bg-black text-black dark:text-white flex flex-col">
      <header className="flex justify-between items-center p-4 border-b dark:border-gray-800">
        <h1 className="text-xl font-semibold">Rysen</h1>
        <div className="flex items-center space-x-4">
          <Settings
            className="cursor-pointer"
            onClick={() => navigate("/settings")}
          />
          <LogOut
            className="cursor-pointer text-red-500"
            onClick={handleLogout}
          />
        </div>
      </header>
      <div className="flex gap-4 p-4 justify-center border-b dark:border-gray-800">
        <button
          className="bg-yellow-200 dark:bg-yellow-600 text-black dark:text-white px-4 py-2 rounded-lg font-medium"
          onClick={() => handlePrayerRequest()}
        >
          🙏 Prayer
        </button>
        <button
          className="bg-green-200 dark:bg-green-700 text-black dark:text-white px-4 py-2 rounded-lg font-medium"
          onClick={() => handleBibleStudy()}
        >
          📖 Bible Study
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`max-w-[80%] px-4 py-3 rounded-xl relative ${
              msg.sender === "ai"
                ? "bg-gray-100 dark:bg-gray-800 text-left"
                : "bg-blue-600 text-white self-end text-right ml-auto"
            }`}
          >
            {msg.text}
            {msg.sender === "ai" && (
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
            )}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <footer className="p-4 border-t dark:border-gray-800 flex gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 rounded-xl px-4 py-2 bg-gray-100 dark:bg-gray-800 focus:outline-none"
        />
        <button
          onClick={handleSend}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl"
          disabled={isLoading}
        >
          Send
        </button>
        <button
          className={`p-2 rounded-xl ${
            isRecording ? "bg-red-500" : "bg-gray-200 dark:bg-gray-700"
          }`}
          onClick={handleMicClick}
        >
          <Mic className="text-white" />
        </button>
      </footer>
    </div>
  );
};

export default ChatPage;
