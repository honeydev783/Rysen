// // components/ProtectedRoute.tsx
// import { Navigate } from "react-router-dom";
// import { useAuth } from "../context/AuthContext";

// export const ProtectedRoute = ({
//   children,
//   requireOnboarding = false,
// }: {
//   children: JSX.Element;
//   requireOnboarding?: boolean;
// }) => {
//   const { user, onboardingComplete } = useAuth();

//   if (!user) return <Navigate to="/home" replace />;
//   if (requireOnboarding && !onboardingComplete)
//     return <Navigate to="/onboarding" replace />;

//   return children;
// };

// components/ProtectedRoute.tsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export const ProtectedRoute = ({
  children,
  requireOnboarding = false,
}: {
  children: JSX.Element;
  requireOnboarding?: boolean;
}) => {
  const { user, onboardingComplete, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-500 dark:text-gray-400">
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;
  if (requireOnboarding && !onboardingComplete)
    return <Navigate to="/onboard" replace />;

  return children;
};
