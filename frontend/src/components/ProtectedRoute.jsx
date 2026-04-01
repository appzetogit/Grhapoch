import { Navigate, useLocation } from "react-router-dom";
import { isModuleAuthenticated } from "@/lib/utils/auth";

/**
 * Role-based Protected Route Component
 * Only allows access if user is authenticated for the specific module
 */
export default function ProtectedRoute({ children, requiredRole, loginPath }) {
  const location = useLocation();

  // Check if user is authenticated for the required module using module-specific token
  if (!requiredRole) {
    // If no role required, allow access
    return children;
  }

  const isAuthenticated = isModuleAuthenticated(requiredRole);

  // If not authenticated for this module, redirect to login
  if (!isAuthenticated) {
    if (loginPath) {
      return <Navigate to={loginPath} state={{ from: location.pathname }} replace />;
    }
    
    // Fallback: redirect to appropriate login page
    const roleLoginPaths = {
      'admin': '/admin/login',
      'restaurant': '/restaurant/login',
      'delivery': '/delivery/sign-in',
      'user': '/user/auth/sign-in'
    };
    
    const redirectPath = roleLoginPaths[requiredRole] || '/';
    return <Navigate to={redirectPath} replace />;
  }

  // Restaurant-specific guard:
  // If onboarding is incomplete, keep user inside onboarding/subscription flow.
  if (requiredRole === "restaurant") {
    const path = location.pathname || "";
    const isAllowedDuringOnboarding =
      path.startsWith("/restaurant/onboarding") ||
      path.startsWith("/restaurant/subscription-plans") ||
      path.startsWith("/restaurant/subscription-success");

    if (!isAllowedDuringOnboarding) {
      try {
        const rawUser = localStorage.getItem("restaurant_user");
        const user = rawUser ? JSON.parse(rawUser) : null;
        const onboardingCompleted =
          user?.onboardingCompleted === true ||
          Number(user?.onboarding?.completedSteps || 0) >= 5;
        const subscriptionStatus = String(user?.subscription?.status || "").toLowerCase();
        const hasActiveSubscription = subscriptionStatus === "active";

        if (!onboardingCompleted && !hasActiveSubscription) {
          let onboardingPath = "/restaurant/onboarding";
          try {
            const rawOnboarding = localStorage.getItem("restaurant_onboarding_data");
            const onboarding = rawOnboarding ? JSON.parse(rawOnboarding) : null;
            const currentStep = Number(onboarding?.currentStep);
            if (Number.isFinite(currentStep) && currentStep >= 1 && currentStep <= 5) {
              onboardingPath = `/restaurant/onboarding?step=${currentStep}`;
            }
          } catch {
            // Ignore local onboarding parse failures and fallback to onboarding root.
          }
          return <Navigate to={onboardingPath} replace />;
        }
      } catch {
        // If parsing fails, do not block route here.
      }
    }
  }

  return children;
}

