import { useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"
import { ArrowLeft, Truck, Loader2 } from "lucide-react"
import { motion } from "framer-motion"
import AnimatedPage from "../../components/AnimatedPage"
import api from "@/lib/api"
import { API_ENDPOINTS } from "@/lib/api/config"

export default function Shipping() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [shippingData, setShippingData] = useState({
    title: 'Shipping Policy',
    content: `
      <h2>1. Delivery Areas</h2>
      <p>We deliver to selected areas within the city limits. You can check availability by entering your delivery address on the home screen.</p>
      
      <h2>2. Delivery Time</h2>
      <p>Estimated delivery times are provided at the time of order placement. While we strive to meet these estimates, actual delivery times may vary due to traffic, weather, or restaurant delays.</p>
      
      <h2>3. Delivery Charges</h2>
      <p>Delivery charges are calculated based on the distance between the restaurant and your delivery location, as well as prevailing demand.</p>
      
      <h2>4. Order Tracking</h2>
      <p>You can track the progress of your order in real-time through the 'Your Orders' section of the app.</p>
      
      <h2>5. Contactless Delivery</h2>
      <p>All our deliveries are contactless by default. Our delivery partners will leave your order at your doorstep or specified location.</p>
    `,
    updatedAt: new Date().toISOString()
  })

  useEffect(() => {
    fetchShippingData()
  }, [])

  const fetchShippingData = async () => {
    try {
      setLoading(true)
      const response = await api.get(API_ENDPOINTS.ADMIN.SHIPPING_PUBLIC)
      if (response.data.success) {
        setShippingData(response.data.data)
      }
    } catch (error) {
      console.error('Error fetching shipping data:', error)
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
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Shipping Policy</h1>
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
              <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-2xl">
                <Truck className="h-8 w-8 text-orange-600 dark:text-orange-400" />
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
                prose-a:text-orange-600 dark:prose-a:text-orange-400
                prose-a:no-underline hover:prose-a:underline
                leading-relaxed"
              dangerouslySetInnerHTML={{ __html: shippingData.content }}
            />

            <div className="mt-12 pt-8 border-t border-gray-100 dark:border-gray-800 text-center">
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Last updated: {new Date(shippingData.updatedAt || shippingData.updated_at || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatedPage>
  )
}
