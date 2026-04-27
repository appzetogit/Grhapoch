import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { orderAPI } from "@/lib/api"
import {
  ArrowLeft,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  ExternalLink,
} from "lucide-react"

const getStatusBadge = (status) => {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800"
    case "in_progress":
      return "bg-blue-100 text-blue-800"
    case "resolved":
      return "bg-green-100 text-green-800"
    case "rejected":
      return "bg-red-100 text-red-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

const getStatusIcon = (status) => {
  switch (status) {
    case "pending":
      return <Clock className="w-4 h-4 text-yellow-600" />
    case "in_progress":
      return <AlertCircle className="w-4 h-4 text-blue-600" />
    case "resolved":
      return <CheckCircle className="w-4 h-4 text-green-600" />
    case "rejected":
      return <XCircle className="w-4 h-4 text-red-600" />
    default:
      return <FileText className="w-4 h-4 text-gray-600" />
  }
}

export default function ComplaintDetails() {
  const navigate = useNavigate()
  const { id } = useParams()

  const [loading, setLoading] = useState(true)
  const [complaint, setComplaint] = useState(null)

  useEffect(() => {
    const fetchDetails = async (isRefresh = false) => {
      if (!id) return
      try {
        if (!isRefresh) setLoading(true)
        const resp = await orderAPI.getComplaintDetails(id)
        const c = resp?.data?.data?.complaint || null
        if (!c) {
          if (!isRefresh) {
            toast.error("Complaint not found")
            navigate("/user/complaints", { replace: true })
          }
          return
        }
        setComplaint(c)
      } catch (error) {
        console.error("Error fetching complaint details:", error)
        if (!isRefresh) {
          toast.error(error?.response?.data?.message || "Failed to fetch complaint details")
          navigate("/user/complaints", { replace: true })
        }
      } finally {
        if (!isRefresh) setLoading(false)
      }
    }

    fetchDetails()

    // Auto-refresh complaint details every 10 seconds
    const interval = setInterval(() => {
      // Only poll if complaint is not finalized (resolved/rejected)
      if (complaint && !["resolved", "rejected"].includes(complaint.status)) {
        fetchDetails(true);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [id, navigate, complaint?.status])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] pb-24">
      {/* Header */}
      <div className="bg-white dark:bg-[#1a1a1a] p-4 flex items-center sticky top-0 z-20 shadow-sm border-b border-gray-100 dark:border-gray-800">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ArrowLeft className="w-6 h-6 text-gray-700 dark:text-gray-200" />
        </button>
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100 ml-3">Complaint Details</h1>
      </div>

      {loading ? (
        <div className="mx-4 mt-4 bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-100 dark:border-gray-800 p-6 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      ) : !complaint ? null : (
        <div className="mx-4 mt-4 space-y-4">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-100 dark:border-gray-800 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {getStatusIcon(complaint.status)}
                <span className={`text-xs px-2 py-1 rounded-full ${getStatusBadge(complaint.status)}`}>
                  {String(complaint.status || "unknown").replace("_", " ")}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {complaint.createdAt ? new Date(complaint.createdAt).toLocaleString("en-IN") : "—"}
              </p>
            </div>

            <div className="mt-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Subject</p>
              <p className="font-semibold text-gray-900 dark:text-white">{complaint.subject}</p>
            </div>
            <div className="mt-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Description</p>
              <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{complaint.description}</p>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-3 border border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400">Restaurant</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{complaint.restaurantName || complaint.restaurantId?.name || "Restaurant"}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                  {String(complaint.complaintType || "").replace("_", " ")}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-3 border border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400">Order</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">#{complaint.orderNumber}</p>
              </div>
            </div>
          </div>

          {(!!complaint.couponCode || !!complaint.refundId || (Number(complaint.refundAmount) > 0)) && (
            <div className="bg-purple-50 dark:bg-purple-900/10 rounded-xl border border-purple-100 dark:border-purple-900/30 p-4">
              <p className="text-xs font-semibold text-purple-700 dark:text-purple-300">Resolution</p>
              {complaint.couponCode && (
                <p className="text-sm text-purple-900 dark:text-purple-200 mt-1">
                  Coupon code: <span className="font-semibold">{complaint.couponCode}</span>
                </p>
              )}
              {complaint.refundId && (
                <p className="text-sm text-purple-900 dark:text-purple-200 mt-1">
                  Refund id: <span className="font-semibold">{complaint.refundId}</span>
                </p>
              )}
              {Number(complaint.refundAmount) > 0 && (
                <p className="text-sm text-purple-900 dark:text-purple-200 mt-1">
                  Amount: <span className="font-semibold">₹{Number(complaint.refundAmount)}</span>
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30 p-4">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">Restaurant Response</p>
              {complaint.restaurantDecision && (
                <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                  Decision: {String(complaint.restaurantDecision).toLowerCase()}
                </p>
              )}
              <p className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap">
                {complaint.restaurantResponse ? complaint.restaurantResponse : "—"}
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/10 rounded-xl border border-green-100 dark:border-green-900/30 p-4">
              <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-2">Admin Response</p>
              <p className="text-sm text-green-800 dark:text-green-200 whitespace-pre-wrap">
                {complaint.adminResponse ? complaint.adminResponse : "—"}
              </p>
            </div>
          </div>

          {Array.isArray(complaint.attachments) && complaint.attachments.length > 0 && (
            <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-100 dark:border-gray-800 p-4">
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Attachments</p>
              <div className="space-y-2">
                {complaint.attachments.map((att, idx) => (
                  <a
                    key={`${att?.url || idx}`}
                    href={att?.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300 hover:underline"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>{att?.type || "file"} {idx + 1}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

