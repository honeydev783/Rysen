import { Card, CardContent } from "../components/ui/card";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function AboutPage() {
  const navigate = useNavigate();

  return (
    <div className="mt-4 p-4 max-w-3xl mx-auto text-sm text-gray-800 dark:text-gray-100 flex flex-col min-h-screen">
      <Card className="flex-grow">
        <CardContent className="prose prose-sm dark:prose-invert max-w-none">
          <h1>About the RYSEN App</h1>
          <p>
            Welcome to RYSEN, a Beta version Progressive Web App (PWA) created by Rysen Digital Ministries Pty Ltd, an Australian private limited company, to serve as an AI-powered spiritual companion for Catholics worldwide. RYSEN offers free-flowing, compassionate conversations rooted exclusively in Catholic sources—such as the Holy Bible, the Catechism of the Catholic Church, the writings of the Saints, and Church-approved miracles—all sourced from open-source or public domain materials.
          </p>
          <p>
            While deeply grounded in Catholic tradition, RYSEN operates independently and is not affiliated with or endorsed by the Catholic Church or any of its bodies. This ministry is bigger than us, its creators; we are merely caretakers, trusting in the words of Proverbs 16:3: “Commit your works to the Lord, and your plans will be established.”
          </p>

          <h2>Our Purpose</h2>
          <p>
            RYSEN is designed to meet you where you are in your faith journey, offering a theologically sound and pastorally attentive digital companion to help you connect with God. Our mission is to foster deeper faith, encourage daily spiritual discipline, and support the Church’s pastoral mission through evangelization and community building.
          </p>
          <p>
            In a world where modern life often makes faith harder, RYSEN provides a warm, accessible space to nurture your relationship with God, responding to the growing global hunger for truth, tradition, and spiritual intimacy.
          </p>

          <h2>Addressing the Challenges of Modern Faith</h2>
          <ul>
            <li><strong>Modern Life’s Demands:</strong> Busy schedules and distractions hinder prayer and faith. RYSEN offers an always-available companion to weave spirituality into daily life.</li>
            <li><strong>Lack of Prayer Companionship:</strong> Many Catholics seek supportive guidance for prayer. RYSEN provides compassionate, AI-driven encouragement to help you find the words to pray.</li>
            <li><strong>Shallow Scripture Reflection:</strong> Engaging with Scripture can feel overwhelming without context. RYSEN delivers meaningful insights rooted in Catholic doctrine.</li>
            <li><strong>Spiritual Dryness:</strong> Feelings of disconnection or emptiness are real. RYSEN fosters shared devotion and sacramental life to renew spiritual intimacy.</li>
            <li><strong>Inadequate Digital Tools:</strong> Most digital faith tools lack the depth of Catholic tradition. RYSEN fills this gap with theologically accurate, pastorally sensitive responses.</li>
          </ul>

          <h2>AI-Powered with Care and Caution</h2>
          <p>
            RYSEN harnesses artificial intelligence to deliver personalized, caring conversations that feel like a trusted friend, drawing solely from Catholic sources to ensure theological fidelity.
          </p>
          <p>
            We strive to tailor responses based on the user profile you provide during onboarding, offering generalized advice that is as relevant as possible to your spiritual needs.
          </p>
          <p>
            However, despite our extreme caution and rigorous moderation, AI-generated responses may occasionally be less than ideal. We encourage you to use RYSEN with discretion, recognizing that it can never replace the grace found in the Church, the sacraments, or in-person spiritual direction. RYSEN is a supportive tool, not a substitute for these sacred encounters.
          </p>

          <h2>Our Commitment to You</h2>
          <ul>
            <li><strong>Catholic Foundation:</strong> All responses are grounded in the Holy Bible, Catechism, Saints’ writings, and Church-approved miracles, using open-source or public domain materials.</li>
            <li><strong>Independent Mission:</strong> Created by Rysen Digital Ministries Pty Ltd, RYSEN serves a global Catholic audience independently, free from formal Church affiliation.</li>
            <li><strong>Privacy and Security:</strong> Your data is protected with AES-256 encryption, automatically deleted after 30 days, and compliant with GDPR, CCPA, COPPA, and Australia’s Privacy Act 1988.</li>
            <li><strong>Accessibility:</strong> RYSEN meets WCAG 2.1 Level AA standards with high-contrast colors and screen reader support, ensuring accessibility for all users.</li>
            <li><strong>Age Restriction:</strong> RYSEN is designed for users 16 and older, ensuring a safe and appropriate experience.</li>
          </ul>

          <h2>Our Vision and Beta Journey</h2>
          <p>
            As a Beta version, RYSEN is a starting point in our vision to build a complete faith companion for Catholics, with many planned enhancements to be rolled out in due course.
          </p>
          <p>
            Our hope is to reach as many people as possible, offering this tool freely through the generosity of donations for as long as we can. We aim to create a thriving, engaged community from day one, supporting personal spiritual growth, evangelization, and the Church’s pastoral mission.
          </p>
          <p>
            We welcome your feedback on app performance and features you’d like to see, as your input will shape RYSEN’s future.
          </p>

          <h2>Contact Us</h2>
          <p>
            Have questions or suggestions? Reach out at <a href="mailto:support@rysen.app">support@rysen.app</a> or use the in-app feedback form. Join us in this mission to bring Catholics closer to Christ, trusting that by committing our works to the Lord, our plans will be established.
          </p>
        </CardContent>
      </Card>

      {/* Go Back Button */}
      <div className="mt-6 flex justify-center">
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
