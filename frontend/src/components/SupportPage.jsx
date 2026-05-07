import { useState, useEffect } from "react"
import api from "@/lib/api"
import { API_ENDPOINTS } from "@/lib/api/config"
import { motion } from "framer-motion"
import { Mail, Phone, Info, ChevronLeft, MessageCircle } from "lucide-react"
import { useNavigate } from "react-router-dom"

export default function PublicSupportPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [supportData, setSupportData] = useState(null)

  useEffect(() => {
    fetchSupportData()
  }, [])

  const fetchSupportData = async () => {
    try {
      setLoading(true)
      const response = await api.get(API_ENDPOINTS.ADMIN.SUPPORT_PUBLIC || '/support/public')
      if (response.data.success) {
        setSupportData(response.data.data)
      }
    } catch (error) {
      console.error('Error fetching support data:', error)
      // Fallback if API fails
      setSupportData({
        title: 'Support & FAQ',
        description: 'Welcome to support.',
        email: 'support@grhapoch.com',
        phone: '+91 0000000000',
        footerText: 'Our Support Team is available 24/7 to assist you.'
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff8100]"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-12 font-outfit">
      {/* Header Bar */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-100 p-4 flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors"
        >
          <ChevronLeft className="w-6 h-6 text-slate-700" />
        </button>
        <h1 className="text-xl font-bold text-slate-800 tracking-tight">Support Page</h1>
      </div>

      <div className="max-w-md mx-auto px-4 mt-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/60 overflow-hidden border border-slate-50"
        >
          {/* Hero Section */}
          <div className="p-8 pb-4">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shadow-inner">
                <MessageCircle className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 leading-tight">
                  {supportData?.title || 'Support & FAQ'}
                </h2>
                <p className="text-slate-500 font-medium">
                  {supportData?.description || 'Welcome to support.'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-50/50 p-8 pt-6">
            <h3 className="text-lg font-bold text-slate-900 mb-6 tracking-tight">Need immediate help?</h3>
            
            <div className="space-y-4">
              {/* Email Card */}
              <motion.a 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                href={`mailto:${supportData?.email}`}
                className="flex items-center gap-5 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm transition-all hover:shadow-md group"
              >
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 transition-colors group-hover:bg-indigo-100">
                  <Mail className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.15em] mb-1">Email Us</p>
                  <p className="text-base font-bold text-slate-700 break-all">{supportData?.email}</p>
                </div>
              </motion.a>

              {/* Call Card */}
              <motion.a 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                href={`tel:${supportData?.phone}`}
                className="flex items-center gap-5 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm transition-all hover:shadow-md group"
              >
                <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 transition-colors group-hover:bg-emerald-100">
                  <Phone className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.15em] mb-1">Call Us</p>
                  <p className="text-base font-bold text-slate-700">{supportData?.phone}</p>
                </div>
              </motion.a>
            </div>
          </div>

          {/* Footer Note */}
          <div className="p-8 pt-0">
             <div className="h-px bg-slate-100 w-full my-8" />
             <p className="text-center text-slate-400 text-xs font-medium leading-relaxed px-4">
               {supportData?.footerText || 'Maava Support Team is available 24/7 to assist you.'}
             </p>
          </div>
        </motion.div>
      </div>

      {/* Decorative background element */}
      <div className="fixed -bottom-24 -right-24 w-64 h-64 bg-[#ff8100]/5 rounded-full blur-3xl -z-10" />
      <div className="fixed -top-24 -left-24 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -z-10" />
    </div>
  )
}
