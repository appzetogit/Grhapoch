import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Loader2, Lock } from "lucide-react"
import api from "@/lib/api"
import { API_ENDPOINTS } from "@/lib/api/config"

export default function PrivacyPolicy() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({
    content: `
      <h2>1. Information We Collect</h2>
      <p>We collect information you provide during registration, including your name, contact details, vehicle information, and background check documents. We also collect real-time location data while you are on duty to facilitate efficient delivery assignments.</p>
      
      <h2>2. How We Use Your Information</h2>
      <p>Your information is used to manage your account, process payments, ensure platform safety, and optimize delivery routes. Location data is shared with customers so they can track their orders.</p>
      
      <h2>3. Data Protection</h2>
      <p>We implement robust security measures to protect your personal information from unauthorized access or disclosure. Your data is stored on secure servers.</p>
      
      <h2>4. Third-Party Sharing</h2>
      <p>We may share your information with service providers who help us with payment processing, background checks, and map services. We do not sell your personal data to third parties.</p>
      
      <h2>5. Your Rights</h2>
      <p>You have the right to access, update, or request the deletion of your personal data through your account settings or by contacting our support team.</p>
    `,
    updatedAt: new Date().toISOString()
  })

  useEffect(() => {
    fetchPrivacy()
  }, [])

  const fetchPrivacy = async () => {
    try {
      setLoading(true)
      const url = API_ENDPOINTS.ADMIN.PRIVACY_PUBLIC.replace(':role', 'delivery')
      const response = await api.get(url)
      if (response.data.success && response.data.data.content) {
        setData(response.data.data)
      }
    } catch (error) {
      console.error("Error fetching privacy policy:", error)
      // Fallback is set
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f6e9dc] overflow-x-hidden">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-gray-900" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Privacy Policy</h1>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden"
        >
          <div className="p-6 md:p-10">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-8 h-8 text-[#ff8100] animate-spin" />
                <p className="text-gray-500 text-sm font-medium">Loading privacy policy...</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-8">
                  <div className="bg-blue-50 p-3 rounded-2xl">
                    <Lock className="h-8 w-8 text-blue-600" />
                  </div>
                </div>

                <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
                  <div 
                    className="legal-content"
                    dangerouslySetInnerHTML={{ __html: data.content }} 
                  />
                </div>

                <div className="mt-12 pt-8 border-t border-gray-100 text-center">
                  <p className="text-sm text-gray-400">
                    Last updated: {new Date(data.updatedAt || data.updated_at || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
      
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
