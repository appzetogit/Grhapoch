import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { orderAPI } from "@/lib/api"
import { ArrowLeft, FileText, Clock, CheckCircle, AlertCircle, XCircle } from "lucide-react"

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "rejected", label: "Rejected" },
]

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

export default function MyComplaints() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [complaints, setComplaints] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 })
  const [filters, setFilters] = useState({ status: "all", page: 1, limit: 20 })

  useEffect(() => {
    const fetchComplaints = async () => {
      try {
        setLoading(true)
        const params = {
          page: filters.page,
          limit: filters.limit,
        }
        if (filters.status && filters.status !== "all") params.status = filters.status

        const resp = await orderAPI.getUserComplaints(params)
        if (resp?.data?.success) {
          setComplaints(resp.data.data?.complaints || [])
          setPagination(resp.data.data?.pagination || pagination)
        } else {
          setComplaints([])
        }
      } catch (error) {
        console.error("Error fetching complaints:", error)
        toast.error(error?.response?.data?.message || "Failed to fetch complaints")
        setComplaints([])
      } finally {
        setLoading(false)
      }
    }

    fetchComplaints()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, filters.limit, filters.status])

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
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100 ml-3">My Complaints</h1>
      </div>

      {/* Filter */}
      <div className="mx-4 mt-4 bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-100 dark:border-gray-800 p-3">
        <div className="flex items-center gap-2 flex-wrap">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilters((prev) => ({ ...prev, status: opt.value, page: 1 }))}
              className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                filters.status === opt.value
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/20"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="mx-4 mt-4 space-y-3">
        {loading ? (
          <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-100 dark:border-gray-800 p-6 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading complaints...</p>
          </div>
        ) : complaints.length === 0 ? (
          <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-100 dark:border-gray-800 p-8 text-center">
            <FileText className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600 dark:text-gray-300">No complaints found</p>
            <button
              onClick={() => navigate("/user/orders")}
              className="mt-4 px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 text-sm"
            >
              Go to Orders
            </button>
          </div>
        ) : (
          complaints.map((c) => (
            <button
              key={c._id}
              onClick={() => navigate(`/user/complaints/${encodeURIComponent(c._id)}`)}
              className="w-full text-left bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-100 dark:border-gray-800 p-4 hover:bg-gray-50 dark:hover:bg-gray-900/20 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {getStatusIcon(c.status)}
                    <p className="font-semibold text-gray-900 dark:text-white truncate">{c.subject}</p>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
                    {c.restaurantName || c.restaurantId?.name || "Restaurant"} • Order #{c.orderNumber}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${getStatusBadge(c.status)}`}>
                  {String(c.status || "unknown").replace("_", " ")}
                </span>
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {c.createdAt ? new Date(c.createdAt).toLocaleString("en-IN") : "—"}
              </p>
            </button>
          ))
        )}
      </div>

      {/* Pagination */}
      {!loading && pagination?.pages > 1 && (
        <div className="mx-4 mt-5 flex items-center justify-between">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Page {pagination.page} of {pagination.pages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setFilters((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
              disabled={filters.page <= 1}
              className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setFilters((prev) => ({ ...prev, page: Math.min(pagination.pages, prev.page + 1) }))}
              disabled={filters.page >= pagination.pages}
              className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

