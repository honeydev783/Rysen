// src/pages/TermsOfServicePage.tsx
import { Card, CardContent } from "../components/ui/card";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function TermsOfServicePage() {
  const navigate = useNavigate();

  return (
    <div className="mt-4 p-4 max-w-3xl mx-auto text-sm text-gray-800 dark:text-gray-100">
      <Card>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none">
          <h1>RYSEN Terms of Service</h1>
          <p>
            <strong>Effective Date:</strong> July 13, 2025
          </p>
          <p>
            Welcome to RYSEN, an AI-powered spiritual companion PWA created by
            Rysen Digital Ministries Pty Ltd, an Australian private limited
            company. These Terms govern your use of RYSEN...
          </p>

          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using RYSEN, you confirm you are 16 or older and
            agree to be bound by these Terms and the Privacy Policy...
          </p>

          <h2>2. Age Restriction</h2>
          <p>RYSEN is intended for users aged 16 and older...</p>

          <h2>3. Use of the Service</h2>
          <p>
            RYSEN is a Beta version PWA designed to support your Catholic faith
            through AI-driven conversations...
          </p>
          <h3>Permitted Uses</h3>
          <ul>
            <li>
              Engage in conversations for prayer, Scripture reflection, or
              spiritual guidance.
            </li>
            <li>
              Provide feedback via in-app form or{" "}
              <a href="mailto:support@rysen.app">support@rysen.app</a>.
            </li>
            <li>
              Use RYSEN as a supplementary tool to support your faith journey.
            </li>
          </ul>

          <h3>Prohibited Uses</h3>
          <ul>
            <li>
              Use for commercial purposes, unlawful activities, or non-spiritual
              uses.
            </li>
            <li>Reverse-engineer, hack, or disrupt the app’s functionality.</li>
            <li>Submit false or misleading information.</li>
            <li>
              Use RYSEN in a way that disrespects Catholic teachings or users.
            </li>
          </ul>

          <h3>AI Limitations</h3>
          <p>
            RYSEN uses AI to provide generalized spiritual advice based on your
            profile...
          </p>

          <h2>4. User Responsibilities</h2>
          <ul>
            <li>Provide accurate onboarding info.</li>
            <li>Use respectfully and aligned with the mission.</li>
            <li>Report issues or inappropriate content.</li>
            <li>
              Understand it’s a supplement, not a replacement, for Church
              sacraments.
            </li>
          </ul>

          <h2>5. Intellectual Property</h2>
          <p>
            RYSEN’s content is owned by Rysen Digital Ministries Pty Ltd or its
            licensors...
          </p>

          <h2>6. Privacy</h2>
          <p>
            Your privacy is paramount. Please review our{" "}
            <a href="/privacy">Privacy Policy</a>...
          </p>

          <h2>7. Beta Status and Feedback</h2>
          <p>
            RYSEN is in Beta. We aim to offer it for free through donations...
          </p>

          <h2>8. Limitation of Liability</h2>
          <ul>
            <li>We are not liable for errors in AI-generated responses.</li>
            <li>Service interruptions may occur due to Beta status.</li>
            <li>You assume responsibility for applying RYSEN’s advice.</li>
          </ul>

          <h2>9. Termination</h2>
          <p>
            We may suspend or terminate your access if Terms are violated...
          </p>

          <h2>10. Governing Law and Dispute Resolution</h2>
          <p>
            These Terms are governed by the laws of New South Wales,
            Australia...
          </p>

          <h2>11. Changes to Terms</h2>
          <p>We may update these Terms with notice via the app or email...</p>

          <h2>12. Contact Us</h2>
          <p>
            For questions, email{" "}
            <a href="mailto:support@rysen.app">support@rysen.app</a> or use the
            in-app feedback form.
          </p>

          <p>
            Thank you for joining RYSEN’s mission to foster Catholic faith
            worldwide.
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
