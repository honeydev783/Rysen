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
import axios from "axios";
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
        success_url: "http://localhost:3000/donate-success",
        cancel_url: "http://localhost:3000/chat",
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
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl w-full max-w-md shadow-xl relative">
        <div className="flex justify-end">
          <button
            onClick={() => {
              onClose();
            }}
            className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white text-2xl font-semibold leading-none"
          >
            &times;
          </button>
        </div>
        <h2 className="text-xl font-semibold text-center mb-4">
          Would you consider supporting this mission?
        </h2>

        <div className="flex flex-wrap gap-2 justify-center mb-4">
          {predefined.map((amt) => (
            <button
              key={amt}
              onClick={() => setAmount(amt)}
              className={`px-4 py-2 rounded-full border ${
                amount === amt
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700"
              }`}
            >
              ${amt}
            </button>
          ))}
        </div>

        <input
          type="number"
          placeholder="Custom amount"
          className="w-full p-2 mb-4 border rounded dark:bg-gray-700"
          value={customAmount}
          onChange={(e) => {
            setAmount(null);
            setCustomAmount(e.target.value);
          }}
        />

        <label className="flex items-center mb-4">
          <input
            type="checkbox"
            checked={isRecurring}
            onChange={(e) => setIsRecurring(e.target.checked)}
            className="mr-2"
          />
          Make this recurring donation
        </label>

        <div className="flex justify-between">
          {showSkipping && (
            <button
              onClick={onSkip}
              className="bg-gray-400 text-white px-4 py-2 rounded-xl flex-1"
            >
              Skip
            </button>
          )}
          <button
            onClick={handleDonate}
            className="bg-green-600 text-white px-4 py-2 rounded-xl flex-1"
            disabled={loading}
          >
            {loading ? "Redirecting..." : "Donate"}
          </button>
        </div>
      </div>
    </div>
  );
}
