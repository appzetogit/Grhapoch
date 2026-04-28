import { Link, useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"
import { ArrowLeft, FileText, Loader2 } from "lucide-react"
import { motion } from "framer-motion"
import AnimatedPage from "../../components/AnimatedPage"
import { Button } from "@/components/ui/button"
import api from "@/lib/api"
import { API_ENDPOINTS } from "@/lib/api/config"

export default function Terms() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [termsData, setTermsData] = useState({
    title: 'Terms and Conditions',
    content: `
      <h2>1. Introduction</h2>
      <p>Welcome to GrhaPoch. By using our website and services, you agree to comply with and be bound by the following terms and conditions.</p>
      
      <h2>2. Service Usage</h2>
      <p>Our platform provides food delivery services from various restaurants. We act as an intermediary between customers and restaurants.</p>
      
      <h2>3. Account Responsibility</h2>
      <p>You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account.</p>
      
      <h2>4. Pricing and Payment</h2>
      <p>Prices for food items are set by restaurants. Delivery fees and other charges are clearly displayed before checkout. Payments are processed securely.</p>
      
      <h2>5. Order Cancellation</h2>
      <p>Orders can be cancelled according to our Cancellation Policy. Refund eligibility depends on the stage of order preparation and delivery.</p>
      
      <h2>6. Limitation of Liability</h2>
      <p>GrhaPoch is not liable for the quality of food prepared by restaurants or for delays caused by external factors.</p>
    `,
    updatedAt: new Date().toISOString()
  })

  useEffect(() => {
    fetchTermsData()
  }, [])

  const fetchTermsData = async () => {
    try {
      setLoading(true)
      const url = API_ENDPOINTS.ADMIN.TERMS_PUBLIC.replace(':role', 'user')
      const response = await api.get(url)
      if (response.data.success) {
        setTermsData(response.data.data)
      }
    } catch (error) {
      console.error('Error fetching terms data:', error)
      setTermsData({
        title: 'Terms and Conditions',
        content: '<p>Unable to load terms and conditions at the moment. Please try again later.</p>',
        updatedAt: new Date().toISOString()
      })
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
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Terms and Conditions</h1>
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
              <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-2xl">
                <FileText className="h-8 w-8 text-green-600 dark:text-green-400" />
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
                prose-a:text-green-600 dark:prose-a:text-green-400
                prose-a:no-underline hover:prose-a:underline
                leading-relaxed"
              dangerouslySetInnerHTML={{ __html: termsData.content }}
            />

            {/* Footer Note */}
            <div className="mt-12 pt-8 border-t border-gray-100 dark:border-gray-800 text-center">
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Last updated: {new Date(termsData.updatedAt || termsData.updated_at || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatedPage>
  )
}


