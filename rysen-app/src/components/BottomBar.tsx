import { useNavigate } from "react-router-dom";
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
import { FaPrayingHands } from "react-icons/fa";
export default function BottomBar() {
  const navigate = useNavigate();
  return (
    <div>
      <footer className="border-t dark:border-gray-800 flex justify-around py-2 bg-white dark:bg-black">
        <div className="flex flex-col items-center cursor-pointer hover:text-blue-600 transition-colors">
          <Home className="w-6 h-6 mb-1" onClick={() => navigate("/chat")} />
          <span className="text-xs">Home</span>
        </div>
        <div className="flex flex-col items-center cursor-pointer hover:text-blue-600 transition-colors">
          <BookPlus
            className="w-6 h-6 mb-1"
            onClick={() => navigate("/bible")}
          />
          <span className="text-xs">Bible</span>
        </div>
        <div className="flex flex-col items-center cursor-pointer hover:text-blue-600 transition-colors">
          <FaPrayingHands
            className="w-6 h-6 mb-1"
            onClick={() => navigate("/prayer")}
          />
          <span className="text-xs">Prayer</span>
        </div>
      </footer>
    </div>
  );
}
