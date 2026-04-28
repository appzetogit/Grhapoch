import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Loader2, FileText } from "lucide-react"
import api from "@/lib/api"
import { API_ENDPOINTS } from "@/lib/api/config"

export default function TermsAndConditions() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({
    title: 'Terms and Conditions',
    content: `
      <h2>1. Delivery Partner Relationship</h2>
      <p>As a delivery partner, you are an independent contractor and not an employee of GrhaPoch. You have the flexibility to choose when and where you want to provide delivery services.</p>
      
      <h2>2. Service Standards</h2>
      <p>You agree to provide professional delivery services, ensuring that items are handled with care and delivered promptly to the customer. Maintaining a high level of professionalism is key to the success of our platform.</p>
      
      <h2>3. Safety and Compliance</h2>
      <p>You must follow all local traffic laws and safety regulations while performing deliveries. Using appropriate safety gear (e.g., helmets) is mandatory.</p>
      
      <h2>4. Payments and Earnings</h2>
      <p>Earnings are calculated based on completed deliveries, distance, and prevailing incentives. Payments are processed regularly to your registered bank account or GrhaPoch wallet.</p>
      
      <h2>5. Equipment and Maintenance</h2>
      <p>You are responsible for maintaining your vehicle and smartphone in good working condition to ensure uninterrupted service.</p>
      
      <h2>6. Termination</h2>
      <p>GrhaPoch reserves the right to terminate the relationship if there are repeated violations of service standards or fraudulent activities.</p>
    `,
    updatedAt: new Date().toISOString()
  })

  useEffect(() => {
    fetchTerms()
  }, [])

  const fetchTerms = async () => {
    try {
      setLoading(true)
      const url = API_ENDPOINTS.ADMIN.TERMS_PUBLIC.replace(':role', 'delivery')
      const response = await api.get(url)
      if (response.data.success && response.data.data.content) {
        setData(response.data.data)
      }
    } catch (error) {
      console.error("Error fetching terms:", error)
      // Fallback content is already set
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
        <h1 className="text-xl font-bold text-gray-900">Terms and Conditions</h1>
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
                <p className="text-gray-500 text-sm font-medium">Loading terms...</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-8">
                  <div className="bg-green-50 p-3 rounded-2xl">
                    <FileText className="h-8 w-8 text-green-600" />
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
