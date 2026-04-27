import { useState, useEffect } from "react"
import { toast } from "sonner"
import api from "@/lib/api"
import { API_ENDPOINTS } from "@/lib/api/config"
import { Textarea } from "@/components/ui/textarea"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"

export default function TermsAndCondition() {
  const { role } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [termsData, setTermsData] = useState({
    title: 'Terms and Conditions',
    content: ''
  })

  // Available roles for Terms
  const roles = [
    { id: 'user', label: 'User' },
    { id: 'restaurant', label: 'Restaurant' },
    { id: 'delivery', label: 'Delivery' }
  ]

  useEffect(() => {
    if (!role) {
      navigate('/admin/pages-social-media/user/terms', { replace: true })
      return
    }
    fetchTermsData()
  }, [role])

  // Convert HTML to plain text
  const htmlToText = (html) => {
    if (!html) return ''
    
    let text = html
    
    // Replace paragraph breaks with newlines
    text = text.replace(/<p[^>]*>/gi, '').replace(/<\/p>/gi, '\n')
    text = text.replace(/<br\s*\/?>/gi, '\n')
    text = text.replace(/<div[^>]*>/gi, '').replace(/<\/div>/gi, '\n')
    
    // Remove all remaining HTML tags
    text = text.replace(/<[^>]*>/g, '')
    
    // Decode HTML entities
    text = text.replace(/&nbsp;/g, ' ')
    text = text.replace(/&amp;/g, '&')
    text = text.replace(/&lt;/g, '<')
    text = text.replace(/&gt;/g, '>')
    text = text.replace(/&quot;/g, '"')
    text = text.replace(/&#39;/g, "'")
    text = text.replace(/&apos;/g, "'")
    
    // Clean up multiple newlines (keep max 2 consecutive)
    text = text.replace(/\n{3,}/g, '\n\n')
    
    // Trim each line and remove empty lines at start/end
    text = text.split('\n').map(line => line.trim()).join('\n')
    
    return text.trim()
  }

  const fetchTermsData = async () => {
    try {
      setLoading(true)
      const url = API_ENDPOINTS.ADMIN.TERMS.replace(':role', role)
      const response = await api.get(url)
      if (response.data.success) {
        const content = response.data.data.content || ''
        const textContent = htmlToText(content)
        setTermsData({
          ...response.data.data,
          content: textContent
        })
      }
    } catch (error) {
      console.error('Error fetching terms data:', error)
      toast.error(`Failed to load terms and conditions for ${role}`)
      // Reset data if fetch fails
      setTermsData({
        title: 'Terms and Conditions',
        content: ''
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      // Convert plain text to HTML for storage
      const htmlContent = termsData.content.split('\n').map(line => {
        if (line.trim() === '') return '<p><br></p>'
        return `<p>${line}</p>`
      }).join('')
      
      const url = API_ENDPOINTS.ADMIN.TERMS.replace(':role', role)
      const response = await api.put(url, {
        title: termsData.title,
        content: htmlContent,
        role: role
      })
      if (response.data.success) {
        toast.success(`Terms and conditions for ${role} updated successfully`)
        const content = response.data.data.content || ''
        const textContent = htmlToText(content)
        setTermsData({
          ...response.data.data,
          content: textContent
        })
      }
    } catch (error) {
      console.error('Error saving terms:', error)
      toast.error(error.response?.data?.message || 'Failed to save terms and conditions')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 lg:p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff8100] mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Terms And Condition</h1>
          <p className="text-sm text-slate-600 mt-1">Manage your Terms and Conditions content</p>
        </div>

        {/* Role Tabs */}
        <div className="flex items-center gap-2 mb-6 bg-gray-100/50 p-1 rounded-xl w-fit">
          {roles.map((r) => (
            <button
              key={r.id}
              onClick={() => navigate(`/admin/pages-social-media/${r.id}/terms`)}
              className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
                role === r.id 
                  ? "bg-[#ff8100] text-white shadow-md" 
                  : "text-gray-600 hover:bg-gray-200"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Text Area */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 overflow-hidden"
        >
          <Textarea
            value={termsData.content}
            onChange={(e) => setTermsData(prev => ({ ...prev, content: e.target.value }))}
            placeholder={`Enter terms and conditions content for ${role}...`}
            className="min-h-[600px] w-full text-sm text-slate-700 leading-relaxed resize-y focus-visible:ring-1 focus-visible:ring-[#ff8100] border-0"
            dir="ltr"
            style={{
              direction: 'ltr',
              textAlign: 'left',
              unicodeBidi: 'bidi-override',
              width: '100%',
              maxWidth: '100%'
            }}
          />
        </motion.div>

        {/* Submit Button */}
        <div className="flex justify-end mt-6">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="px-8 py-3 bg-[#ff8100] text-white rounded-xl hover:bg-[#e67300] transition-all font-bold shadow-lg shadow-orange-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
