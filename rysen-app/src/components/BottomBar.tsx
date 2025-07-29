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
interface BottomBarProps {
  handleBibleButtonClick: () => void;
}
const BottomBar  = ({handleBibleButtonClick}: BottomBarProps) => {
  const navigate = useNavigate();
  return (
    <div>
      <footer className="border-[#29292D] bg-[#171717] flex justify-around py-2">
        <div className="flex flex-col items-center cursor-pointer hover:text-blue-600 transition-colors">
          <Home className="w-6 h-6 mb-1" onClick={() => navigate("/chat")} />
          <span className="font-roboto font-regular text-[10px]">Ask</span>
        </div>
        <div className="flex flex-col items-center cursor-pointer hover:text-blue-600 transition-colors">
          <BookPlus
            className="w-6 h-6 mb-1"
            onClick={handleBibleButtonClick}
          />
          <span className="font-roboto font-regular text-[10px]">Seek</span>
        </div>
        <div className="flex flex-col items-center cursor-pointer hover:text-blue-600 transition-colors">
          <FaPrayingHands
            className="w-6 h-6 mb-1 text-[#666666]"
            onClick={() => navigate("/prayer")}
          />
          <span className="font-roboto font-regular text-[10px]">Knock</span>
        </div>
      </footer>
    </div>
  );
}

export default BottomBar;