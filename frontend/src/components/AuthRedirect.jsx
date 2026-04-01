import { Navigate } from "react-router-dom"
import { isModuleAuthenticated } from "@/lib/utils/auth"

/**
 * AuthRedirect Component
 * Redirects authenticated users away from auth pages to their module's home page
 * Only shows auth pages to unauthenticated users
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Auth page component to render if not authenticated
 * @param {string} props.module - Module name (user, restaurant, delivery, admin)
 * @param {string} props.redirectTo - Path to redirect to if authenticated (optional, defaults to module home)
 */
export default function AuthRedirect({ children, module, redirectTo = null }) {
  // Check if user is authenticated for this module
  const isAuthenticated = isModuleAuthenticated(module)

  const getRestaurantRedirectPath = () => {
    try {
      const rawUser = localStorage.getItem("restaurant_user")
      const user = rawUser ? JSON.parse(rawUser) : null
      const onboardingCompleted =
        user?.onboardingCompleted === true ||
        Number(user?.onboarding?.completedSteps || 0) >= 5
      const subscriptionStatus = String(user?.subscription?.status || "").toLowerCase()
      const hasActiveSubscription = subscriptionStatus === "active"

      if (!onboardingCompleted && !hasActiveSubscription) {
        try {
          const rawOnboarding = localStorage.getItem("restaurant_onboarding_data")
          const onboarding = rawOnboarding ? JSON.parse(rawOnboarding) : null
          const currentStep = Number(onboarding?.currentStep)
          if (Number.isFinite(currentStep) && currentStep >= 1 && currentStep <= 5) {
            return `/restaurant/onboarding?step=${currentStep}`
          }
        } catch {
          // Ignore parsing errors and fallback to onboarding root
        }
        return "/restaurant/onboarding"
      }

      return "/restaurant/to-hub"
    } catch {
      return "/restaurant/to-hub"
    }
  }

  // Define default home pages for each module
  const moduleHomePages = {
    user: "/",
    restaurant: "/restaurant/to-hub",
    delivery: "/delivery",
    admin: "/admin",
  }

  // If authenticated, redirect to module home page
  if (isAuthenticated) {
    const homePath = redirectTo ||
      (module === "restaurant" ? getRestaurantRedirectPath() : (moduleHomePages[module] || "/"))
    return <Navigate to={homePath} replace />
  }

  // If not authenticated, show the auth page
  return <>{children}</>
}

