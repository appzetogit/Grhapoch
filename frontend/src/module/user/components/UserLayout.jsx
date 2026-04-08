import { Outlet, useLocation, useNavigate } from "react-router-dom"
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
import { clearModuleAuth, isModuleAuthenticated } from "@/lib/utils/auth"

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
  const navigate = useNavigate()
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)
  const homeGuardPushedRef = useRef(false)

  useEffect(() => {
    // Reset scroll to top whenever location changes (pathname, search, or hash)
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [location.pathname, location.search, location.hash])

  // Note: Authentication checks and redirects are handled by ProtectedRoute components
  // UserLayout should not interfere with authentication redirects

  // Show bottom navigation only on home page, dining page, under-250 page, and profile page
  const showBottomNav = location.pathname === "/" ||
    location.pathname === "/user" ||
    location.pathname === "/dining" ||
    location.pathname === "/user/dining" ||
    location.pathname === "/under-250" ||
    location.pathname === "/user/under-250" ||
    location.pathname === "/profile" ||
    location.pathname === "/user/profile" ||
    location.pathname.startsWith("/user/profile")

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
      // If location selector is open, let that overlay consume the back press.
      if (document.body?.getAttribute("data-location-selector-open") === "true") {
        return
      }
      setShowLogoutDialog(true)
      window.history.pushState({ userHomeGuard: true }, "", window.location.href)
    }

    window.addEventListener("popstate", onPopState)
    return () => {
      window.removeEventListener("popstate", onPopState)
    }
  }, [location.pathname])

  const handleUserLogoutFromBackGuard = () => {
    clearModuleAuth("user")
    setShowLogoutDialog(false)
    window.dispatchEvent(new Event("userAuthChanged"))
    navigate("/user/auth/sign-in", { replace: true })
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
                  {showBottomNav && <div className="hidden md:block h-16" />}
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
              className="fixed left-1/2 top-1/2 z-[9999] w-[92%] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white dark:bg-[#171717] p-6 border border-gray-200 dark:border-gray-800 shadow-xl"
            >
              <h3 className="text-center text-lg font-semibold text-black dark:text-white">
                Are you sure you want to log out?
              </h3>
              <div className="mt-5 flex flex-col gap-3">
                <Button
                  type="button"
                  className="w-full h-11 bg-[#E23744] hover:bg-[#d32f3d] text-white"
                  onClick={handleUserLogoutFromBackGuard}
                >
                  Logout
                </Button>
                <Button
                  type="button"
                  className="w-full h-11 bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-white"
                  onClick={() => setShowLogoutDialog(false)}
                >
                  Stay Logged In
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

