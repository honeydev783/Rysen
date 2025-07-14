// src/pages/PrivacyPolicyPage.tsx
import { Card, CardContent } from "../components/ui/card";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
export default function PrivacyPolicyPage() {
  const navigate = useNavigate();
  return (
    <div className="mt-4 p-4 max-w-3xl mx-auto text-sm text-gray-800 dark:text-gray-100">
      <Card>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none">
          <h1>RYSEN Privacy Policy</h1>
          <p>
            <strong>Effective Date:</strong> July 13, 2025
          </p>
          <p>
            RYSEN is committed to protecting your privacy and ensuring a secure,
            transparent experience...
            {/* Add full content as paragraphs and sections */}
          </p>

          <h2>1. Age Restriction</h2>
          <p>
            RYSEN is intended for users aged 16 and older. We do not knowingly
            collect personal...
          </p>

          <h2>2. Information We Collect</h2>
          <h3>a. Information You Provide</h3>
          <ul>
            <li>
              <strong>Onboarding Data:</strong> During onboarding, we collect...
            </li>
            <li>
              <strong>Chat Inputs:</strong> Text or voice inputs...
            </li>
            <li>
              <strong>Feedback:</strong> Written feedback submitted...
            </li>
          </ul>

          <h3>b. Automatically Collected Data</h3>
          <ul>
            <li>
              <strong>Chat History:</strong> The last 3 chat sessions...
            </li>
            <li>
              <strong>Analytics Data:</strong> We collect anonymized data...
            </li>
            <li>
              <strong>Device Info:</strong> Device type, OS, anonymized IP...
            </li>
          </ul>

          <h2>3. How We Use Your Information</h2>
          <ul>
            <li>Personalize your experience...</li>
            <li>Maintain chat context...</li>
            <li>Improve the app...</li>
          </ul>

          {/* Continue with other sections in this same structure... */}
          <h2>12. Changes to This Policy</h2>
          <p>We may update this Privacy Policy to reflect changes...</p>

          <p>
            Contact us at:{" "}
            <a href="mailto:privacy@rysen.app">privacy@rysen.app</a>
          </p>
        </CardContent>
      </Card>
      {/* Go Back Button */}
      <div className="mt-6 sticky bottom-0 bg-background py-4 flex justify-center border-t">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline"
        >
          <ChevronLeft size={20} /> Go Back
        </button>
      </div>

    </div>
  );
}
