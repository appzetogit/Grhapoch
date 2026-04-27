import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import Lenis from "lenis"
import { ArrowLeft, Loader2 } from "lucide-react"
import BottomNavbar from "../components/BottomNavbar"
import MenuOverlay from "../components/MenuOverlay"
import api from "@/lib/api"
import { API_ENDPOINTS } from "@/lib/api/config"

export default function PrivacyPolicyPage() {
  const navigate = useNavigate()
  const [showMenu, setShowMenu] = useState(false)
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState("")

  useEffect(() => {
    fetchPrivacy()
    
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })

    function raf(time) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    requestAnimationFrame(raf)

    return () => {
      lenis.destroy()
    }
  }, [])

  const fetchPrivacy = async () => {
    try {
      setLoading(true)
      const url = API_ENDPOINTS.ADMIN.PRIVACY_PUBLIC.replace(':role', 'restaurant')
      const response = await api.get(url)
      if (response.data.success) {
        setContent(response.data.data.content || "")
      }
    } catch (error) {
      console.error("Error fetching privacy policy:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f6e9dc] overflow-x-hidden pb-24 md:pb-6">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Privacy Policy</h1>
      </div>

      {/* Content */}
      <div className="px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-8 h-8 text-[#ff8100] animate-spin" />
              <p className="text-gray-500 text-sm font-medium">Loading policy...</p>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Privacy Policy</h2>
              <div 
                className="legal-content"
                dangerouslySetInnerHTML={{ __html: content || "<p>No privacy policy available at the moment.</p>" }} 
              />
            </div>
          )}
        </motion.div>
      </div>

      {/* Bottom Navigation Bar */}
      <BottomNavbar onMenuClick={() => setShowMenu(true)} />

      {/* Menu Overlay */}
      <MenuOverlay showMenu={showMenu} setShowMenu={setShowMenu} />
      
      <style jsx>{`
        .legal-content :global(p) {
          margin-bottom: 1rem;
        }
        .legal-content :global(h1), 
        .legal-content :global(h2), 
        .legal-content :global(h3) {
          color: #111827;
          font-weight: 700;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
        }
      `}</style>
    </div>
  )
}
