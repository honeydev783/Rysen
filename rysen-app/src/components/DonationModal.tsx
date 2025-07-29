import { useState } from "react";
import api from "../utils/api";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
interface DonationModalProps {
  // email: string; // user email from auth context
  onClose: () => void;
  showSkipping: boolean;
}

export default function DonationModal({
  onClose,
  showSkipping,
}: DonationModalProps) {
  const navigate = useNavigate();
  const [amount, setAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user, setuser } = useAuth();
  const predefined = [10, 20, 50, 100, 250];
  const onSkip = () => {
    console.log("User skipped donation prompt");
    onClose();
    navigate("/welcome");
  };
  const handleDonate = async () => {
    const finalAmount = amount ?? parseFloat(customAmount);
    if (!finalAmount || finalAmount < 1) return;

    setLoading(true);
    try {
      const res = await api.post("/donate", {
        amount: Math.round(finalAmount * 100), // convert to cents
        recurring: isRecurring,
        success_url: "https://rysen.app/donate-success",
        cancel_url: "https://rysen.app/welcome",
      });
      console.log("donation response==>", res.data.url);
      window.location.href = res.data.url;
    } catch (err) {
      console.log("Error creating donation session.", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60`}
    >
      <div
        className={`rounded-xl w-full max-w-md shadow-xl relative mx-4 rounded-[8px] text-white ${
          user?.theme === "light" ? "bg-white" : "bg-[#171717]"
        }`}
      >
        <h2
          className={`font-roboto text-[24px] font-semibold text-center mb-4 mt-[40px] ${
            user?.theme === "light" ? "text-[#333333]" : "text-[#FFFFFF]"
          }`}
        >
          Would you consider supporting this mission?
        </h2>

        <div className="flex flex-wrap gap-2 justify-center mb-4">
          {predefined.map((amt) =>
            user?.theme === "light" ? (
              <button
                key={amt}
                onClick={() => {
                  setAmount(amt);
                  setCustomAmount(amt.toString());
                }}
                className={`px-4 py-2 rounded-[80px] border ${
                  amount === amt ? "bg-[#FDEBEA] text-[#333333]" : "bg-[#FAFAFA] text-[#333333]"
                }`}
              >
                ${amt}
              </button>
            ) : (
              <button
                key={amt}
                onClick={() => {
                  setAmount(amt);
                  setCustomAmount(amt.toString());
                }}
                className={`px-4 py-2 rounded-[80px] border ${
                  amount === amt ? "bg-[#A55D51] text-white" : "bg-[#282828]"
                }`}
              >
                ${amt}
              </button>
            )
          )}
        </div>

        {/* spacing 16 */}
        <div className="m-4 flex items-center justify-center gap-2 text-[#999] dark:text-[#CCCDD1]">
          <div className={`flex-1 h-px   ${user?.theme === "light" ? "bg-[#ccc]" : "dark:bg-[#333]" }`} />
          <span className={`font-roboto text-[13px] ${user?.theme === "light" ? "text-[#666666]" : "text-[#ffffff]" }`}>
            or custom amount
          </span>
          <div className={`flex-1 h-px   ${user?.theme === "light" ? "bg-[#ccc]" : "dark:bg-[#333]" }`} />
        </div>

        <div className="flex flex-wrap gap-2 justify-center mb-4 px-4">
          <input
            type="string"
            placeholder="$"
            className={`w-full p-2 mb-4  rounded-[6px] ${user?.theme === "light" ? "bg-[#FAFAFA] text-[#333333]" : "bg-[#282828] text-[#333333]" }`}
            value={`$${customAmount}`}
            onChange={(e) => {
              setAmount(null);
              const rawValue = e.target.value.replace(/[^0-9.]/g, ""); // remove $ and non-numeric
              console.log("rawValue==>", rawValue);
              setCustomAmount(rawValue);
              // setCustomAmount(e.target.value);
            }}
          />

          <label className={`w-full flex items-center mb-4 font-roboto text-[15px] ${user?.theme === "light" ? "text-[#333333]" : "text-[#ffffff]" }`}>
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className={`accent-[#494A51] w-4 h-4  border border-[#494A51] mr-2 x`}
            />
            Make this recurring donation
          </label>
        </div>

        <div className="m-4">
          <button
            onClick={handleDonate}
            className={`w-full  text-white  py-3 rounded-[33px] font-roboto font-medium text-[15px] ${user?.theme === "light" ? "bg-[#333333] text-[#FFFFFF]" : "dark:bg-white text-[#333333]" }`}
            disabled={loading}
          >
            {loading ? "Redirecting..." : "Donate"}
          </button>
          {showSkipping && (
            <div
              className={`mt-2 text-center text-[15px] font-roboto font-medium text-[#999999] cursor-pointer ${user?.theme === "light" ? "text-[#717171]" : "text-[#999999]" }`}
              onClick={onSkip}
            >
              Not now
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
