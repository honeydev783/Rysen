import { useState } from "react";
import { Heart, Copy, Share2, Flag } from "lucide-react";
import clsx from "clsx";

interface Message {
  id?: string;
  sender: "user" | "ai" | "typing";
  text: string;
  timestamp?: string;
  follow_ups?: string[];
}

interface FeedbackIconsProps {
  msg: Message;
  handleFeedback: (type: string, msgId: string, extra?: any) => void;
  userEmail: string;
}

const FeedbackIcons = ({ msg, handleFeedback, userEmail }: FeedbackIconsProps) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [clicked, setClicked] = useState<{ [id: string]: string }>({});

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (err) {
      console.error("Copy failed", err);
    }
  };

  const handleClick = (type: string, id: string, extra?: any) => {
    setClicked((prev) => ({ ...prev, [id]: type }));
    handleFeedback(type, id, extra);
  };

  const handleShare = async () => {
    const shareText = `${msg.text}\n\nShared from RYSEN – Download now at https://rysen.app`;
    const shareUrl = "https://rysen.app";
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Shared from Rysen",
          text: shareText,
          url: shareUrl,
        });
        handleClick("share", msg.id);
      } catch (err) {
        console.error("Sharing failed:", err);
      }
    } else {
      // fallback if share API is not available
      alert("Sharing not supported on this device.");
    }
  };

  return (
    <div className="absolute bottom-1 right-2 flex space-x-3 mt-4 z-10">
      {/* Heart */}
      <div
        onClick={() => handleClick("heart", msg.id)}
        className="relative group"
      >
        <Heart
          className={clsx(
            "w-4 h-4 cursor-pointer transition-colors",
            clicked[msg.id] === "heart" ? "text-red-500 fill-red-500" : "text-gray-400"
          )}
        />
      </div>

      {/* Copy */}
      <div
        onClick={() => handleCopy(msg.text, msg.id)}
        className="relative group"
      >
        <Copy className="w-4 h-4 cursor-pointer text-gray-400 hover:text-blue-500 transition" />
        {copiedId === msg.id && (
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs bg-black text-white px-2 py-1 rounded shadow">
            Copied!
          </div>
        )}
      </div>

      {/* Share */}
      <div
        onClick={handleShare}
        className="relative group"
      >
        <Share2
          className={clsx(
            "w-4 h-4 cursor-pointer transition-transform duration-200",
            clicked[msg.id] === "share" && "text-green-500 scale-110"
          )}
        />
      </div>

      {/* Flag */}
      <div
        onClick={() =>
          handleClick("flag", msg.id, { user_email: userEmail })
        }
        className="relative group"
      >
        <Flag
          className={clsx(
            "w-4 h-4 cursor-pointer transition-colors",
            clicked[msg.id] === "flag" ? "text-yellow-500 fill-yellow-500" : "text-gray-400"
          )}
        />
      </div>
    </div>
  );
};

export default FeedbackIcons;
