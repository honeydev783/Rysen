import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, Settings } from "lucide-react";
import { handlePostSignIn } from "../firebase";
interface Message {
  sender: "user" | "ai";
  text: string;
}

interface ChatPageProps {
  showDonation: () => void;
}
const ChatPage = ({ showDonation }: ChatPageProps) => {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  
  useEffect(() => {
    const loginCount = parseInt(localStorage.getItem("login_count") || "1");
    if(loginCount == 5 || loginCount%10 ==0) {
        showDonation();
    }
    const greeted = localStorage.getItem("greeted");

    // if (!greeted) {
      const firstMessage: Message = {
        sender: "ai",
        text:
          loginCount <= 1
            ? "Welcome to Rysen, your spiritual companion. You can start chatting with your chosen avatar anytime. Tap the prayer icon for personalized prayers, or explore the settings to personalize your journey."
            : `Welcome back! How can we journey together today?`,
      };
      setMessages([firstMessage]);
      localStorage.setItem("greeted", "true");
    // }
  }, []);

  const handleSend = () => {
    if (!message.trim()) return;

    const userMsg: Message = { sender: "user", text: message };
    setMessages((prev) => [...prev, userMsg]);

    // TODO: Replace this with real backend response
    const aiResponse: Message = {
      sender: "ai",
      text: "Thank you for your message. I'm here to support your journey.",
    };

    setTimeout(() => {
      setMessages((prev) => [...prev, aiResponse]);
    }, 600);

    setMessage("");
  };

  return (
    <div className="h-screen bg-white dark:bg-black text-black dark:text-white flex flex-col">
      <header className="flex justify-between items-center p-4 border-b dark:border-gray-800">
        <h1 className="text-xl font-semibold">Rysen</h1>
        <Settings
          className="cursor-pointer"
          onClick={() => navigate("/settings")}
        />
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`max-w-[80%] px-4 py-2 rounded-xl ${
              msg.sender === "ai"
                ? "bg-gray-100 dark:bg-gray-800 text-left"
                : "bg-blue-600 text-white self-end text-right"
            }`}
          >
            {msg.text}
          </div>
        ))}
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
        >
          Send
        </button>
        <button className="p-2 bg-gray-200 dark:bg-gray-700 rounded-xl">
          <Mic className="text-gray-600 dark:text-white" />
        </button>
      </footer>
    </div>
  );
};

export default ChatPage;
