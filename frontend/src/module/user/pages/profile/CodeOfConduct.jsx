import { useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"
import { ArrowLeft, ShieldCheck, Loader2 } from "lucide-react"
import { motion } from "framer-motion"
import AnimatedPage from "../../components/AnimatedPage"
import api from "@/lib/api"
import { API_ENDPOINTS } from "@/lib/api/config"

export default function CodeOfConduct() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [conductData, setConductData] = useState({
    title: 'Code of Conduct',
    content: `
      <h2>1. Respect for Others</h2>
      <p>Treat all members of the GrhaPoch community—including delivery partners, restaurant staff, and customer support—with kindness and respect. Harassment, discrimination, or abusive language will not be tolerated.</p>
      
      <h2>2. Fair Usage</h2>
      <p>Users must use the platform fairly. Creating multiple accounts to exploit promotions, providing false information, or attempting to manipulate the system is prohibited.</p>
      
      <h2>3. Safety First</h2>
      <p>Do not engage in any activity that compromises the safety of others. This includes providing unsafe delivery instructions or engaging in fraudulent transactions.</p>
      
      <h2>4. Feedback and Reviews</h2>
      <p>Provide honest and constructive feedback. Reviews should be based on actual experiences and must not contain offensive content or personal information.</p>
      
      <h2>5. Compliance with Laws</h2>
      <p>Users must comply with all local laws and regulations while using GrhaPoch services.</p>
      
      <h2>6. Account Integrity</h2>
      <p>You are responsible for all activity on your account. Keep your login credentials secure and do not share them with others.</p>
    `,
    updatedAt: new Date().toISOString()
  })

  useEffect(() => {
    fetchConductData()
  }, [])

  const fetchConductData = async () => {
    try {
      setLoading(true)
      const url = API_ENDPOINTS.ADMIN.CODE_OF_CONDUCT_PUBLIC.replace(':role', 'user')
      const response = await api.get(url)
      if (response.data.success) {
        setConductData(response.data.data)
      }
    } catch (error) {
      console.error('Error fetching code of conduct data:', error)
      // Fallback content is already set
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
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Code of Conduct</h1>
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
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-2xl">
                <ShieldCheck className="h-8 w-8 text-blue-600 dark:text-blue-400" />
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
              dangerouslySetInnerHTML={{ __html: conductData.content }}
            />

            <div className="mt-12 pt-8 border-t border-gray-100 dark:border-gray-800 text-center">
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Last updated: {new Date(conductData.updatedAt || conductData.updated_at || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatedPage>
  )
}
