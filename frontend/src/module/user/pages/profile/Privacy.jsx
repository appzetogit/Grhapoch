import { useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"
import { ArrowLeft, Lock, Loader2 } from "lucide-react"
import { motion } from "framer-motion"
import AnimatedPage from "../../components/AnimatedPage"
import api from "@/lib/api"
import { API_ENDPOINTS } from "@/lib/api/config"

export default function Privacy() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [privacyData, setPrivacyData] = useState({
    title: 'Privacy Policy',
    content: `
      <h2>1. Information We Collect</h2>
      <p>We collect information you provide directly to us, such as your name, email address, phone number, and delivery address when you create an account or place an order.</p>
      
      <h2>2. How We Use Your Information</h2>
      <p>We use your information to process and deliver your orders, communicate with you about your account and promotions, and improve our services.</p>
      
      <h2>3. Information Sharing</h2>
      <p>We share your delivery details with our restaurant partners and delivery personnel to ensure your food reaches you. We do not sell your personal data to third parties.</p>
      
      <h2>4. Data Security</h2>
      <p>We implement industry-standard security measures to protect your personal information from unauthorized access, disclosure, or alteration.</p>
      
      <h2>5. Your Rights</h2>
      <p>You have the right to access, update, or delete your personal information through your account settings or by contacting our support team.</p>
      
      <h2>6. Cookies</h2>
      <p>We use cookies and similar technologies to enhance your browsing experience and provide personalized services.</p>
    `,
    updatedAt: new Date().toISOString()
  })

  useEffect(() => {
    fetchPrivacyData()
  }, [])

  const fetchPrivacyData = async () => {
    try {
      setLoading(true)
      const url = API_ENDPOINTS.ADMIN.PRIVACY_PUBLIC.replace(':role', 'user')
      const response = await api.get(url)
      if (response.data.success) {
        setPrivacyData(response.data.data)
      }
    } catch (error) {
      console.error('Error fetching privacy data:', error)
      // Fallback already set in initial state
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <AnimatedPage className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#ff8100] mx-auto mb-4" />
            <p className="text-gray-500">Loading...</p>
          </div>
        </div>
      </AnimatedPage>
    )
  }

  return (
    <AnimatedPage className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-gray-800 px-4 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-gray-900 dark:text-white" />
        </button>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Privacy Policy</h1>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white dark:bg-[#1a1a1a] rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden"
        >
          <div className="p-6 md:p-8 lg:p-10">
            {/* Icon and Title - Title removed to avoid duplication as per user request */}
            <div className="flex items-center gap-3 mb-8">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-2xl">
                <Lock className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
            </div>

            <div
              className="prose prose-slate dark:prose-invert max-w-none
                prose-headings:text-gray-900 dark:prose-headings:text-white
                prose-p:text-gray-700 dark:prose-p:text-gray-300
                prose-strong:text-gray-900 dark:prose-strong:text-white
                prose-ul:text-gray-700 dark:prose-ul:text-gray-300
                prose-ol:text-gray-700 dark:prose-ol:text-gray-300
                prose-li:text-gray-700 dark:prose-li:text-gray-300
                prose-a:text-blue-600 dark:prose-a:text-blue-400
                prose-a:no-underline hover:prose-a:underline
                leading-relaxed"
              dangerouslySetInnerHTML={{ __html: privacyData.content }}
            />

            {/* Footer Note */}
            <div className="mt-12 pt-8 border-t border-gray-100 dark:border-gray-800 text-center">
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Last updated: {new Date(privacyData.updatedAt || privacyData.updated_at || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatedPage>
  )
}
