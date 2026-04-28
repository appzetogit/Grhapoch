import { Outlet, useLocation } from "react-router-dom"
import { useEffect, useState, useRef, createContext, useContext } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ProfileProvider } from "../context/ProfileContext"
import LocationPrompt from "./LocationPrompt"
import { CartProvider } from "../context/CartContext"
import { OrdersProvider } from "../context/OrdersContext"
import SearchOverlay from "./SearchOverlay"
import LocationSelectorOverlay from "./LocationSelectorOverlay"
import BottomNavigation from "./BottomNavigation"
import DesktopNavbar from "./DesktopNavbar"
import { UserLocationProvider } from "../context/UserLocationContext"
import CartConflictModal from "./CartConflictModal"
import UserGlobalDiningBookingListener from "./UserGlobalDiningBookingListener"
import { Button } from "@/components/ui/button"
import { isModuleAuthenticated } from "@/lib/utils/auth"

// Create SearchOverlay context with default value
const SearchOverlayContext = createContext({
  isSearchOpen: false,
  searchValue: "",
  setSearchValue: () => {
    console.warn("SearchOverlayProvider not available")
  },
  openSearch: () => {
    console.warn("SearchOverlayProvider not available")
  },
  closeSearch: () => { }
})

export function useSearchOverlay() {
  const context = useContext(SearchOverlayContext)
  // Always return context, even if provider is not available (will use default values)
  return context
}

function SearchOverlayProvider({ children }) {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")

  const openSearch = () => {
    setIsSearchOpen(true)
  }

  const closeSearch = () => {
    setIsSearchOpen(false)
    setSearchValue("")
  }

  return (
    <SearchOverlayContext.Provider value={{ isSearchOpen, searchValue, setSearchValue, openSearch, closeSearch }}>
      {children}
      <SearchOverlay
        isOpen={isSearchOpen}
        onClose={closeSearch}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
      />
    </SearchOverlayContext.Provider>
  )
}

// Create LocationSelector context with default value
const LocationSelectorContext = createContext({
  isLocationSelectorOpen: false,
  openLocationSelector: () => {
    console.warn("LocationSelectorProvider not available")
  },
  closeLocationSelector: () => { }
})

export function useLocationSelector() {
  const context = useContext(LocationSelectorContext)
  if (!context) {
    throw new Error("useLocationSelector must be used within LocationSelectorProvider")
  }
  return context
}

function LocationSelectorProvider({ children }) {
  const [isLocationSelectorOpen, setIsLocationSelectorOpen] = useState(false)

  const openLocationSelector = () => {
    setIsLocationSelectorOpen(true)
  }

  const closeLocationSelector = () => {
    setIsLocationSelectorOpen(false)
  }

  useEffect(() => {
    if (!isLocationSelectorOpen) {
      document.body.removeAttribute("data-location-selector-open")
      return
    }

    document.body.setAttribute("data-location-selector-open", "true")
    window.history.pushState({ locationSelectorOverlay: true }, "", window.location.href)

    const handleBackWhileLocationOpen = () => {
      setIsLocationSelectorOpen(false)
    }

    const handleNativeBackWhileLocationOpen = (event) => {
      if (event?.preventDefault) event.preventDefault()
      setIsLocationSelectorOpen(false)
    }

    window.addEventListener("popstate", handleBackWhileLocationOpen)
    document.addEventListener("backbutton", handleNativeBackWhileLocationOpen, false)
    return () => {
      document.body.removeAttribute("data-location-selector-open")
      window.removeEventListener("popstate", handleBackWhileLocationOpen)
      document.removeEventListener("backbutton", handleNativeBackWhileLocationOpen, false)
    }
  }, [isLocationSelectorOpen])

  const value = {
    isLocationSelectorOpen,
    openLocationSelector,
    closeLocationSelector
  }

  return (
    <LocationSelectorContext.Provider value={value}>
      {children}
      <LocationSelectorOverlay
        isOpen={isLocationSelectorOpen}
        onClose={closeLocationSelector}
      />
    </LocationSelectorContext.Provider>
  )
}

