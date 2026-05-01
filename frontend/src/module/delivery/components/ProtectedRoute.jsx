import { Navigate, useLocation } from "react-router-dom"
import { isModuleAuthenticated } from "@/lib/utils/auth"

export default function ProtectedRoute({ children }) {
  const location = useLocation()
  // Check if user is authenticated using proper token validation
  const isAuthenticated = isModuleAuthenticated("delivery")

  if (!isAuthenticated) {
    return <Navigate to="/delivery/sign-in" replace />
  }

  // Enforce completing delivery onboarding before accessing delivery panel routes.
  // This mirrors restaurant onboarding gating: partial signup records should not access dashboard.
  try {
    const stored = localStorage.getItem("delivery_user")
    if (stored) {
      const profile = JSON.parse(stored)
      const isComplete = profile?.isProfileComplete === true
      if (!isComplete) {
        const currentPath = location?.pathname || ""
        if (!currentPath.startsWith("/delivery/signup/")) {
          return <Navigate to="/delivery/signup/details" replace />
        }
      }
    }
  } catch {
    // If localStorage parsing fails, do not block; server-side still enforces required fields on submit.
  }

  return children
}

