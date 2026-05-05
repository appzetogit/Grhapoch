import { useLocation, useNavigate } from "react-router-dom"
import { useEffect, useState, useRef } from "react"
import { AnimatePresence, motion } from "framer-motion"
import BottomNavigation from "./BottomNavigation"
import { getUnreadDeliveryNotificationCount } from "../utils/deliveryNotifications"
import { Button } from "@/components/ui/button"
import { clearModuleAuth, isModuleAuthenticated } from "@/lib/utils/auth"
import { LogOut } from "lucide-react"

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
  const [showExitDialog, setShowExitDialog] = useState(false)
  const homeGuardPushedRef = useRef(false)
  const allowNextBackRef = useRef(false)

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
      if (allowNextBackRef.current) {
        allowNextBackRef.current = false
        return
      }
      setShowExitDialog(true)
      window.history.pushState({ deliveryHomeGuard: true }, "", window.location.href)
    }

    window.addEventListener("popstate", onPopState)
    return () => {
      window.removeEventListener("popstate", onPopState)
    }
  }, [normalizedPath])

  const tryExitNativeApp = async () => {
    if (typeof window === "undefined") return false

    try {
      const capacitorExit = window?.Capacitor?.Plugins?.App?.exitApp
      if (typeof capacitorExit === "function") {
        await capacitorExit()
        return true
      }
    } catch (_) {}

    try {
      const cordovaExit = window?.navigator?.app?.exitApp
      if (typeof cordovaExit === "function") {
        cordovaExit()
        return true
      }
    } catch (_) {}

    const androidBridge = window?.Android || window?.AndroidInterface
    if (androidBridge) {
      const exitMethods = ["exitApp", "closeApp", "finish"]
      for (const methodName of exitMethods) {
        const method = androidBridge?.[methodName]
        if (typeof method !== "function") continue
        try {
          method()
          return true
        } catch (_) {}
      }
    }

    try {
      const flutterHandler = window?.flutter_inappwebview?.callHandler
      if (typeof flutterHandler === "function") {
        await flutterHandler("exitApp")
        return true
      }
    } catch (_) {}

    return false
  }

  const handleDeliveryExitFromBackGuard = async () => {
    setShowExitDialog(false)
    const exitedNativeApp = await tryExitNativeApp()
    if (exitedNativeApp) return
    allowNextBackRef.current = true
    window.history.back()
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
        {showExitDialog && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
              onClick={() => setShowExitDialog(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="fixed left-1/2 top-1/2 z-[9999] max-w-[320px] w-[90%] -translate-x-1/2 -translate-y-1/2 rounded-[28px] bg-[#1c1c1c] p-6 border-none shadow-2xl flex flex-col items-center justify-center text-center select-none"
            >
              <div className="w-16 h-16 bg-[#2d2d2d] rounded-full flex items-center justify-center mb-4">
                <LogOut className="text-[#a8a8a8] w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 tracking-wide">
                Exit App?
              </h3>
              <p className="text-sm text-gray-400 mb-6 font-medium">
                Are you sure you want to exit?
              </p>
              <div className="flex items-center gap-3 w-full">
                <Button
                  type="button"
                  className="flex-1 bg-[#2d2d2d] hover:bg-[#3d3d3d] text-white rounded-2xl h-12 text-sm font-semibold border-none"
                  onClick={() => setShowExitDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="flex-1 bg-[#e0e0e0] hover:bg-[#f0f0f0] text-black rounded-2xl h-12 text-sm font-bold border-none"
                  onClick={handleDeliveryExitFromBackGuard}
                >
                  Exit
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

