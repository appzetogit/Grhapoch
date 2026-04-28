import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react"
import api from "@/lib/api"
import { API_ENDPOINTS } from "@/lib/api/config"

export default function CodeOfConduct() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({
    content: `
      <h2>1. Professionalism</h2>
      <p>Maintain a high standard of professionalism in all interactions with customers, restaurant staff, and GrhaPoch support. Polite and respectful communication is expected at all times.</p>
      
      <h2>2. Handling of Orders</h2>
      <p>Ensure that all orders are handled with care, kept in appropriate thermal bags, and delivered in the condition they were received from the restaurant.</p>
      
      <h2>3. Safety Guidelines</h2>
      <p>Adhere to all traffic rules and safety regulations. Do not use your phone while driving and ensure your vehicle is roadworthy.</p>
      
      <h2>4. Platform Integrity</h2>
      <p>Do not engage in fraudulent activities such as marking orders delivered without actually delivering them, or manipulating location data.</p>
      
      <h2>5. Customer Privacy</h2>
      <p>Respect customer privacy. Only use customer contact information for the purpose of the current delivery and do not store or share it.</p>
      
      <h2>6. Zero Tolerance</h2>
      <p>GrhaPoch has zero tolerance for harassment, discrimination, or abusive behavior. Violations will result in immediate termination of the partnership.</p>
    `,
    updatedAt: new Date().toISOString()
  })

  useEffect(() => {
    fetchConduct()
  }, [])

  const fetchConduct = async () => {
    try {
      setLoading(true)
      const url = API_ENDPOINTS.ADMIN.CODE_OF_CONDUCT_PUBLIC.replace(':role', 'delivery')
      const response = await api.get(url)
      if (response.data.success && response.data.data.content) {
        setData(response.data.data)
      }
    } catch (error) {
      console.error("Error fetching code of conduct:", error)
      // Fallback is set
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-gray-900" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Code of Conduct</h1>
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
                <p className="text-gray-500 text-sm font-medium">Loading code of conduct...</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-8">
                  <div className="bg-blue-50 p-3 rounded-2xl">
                    <ShieldCheck className="h-8 w-8 text-blue-600" />
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
