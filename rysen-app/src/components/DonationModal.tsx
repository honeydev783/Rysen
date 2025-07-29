// import { Dialog } from "@headlessui/react";

// export function DonationPrompt({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
//   return (
//     <Dialog open={isOpen} onClose={onClose} className="relative z-50">
//       <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
//       <div className="fixed inset-0 flex items-center justify-center p-4">
//         <Dialog.Panel className="w-full max-w-md rounded-xl bg-white dark:bg-gray-800 p-6 shadow-xl">
//           <Dialog.Title className="text-lg font-bold mb-4">Support Rysen with a Donation</Dialog.Title>
//           <p className="mb-4">
//             If Rysen has blessed you, consider supporting this spiritual companion with a donation.
//           </p>
//           <button
//             className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded mb-2"
//             onClick={() => {
//               onClose();
//               // redirect to Stripe checkout
//               window.location.href = "/donate";
//             }}
//           >
//             Donate Now
//           </button>
//           <button className="w-full text-gray-600 dark:text-gray-300 py-2" onClick={onClose}>
//             Maybe Later
//           </button>
//         </Dialog.Panel>
//       </div>
//     </Dialog>
//   );
// }
import { useState } from "react";
import api from "../utils/api";
import { useNavigate } from "react-router-dom";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="bg-[#171717] rounded-xl w-full max-w-md shadow-xl relative mx-4 rounded-[8px] text-white">
        <h2 className="font-roboto text-[24px] font-semibold text-center mb-4 mt-[40px]">
          Would you consider supporting this mission?
        </h2>

        <div className="flex flex-wrap gap-2 justify-center mb-4">
          {predefined.map((amt) => (
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
          ))}
        </div>

        {/* spacing 16 */}
        <div className="m-4 flex items-center justify-center gap-2 text-[#999] dark:text-[#CCCDD1]">
          <div className="flex-1 h-px bg-[#ccc] dark:bg-[#333]" />
          <span className="text-[13px] font-roboto text-[13px]">
            or custom amount
          </span>
          <div className="flex-1 h-px bg-[#ccc] dark:bg-[#333]" />
        </div>

        <div className="flex flex-wrap gap-2 justify-center mb-4 px-4">
          <input
            type="string"
            placeholder="$"
            className="w-full p-2 mb-4  rounded-[6px] bg-[#282828] "
            value={`$${customAmount}`}
            onChange={(e) => {
              setAmount(null);
              const rawValue = e.target.value.replace(/[^0-9.]/g, ""); // remove $ and non-numeric
              console.log("rawValue==>", rawValue);
              setCustomAmount(rawValue);
              // setCustomAmount(e.target.value);
            }}
          />

          <label className="w-full flex items-center mb-4 font-roboto text-[#ffffff]  text-[15px]">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="accent-[#494A51] w-4 h-4 bg-[#282828] border border-[#494A51] mr-2"
            />
            Make this recurring donation
          </label>
        </div>

        <div className="m-4">
          <button
            onClick={handleDonate}
            className="w-full bg-[#333333] dark:bg-white text-white dark:text-[#333333] py-3 rounded-[33px] font-roboto font-medium text-[15px]"
            disabled={loading}
          >
            {loading ? "Redirecting..." : "Donate"}
          </button>
          {showSkipping && (
            <div
              className="mt-2 text-center text-[15px] font-roboto font-medium text-[#999999] cursor-pointer"
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
