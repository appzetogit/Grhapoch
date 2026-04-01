import { useLocation, useNavigate } from "react-router-dom"
import { useEffect, useState, useRef } from "react"
import { AnimatePresence, motion } from "framer-motion"
import BottomNavigation from "./BottomNavigation"
import { getUnreadDeliveryNotificationCount } from "../utils/deliveryNotifications"
import { Button } from "@/components/ui/button"
import { clearModuleAuth, isModuleAuthenticated } from "@/lib/utils/auth"

export default function DeliveryLayout({ 
  children, 
  showGig = false,
  showPocket = false,
  onHomeClick,
  onGigClick
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const [requestBadgeCount, setRequestBadgeCount] = useState(() => 
    getUnreadDeliveryNotificationCount()
  )
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)
  const homeGuardPushedRef = useRef(false)

  // Update badge count when location changes
  useEffect(() => {
    setRequestBadgeCount(getUnreadDeliveryNotificationCount())
    
    // Listen for notification updates
    const handleNotificationUpdate = () => {
      setRequestBadgeCount(getUnreadDeliveryNotificationCount())
    }
    
    window.addEventListener('deliveryNotificationsUpdated', handleNotificationUpdate)
    window.addEventListener('storage', handleNotificationUpdate)
    
    return () => {
      window.removeEventListener('deliveryNotificationsUpdated', handleNotificationUpdate)
      window.removeEventListener('storage', handleNotificationUpdate)
    }
  }, [location.pathname])

  // Normalize trailing slash so "/delivery/" behaves same as "/delivery"
  const normalizedPath =
    location.pathname !== '/' ? location.pathname.replace(/\/+$/, '') : '/';

  // Pages where bottom navigation should be shown
  const showBottomNav = [
    '/delivery',
    '/delivery/requests',
    '/delivery/trip-history',
    '/delivery/profile'
  ].includes(normalizedPath)

  useEffect(() => {
    const isHomePath = normalizedPath === "/delivery"
    const isAuthenticated = isModuleAuthenticated("delivery")

    if (!isHomePath || !isAuthenticated) {
      homeGuardPushedRef.current = false
      return
    }

    if (!homeGuardPushedRef.current) {
      window.history.pushState({ deliveryHomeGuard: true }, "", window.location.href)
      homeGuardPushedRef.current = true
    }

    const onPopState = () => {
      setShowLogoutDialog(true)
      window.history.pushState({ deliveryHomeGuard: true }, "", window.location.href)
    }

    window.addEventListener("popstate", onPopState)
    return () => {
      window.removeEventListener("popstate", onPopState)
    }
  }, [normalizedPath])

  const handleDeliveryLogoutFromBackGuard = () => {
    clearModuleAuth("delivery")
    setShowLogoutDialog(false)
    navigate("/delivery/sign-in", { replace: true })
  }

  return (
    <>
      {children}
      {showBottomNav && (
        <BottomNavigation
          showGig={showGig}
          showPocket={showPocket}
          onHomeClick={onHomeClick}
          onGigClick={onGigClick}
          requestBadgeCount={requestBadgeCount}
        />
      )}

      <AnimatePresence>
        {showLogoutDialog && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9998] bg-black/50"
              onClick={() => setShowLogoutDialog(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              className="fixed left-1/2 top-1/2 z-[9999] w-[92%] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 border border-gray-200 shadow-xl"
            >
              <h3 className="text-center text-lg font-semibold text-gray-900">
                Are you sure you want to log out?
              </h3>
              <div className="mt-5 flex flex-col gap-3">
                <Button
                  type="button"
                  className="w-full h-11 bg-red-500 hover:bg-red-600 text-white"
                  onClick={handleDeliveryLogoutFromBackGuard}
                >
                  Logout
                </Button>
                <Button
                  type="button"
                  className="w-full h-11 bg-gray-100 hover:bg-gray-200 text-gray-800"
                  onClick={() => setShowLogoutDialog(false)}
                >
                  Stay Logged In
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

