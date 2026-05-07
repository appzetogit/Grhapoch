import { useState, useEffect } from "react"
import { toast } from "sonner"
import api from "@/lib/api"
import { API_ENDPOINTS } from "@/lib/api/config"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { motion } from "framer-motion"
import { Mail, Phone, Info, MessageSquare, Save } from "lucide-react"

export default function SupportPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [supportData, setSupportData] = useState({
    title: 'Support & FAQ',
    description: 'Welcome to support.',
    email: '',
    phone: '',
    footerText: 'Our Support Team is available 24/7 to assist you.'
  })

  useEffect(() => {
    fetchSupportData()
  }, [])

  const fetchSupportData = async () => {
    try {
      setLoading(true)
      const response = await api.get(API_ENDPOINTS.ADMIN.SUPPORT)
      if (response.data.success) {
        setSupportData(response.data.data)
      }
    } catch (error) {
      console.error('Error fetching support data:', error)
      toast.error("Failed to load support page data")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Basic validation
    if (!supportData.email || !supportData.phone) {
      toast.error("Email and Phone are required")
      return
    }

    try {
      setSaving(true)
      const response = await api.put(API_ENDPOINTS.ADMIN.SUPPORT, supportData)
      if (response.data.success) {
        toast.success("Support page updated successfully")
        setSupportData(response.data.data)
      }
    } catch (error) {
      console.error('Error saving support data:', error)
      toast.error(error.response?.data?.message || 'Failed to save support data')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 lg:p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff8100] mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading support data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-[#ff8100]" />
            Support Page Management
          </h1>
          <p className="text-sm text-slate-600 mt-1">Configure the support contact details shown to users</p>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Title */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Info className="w-4 h-4 text-slate-400" />
                  Page Title
                </label>
                <Input
                  value={supportData.title}
                  onChange={(e) => setSupportData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.Support & FAQ"
                  className="rounded-xl border-slate-200 focus:ring-[#ff8100]"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-slate-400" />
                  Welcome Message
                </label>
                <Input
                  value={supportData.description}
                  onChange={(e) => setSupportData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="e.g. Welcome to support."
                  className="rounded-xl border-slate-200 focus:ring-[#ff8100]"
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-400" />
                  Support Email
                </label>
                <Input
                  type="email"
                  value={supportData.email}
                  onChange={(e) => setSupportData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="support@example.com"
                  className="rounded-xl border-slate-200 focus:ring-[#ff8100]"
                  required
                />
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-slate-400" />
                  Support Phone
                </label>
                <Input
                  value={supportData.phone}
                  onChange={(e) => setSupportData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+91 0000000000"
                  className="rounded-xl border-slate-200 focus:ring-[#ff8100]"
                  required
                />
              </div>
            </div>

            {/* Footer Text */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Footer Note</label>
              <Textarea
                value={supportData.footerText}
                onChange={(e) => setSupportData(prev => ({ ...prev, footerText: e.target.value }))}
                placeholder="e.g. Our team is available 24/7..."
                className="rounded-xl border-slate-200 focus:ring-[#ff8100] min-h-[100px]"
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-8 py-3 bg-[#ff8100] text-white rounded-xl hover:bg-[#e67300] transition-all font-bold shadow-lg shadow-orange-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save Support Configuration
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>

        {/* Preview Section */}
        <div className="mt-12 opacity-60">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Preview (How it will look)</h2>
          <div className="bg-white rounded-2xl p-6 border border-dashed border-slate-300 pointer-events-none">
             <div className="flex items-center gap-4 mb-6">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                  <Info className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{supportData.title}</h3>
                  <p className="text-sm text-slate-500">{supportData.description}</p>
                </div>
             </div>
             
             <div className="space-y-4 mb-8">
                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl">
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-500">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Email Us</p>
                    <p className="text-sm font-semibold text-slate-700">{supportData.email || 'support@example.com'}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl">
                  <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center text-green-500">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Call Us</p>
                    <p className="text-sm font-semibold text-slate-700">{supportData.phone || '+91 0000000000'}</p>
                  </div>
                </div>
             </div>
             
             <p className="text-xs text-center text-slate-400">{supportData.footerText}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
