import { useEffect, useState, useRef } from "react"
import { MapPin } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useLocation } from "../hooks/useLocation"
import { useLocationSelector } from "./UserLayout"

export default function LocationPrompt() {
  const { location, loading, permissionGranted, requestLocation } = useLocation()
  const { openLocationSelector } = useLocationSelector()
  const [showPrompt, setShowPrompt] = useState(false)
  const cardRef = useRef(null)

  useEffect(() => {
    // Check if location permission was already granted
    const storedLocation = localStorage.getItem("userLocation")
    const promptDismissed = localStorage.getItem("locationPromptDismissed")

    // The useLocation hook will automatically try to get location on app start
    // We only show the prompt if:
    // 1. No location is stored (first time user)
    // 2. Prompt hasn't been dismissed
    // 3. Location permission was denied (we'll detect this after a delay)
    
    if (!storedLocation && !promptDismissed) {
      // Wait a bit to let the hook try to get location automatically
      // If it fails, we'll show the prompt
      const timer = setTimeout(() => {
        // Check again if location was set (hook might have succeeded)
        const currentLocation = localStorage.getItem("userLocation")
        if (!currentLocation && !permissionGranted) {
          setShowPrompt(true)
          // Prevent body scroll when popup is open
          document.body.style.overflow = "hidden"
          // CSS animation will handle the fade-in
          if (cardRef.current) {
            cardRef.current.style.opacity = '0'
            cardRef.current.style.transform = 'translateY(20px)'
            requestAnimationFrame(() => {
              if (cardRef.current) {
                cardRef.current.style.opacity = '1'
                cardRef.current.style.transform = 'translateY(0)'
              }
            })
          }
        }
      }, 2000) // Wait 2 seconds for automatic location request to complete

      return () => {
        clearTimeout(timer)
        document.body.style.overflow = ""
      }
    }
  }, [permissionGranted])

  // Close prompt when location is successfully obtained
  useEffect(() => {
    if (location && showPrompt) {
      const timer = setTimeout(() => {
        setShowPrompt(false)
        document.body.style.overflow = ""
        localStorage.setItem("locationPromptDismissed", "true")
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [location, showPrompt])

  const handleAllow = async () => {
    await requestLocation()
    // Wait a bit for location to be set
    setTimeout(() => {
      setShowPrompt(false)
      document.body.style.overflow = ""
      localStorage.setItem("locationPromptDismissed", "true")
    }, 500)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    document.body.style.overflow = ""
    localStorage.setItem("locationPromptDismissed", "true")
  }

  const handleManualLocation = () => {
    setShowPrompt(false)
    document.body.style.overflow = ""
    localStorage.setItem("locationPromptDismissed", "true")
    openLocationSelector()
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.body.style.overflow = ""
    }
  }, [])

  if (!showPrompt) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Card
        ref={cardRef}
        className="w-full max-w-sm border border-gray-200 shadow-2xl mx-auto my-auto rounded-[2.5rem]"
      >
        <div className="px-6 pt-8 pb-7 text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-[#f5ecec] flex items-center justify-center mb-5">
            <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center">
              <MapPin className="h-5 w-5 text-[#B23B3B]" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Location Access Required</h2>
          <p className="mt-2 text-sm text-gray-500 leading-relaxed">
            We need your location to show you products available near you and enable delivery services. Location access is required to continue.
          </p>
          <div className="mt-6 space-y-3">
            <Button
              onClick={handleAllow}
              className="w-full h-12 text-base font-semibold bg-[#B23B3B] hover:bg-[#9f3434] text-white rounded-2xl"
              disabled={loading}
            >
              {loading ? "Getting location..." : "Allow Location Access"}
            </Button>
            <Button
              onClick={handleManualLocation}
              className="w-full h-12 text-base font-semibold bg-[#f2f4f7] hover:bg-[#e9edf2] text-gray-700 rounded-2xl"
              variant="ghost"
            >
              Enter Location Manually
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