export default function UserLayout() {
  const location = useLocation()
  const [showExitDialog, setShowExitDialog] = useState(false)
  const homeGuardPushedRef = useRef(false)
  const allowNextBackRef = useRef(false)

  const tryExitNativeApp = async () => {
    if (typeof window === "undefined") return false

    // Capacitor runtime (Android/iOS app shells).
    try {
      const capacitorExit = window?.Capacitor?.Plugins?.App?.exitApp
      if (typeof capacitorExit === "function") {
        await capacitorExit()
        return true
      }
    } catch (_) {
      // Try other native bridges below.
    }

    // Cordova runtime.
    try {
      const cordovaExit = window?.navigator?.app?.exitApp
      if (typeof cordovaExit === "function") {
        cordovaExit()
        return true
      }
    } catch (_) {
      // Try other native bridges below.
    }

    // Android WebView bridge (common in hybrid wrappers).
    const androidBridge = window?.Android || window?.AndroidInterface
    if (androidBridge) {
      const exitMethods = ["exitApp", "closeApp", "finish"]
      for (const methodName of exitMethods) {
        const method = androidBridge?.[methodName]
        if (typeof method !== "function") continue
        try {
          method()
          return true
        } catch (_) {
          // Try next bridge method.
        }
      }
    }

    // Flutter InAppWebView bridge.
    try {
      const flutterHandler = window?.flutter_inappwebview?.callHandler
      if (typeof flutterHandler === "function") {
        await flutterHandler("exitApp")
        return true
      }
    } catch (_) {
      // No-op: fallback to browser history below.
    }

    return false
  }

  useEffect(() => {
    // Reset scroll to top whenever location changes (pathname, search, or hash)
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [location.pathname, location.search, location.hash])

  // Logic for showing navigation
  const isLegalPage = location.pathname.includes("/terms") ||
    location.pathname.includes("/privacy") ||
    location.pathname.includes("/code-of-conduct") ||
    location.pathname.includes("/refund") ||
    location.pathname.includes("/shipping") ||
    location.pathname.includes("/cancellation")

  const showNav = (location.pathname === "/" ||
    location.pathname === "/user" ||
    location.pathname === "/dining" ||
    location.pathname === "/user/dining" ||
    location.pathname === "/under-250" ||
    location.pathname === "/user/under-250" ||
    location.pathname === "/profile" ||
    location.pathname === "/user/profile" ||
    location.pathname.startsWith("/user/profile")) && !isLegalPage

  const showBottomNav = showNav

  useEffect(() => {
    const normalizedPath = location.pathname !== "/" ? location.pathname.replace(/\/+$/, "") : "/"
    const isHomePath = normalizedPath === "/" || normalizedPath === "/user"
    const isAuthenticated = isModuleAuthenticated("user")

    if (!isHomePath || !isAuthenticated) {
      homeGuardPushedRef.current = false
      return
    }

    if (!homeGuardPushedRef.current) {
      window.history.pushState({ userHomeGuard: true }, "", window.location.href)
      homeGuardPushedRef.current = true
    }

    const onPopState = () => {
      if (allowNextBackRef.current) {
        allowNextBackRef.current = false
        return
      }
      // If location selector is open, let that overlay consume the back press.
      if (document.body?.getAttribute("data-location-selector-open") === "true") {
        return
      }
      setShowExitDialog(true)
      window.history.pushState({ userHomeGuard: true }, "", window.location.href)
    }

    window.addEventListener("popstate", onPopState)
    return () => {
      window.removeEventListener("popstate", onPopState)
    }
  }, [location.pathname])

  const handleUserExitFromBackGuard = async () => {
    setShowExitDialog(false)
    const exitedNativeApp = await tryExitNativeApp()
    if (exitedNativeApp) return
    allowNextBackRef.current = true
    window.history.back()
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] dark:bg-[#0a0a0a] transition-colors duration-200">
      <UserLocationProvider>
        <CartProvider>
          <CartConflictModal />
          <ProfileProvider>
            <OrdersProvider>
              <SearchOverlayProvider>
                <LocationSelectorProvider>
                  {/* <Navbar /> */}
                  {showBottomNav && <DesktopNavbar />}
                  {/* Spacer for fixed desktop navbar */}
                  {showNav && <div className="hidden md:block h-16" />}
                  <LocationPrompt />
                  <UserGlobalDiningBookingListener />
                  <Outlet />
                  {showBottomNav && <BottomNavigation />}
                </LocationSelectorProvider>
              </SearchOverlayProvider>
            </OrdersProvider>
          </ProfileProvider>
        </CartProvider>
      </UserLocationProvider>

      <AnimatePresence>
        {showExitDialog && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9998] bg-black/50"
              onClick={() => setShowExitDialog(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              className="fixed left-1/2 top-1/2 z-[9999] w-[92%] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white dark:bg-[#171717] p-6 border border-gray-200 dark:border-gray-800 shadow-xl"
            >
              <h3 className="text-center text-lg font-semibold text-black dark:text-white">
                Are you sure you want to exit?
              </h3>
              <div className="mt-5 flex flex-col gap-3">
                <Button
                  type="button"
                  className="w-full h-11 bg-[#E23744] hover:bg-[#d32f3d] text-white"
                  onClick={handleUserExitFromBackGuard}
                >
                  Exit
                </Button>
                <Button
                  type="button"
                  className="w-full h-11 bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-white"
                  onClick={() => setShowExitDialog(false)}
                >
                  Stay on Home
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
