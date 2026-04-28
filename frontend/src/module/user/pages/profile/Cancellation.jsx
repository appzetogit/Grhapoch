import { useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"
import { ArrowLeft, XCircle, Loader2 } from "lucide-react"
import { motion } from "framer-motion"
import AnimatedPage from "../../components/AnimatedPage"
import api from "@/lib/api"
import { API_ENDPOINTS } from "@/lib/api/config"

export default function Cancellation() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [cancellationData, setCancellationData] = useState({
    title: 'Cancellation Policy',
    content: `
      <h2>1. Order Cancellation by User</h2>
      <p>You can cancel your order within 60 seconds of placement for a full refund. After this window, cancellation may not be possible as the restaurant begins preparation.</p>
      
      <h2>2. Cancellation by GrhaPoch or Restaurant</h2>
      <p>In rare cases, an order may be cancelled by us or the restaurant due to item unavailability, delivery issues, or other unforeseen circumstances. In such cases, a full refund will be processed immediately.</p>
      
      <h2>3. Refund for Cancelled Orders</h2>
      <p>Refunds for orders cancelled within the allowed window are processed to the original payment method or GrhaPoch Wallet.</p>
      
      <h2>4. Non-Cancellable Orders</h2>
      <p>Once an order is marked as 'Preparing' or 'Out for Delivery', it cannot be cancelled or refunded.</p>
      
      <h2>5. Repeated Cancellations</h2>
      <p>Frequent cancellations may result in account restrictions or additional verification steps for future orders.</p>
    `,
    updatedAt: new Date().toISOString()
  })

  useEffect(() => {
    fetchCancellationData()
  }, [])

  const fetchCancellationData = async () => {
    try {
      setLoading(true)
      const response = await api.get(API_ENDPOINTS.ADMIN.CANCELLATION_PUBLIC)
      if (response.data.success) {
        setCancellationData(response.data.data)
      }
    } catch (error) {
      console.error('Error fetching cancellation data:', error)
      // Fallback is set
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
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Cancellation Policy</h1>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white dark:bg-[#1a1a1a] rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden"
        >
          <div className="p-6 md:p-8 lg:p-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-2xl">
                <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
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
                prose-a:text-red-600 dark:prose-a:text-red-400
                prose-a:no-underline hover:prose-a:underline
                leading-relaxed"
              dangerouslySetInnerHTML={{ __html: cancellationData.content }}
            />

            <div className="mt-12 pt-8 border-t border-gray-100 dark:border-gray-800 text-center">
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Last updated: {new Date(cancellationData.updatedAt || cancellationData.updated_at || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatedPage>
  )
}
