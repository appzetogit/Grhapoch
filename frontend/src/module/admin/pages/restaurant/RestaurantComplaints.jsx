import { useState, useEffect } from "react"
import { adminAPI } from "@/lib/api"
import { toast } from "sonner"
import { AlertCircle, CheckCircle, Clock, XCircle, FileText, ExternalLink } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'rejected', label: 'Rejected' },
]

const COMPLAINT_TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'food_quality', label: 'Food Quality' },
  { value: 'wrong_item', label: 'Wrong Item' },
  { value: 'missing_item', label: 'Missing Item' },
  { value: 'delivery_issue', label: 'Delivery Issue' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'service', label: 'Service' },
  { value: 'other', label: 'Other' },
]

const STATUS_VALUES = ['pending', 'in_progress', 'resolved', 'rejected']
const isMismatchType = (type) => type === 'wrong_item' || type === 'missing_item'

export default function RestaurantComplaints() {
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    in_progress: 0,
    resolved: 0,
    rejected: 0
  })
  const [filters, setFilters] = useState({
    status: 'all',
    complaintType: 'all',
    search: '',
    page: 1,
    limit: 50
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 1
  })

  const [manageOpen, setManageOpen] = useState(false)
  const [manageLoading, setManageLoading] = useState(false)
  const [manageSaving, setManageSaving] = useState(false)
  const [manageSavingNotes, setManageSavingNotes] = useState(false)
  const [manageSavingMismatch, setManageSavingMismatch] = useState(false)

  const [selectedComplaint, setSelectedComplaint] = useState(null)
  const [statusDraft, setStatusDraft] = useState('pending')
  const [adminResponseDraft, setAdminResponseDraft] = useState('')
  const [internalNotesDraft, setInternalNotesDraft] = useState('')

  const [mismatchActionDraft, setMismatchActionDraft] = useState('REFUND') // REFUND | COUPON | REJECT
  const [mismatchAmountDraft, setMismatchAmountDraft] = useState('') // INR (optional)

  useEffect(() => {
    fetchComplaints()
  }, [filters])

  const fetchComplaints = async () => {
    try {
      setLoading(true)
      const params = {
        page: filters.page,
        limit: filters.limit,
      }
      if (filters.status && filters.status !== 'all') params.status = filters.status
      if (filters.complaintType && filters.complaintType !== 'all') params.complaintType = filters.complaintType
      if (filters.search) params.search = filters.search

      const response = await adminAPI.getRestaurantComplaints(params)
      if (response?.data?.success) {
        setComplaints(response.data.data.complaints || [])
        setStats(response.data.data.stats || stats)
        setPagination(response.data.data.pagination || pagination)
      }
    } catch (error) {
      console.error('Error fetching complaints:', error)
      toast.error('Failed to fetch complaints')
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />
      case 'in_progress':
        return <AlertCircle className="w-4 h-4 text-blue-600" />
      case 'resolved':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-600" />
      default:
        return <FileText className="w-4 h-4 text-gray-600" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800'
      case 'resolved':
        return 'bg-green-100 text-green-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const openManage = async (complaintId) => {
    setManageOpen(true)
    setManageLoading(true)
    setSelectedComplaint(null)
    setStatusDraft('pending')
    setAdminResponseDraft('')
    setInternalNotesDraft('')
    setMismatchActionDraft('REFUND')
    setMismatchAmountDraft('')

    try {
      const response = await adminAPI.getRestaurantComplaintById(complaintId)
      const complaint = response?.data?.data?.complaint || null

      if (!complaint) {
        toast.error('Complaint not found')
        setManageOpen(false)
        return
      }

      setSelectedComplaint(complaint)
      setStatusDraft(STATUS_VALUES.includes(complaint.status) ? complaint.status : 'pending')
      setAdminResponseDraft(String(complaint.adminResponse || ''))
      setInternalNotesDraft(String(complaint.internalNotes || ''))

      if (isMismatchType(complaint.complaintType)) {
        setMismatchActionDraft('REFUND')
      } else {
        setMismatchActionDraft('REFUND')
      }
    } catch (error) {
      console.error('Error fetching complaint details:', error)
      toast.error('Failed to load complaint details')
      setManageOpen(false)
    } finally {
      setManageLoading(false)
    }
  }

  const closeManage = () => {
    if (manageSaving || manageSavingNotes || manageSavingMismatch) return
    setManageOpen(false)
    setSelectedComplaint(null)
  }

  const saveStatusAndResponse = async () => {
    if (!selectedComplaint?._id) return

    if (!STATUS_VALUES.includes(statusDraft)) {
      toast.error('Please select a valid status')
      return
    }

    try {
      setManageSaving(true)
      await adminAPI.updateRestaurantComplaintStatus(
        selectedComplaint._id,
        statusDraft,
        adminResponseDraft,
        internalNotesDraft
      )
      toast.success('Complaint updated')
      await fetchComplaints()
      await openManage(selectedComplaint._id)
    } catch (error) {
      console.error('Error updating complaint:', error)
      toast.error(error?.response?.data?.message || 'Failed to update complaint')
    } finally {
      setManageSaving(false)
    }
  }

  const saveInternalNotes = async () => {
    if (!selectedComplaint?._id) return

    try {
      setManageSavingNotes(true)
      await adminAPI.updateRestaurantComplaintNotes(selectedComplaint._id, internalNotesDraft)
      toast.success('Internal notes saved')
      await fetchComplaints()
      await openManage(selectedComplaint._id)
    } catch (error) {
      console.error('Error saving internal notes:', error)
      toast.error(error?.response?.data?.message || 'Failed to save internal notes')
    } finally {
      setManageSavingNotes(false)
    }
  }

  const runMismatchAction = async () => {
    if (!selectedComplaint?._id) return

    if (!isMismatchType(selectedComplaint.complaintType)) {
      toast.error('Mismatch actions apply only to wrong/missing item complaints')
      return
    }

    const normalized = String(mismatchActionDraft || '').toUpperCase().trim()
    if (!['REFUND', 'COUPON', 'REJECT'].includes(normalized)) {
      toast.error('Select a valid action')
      return
    }

    const alreadyProcessed = !!selectedComplaint.adminDecision
    if (alreadyProcessed) {
      toast.error('This complaint is already processed')
      return
    }

    const payload = {
      action: normalized,
      adminResponse: adminResponseDraft
    }

    if (normalized !== 'REJECT') {
      const raw = String(mismatchAmountDraft || '').trim()
      if (raw !== '') {
        const amount = Number(raw)
        if (!Number.isFinite(amount) || amount <= 0) {
          toast.error('Amount must be a positive number (INR)')
          return
        }
        payload.refundAmount = amount
      }
    }

    try {
      setManageSavingMismatch(true)
      await adminAPI.mismatchRestaurantComplaintAction(selectedComplaint._id, payload)
      toast.success('Action applied')
      await fetchComplaints()
      await openManage(selectedComplaint._id)
    } catch (error) {
      console.error('Error applying mismatch action:', error)
      toast.error(error?.response?.data?.message || 'Failed to apply action')
    } finally {
      setManageSavingMismatch(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Restaurant Complaints</h1>
        <p className="text-sm text-gray-500 mt-1">Manage and track customer complaints</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 border border-gray-200 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by order, customer, restaurant..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <Select value={filters.status || 'all'} onValueChange={(value) => setFilters({ ...filters, status: value, page: 1 })}>
            <SelectTrigger>
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.complaintType || 'all'} onValueChange={(value) => setFilters({ ...filters, complaintType: value, page: 1 })}>
            <SelectTrigger>
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              {COMPLAINT_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Complaints List */}
      <div className="bg-white rounded-lg border border-gray-200">
        {loading ? (
          <div className="p-12 text-center">
            <p className="text-gray-500">Loading complaints...</p>
          </div>
        ) : complaints.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No complaints found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {complaints.map((complaint) => (
              <div key={complaint._id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getStatusIcon(complaint.status)}
                      <h3 className="font-semibold text-gray-900">{complaint.subject}</h3>
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(complaint.status)}`}>
                        {String(complaint.status || 'unknown').replace('_', ' ')}
                      </span>
                      {isMismatchType(complaint.complaintType) && (
                        <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-800">
                          mismatch
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div>
                        <p className="text-xs text-gray-500">Order</p>
                        <p className="font-medium">#{complaint.orderNumber}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Customer</p>
                        <p className="font-medium">{complaint.customerName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Restaurant</p>
                        <p className="font-medium">{complaint.restaurantName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Type</p>
                        <p className="font-medium capitalize">{complaint.complaintType.replace('_', ' ')}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 ml-4">
                    <button
                      onClick={() => openManage(complaint._id)}
                      className="px-3 py-2 text-sm rounded-lg bg-gray-900 text-white hover:bg-gray-800"
                    >
                      Manage
                    </button>
                    {complaint.adminDecision && (
                      <span className="text-xs text-gray-500">
                        Admin: {String(complaint.adminDecision).toLowerCase()}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-700 mb-3">{complaint.description}</p>
                {complaint.restaurantResponse && (
                  <div className="bg-blue-50 rounded p-3 mb-3">
                    <p className="text-xs font-semibold text-blue-700 mb-1">Restaurant Response:</p>
                    <p className="text-sm text-blue-800">{complaint.restaurantResponse}</p>
                  </div>
                )}
                {complaint.adminResponse && (
                  <div className="bg-green-50 rounded p-3 mb-3">
                    <p className="text-xs font-semibold text-green-700 mb-1">Admin Response:</p>
                    <p className="text-sm text-green-800">{complaint.adminResponse}</p>
                  </div>
                )}
                <p className="text-xs text-gray-400">
                  {new Date(complaint.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manage Modal */}
      {manageOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeManage}
          />
          <div className="relative w-full max-w-3xl bg-white rounded-xl shadow-xl border border-gray-200 max-h-[85vh] overflow-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Manage Complaint</h2>
                {selectedComplaint?.orderNumber && (
                  <p className="text-sm text-gray-500">Order #{selectedComplaint.orderNumber}</p>
                )}
              </div>
              <button
                onClick={closeManage}
                disabled={manageSaving || manageSavingNotes || manageSavingMismatch}
                className="px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
              >
                Close
              </button>
            </div>

            {manageLoading ? (
              <div className="p-6">
                <p className="text-gray-500">Loading details...</p>
              </div>
            ) : !selectedComplaint ? (
              <div className="p-6">
                <p className="text-gray-500">No complaint selected</p>
              </div>
            ) : (
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-xs text-gray-500">Customer</p>
                    <p className="font-medium text-gray-900">{selectedComplaint.customerName}</p>
                    <p className="text-sm text-gray-600">{selectedComplaint.customerPhone}</p>
                    {selectedComplaint.customerEmail && (
                      <p className="text-sm text-gray-600">{selectedComplaint.customerEmail}</p>
                    )}
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-xs text-gray-500">Restaurant</p>
                    <p className="font-medium text-gray-900">{selectedComplaint.restaurantName}</p>
                    <p className="text-sm text-gray-600 capitalize">{String(selectedComplaint.complaintType || '').replace('_', ' ')}</p>
                    {isMismatchType(selectedComplaint.complaintType) && selectedComplaint.requestedAction && (
                      <p className="text-sm text-gray-600">Requested: {String(selectedComplaint.requestedAction).toLowerCase()}</p>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(selectedComplaint.status)}
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(selectedComplaint.status)}`}>
                        {String(selectedComplaint.status || 'unknown').replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Created: {selectedComplaint.createdAt ? new Date(selectedComplaint.createdAt).toLocaleString('en-IN') : '—'}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Subject</p>
                    <p className="font-medium text-gray-900">{selectedComplaint.subject}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Description</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedComplaint.description}</p>
                  </div>

                  {Array.isArray(selectedComplaint.attachments) && selectedComplaint.attachments.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-2">Attachments</p>
                      <div className="flex flex-col gap-2">
                        {selectedComplaint.attachments.map((att, idx) => (
                          <a
                            key={`${att?.url || idx}`}
                            href={att?.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 text-sm text-blue-700 hover:underline"
                          >
                            <ExternalLink className="w-4 h-4" />
                            <span>{att?.type || 'file'} {idx + 1}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-100 space-y-2">
                    <p className="text-xs font-semibold text-blue-700">Restaurant Response</p>
                    {selectedComplaint.restaurantDecision && (
                      <p className="text-sm text-blue-800">
                        Decision: {String(selectedComplaint.restaurantDecision).toLowerCase()}
                      </p>
                    )}
                    <p className="text-sm text-blue-800 whitespace-pre-wrap">
                      {selectedComplaint.restaurantResponse ? selectedComplaint.restaurantResponse : '—'}
                    </p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 border border-green-100 space-y-3">
                    <p className="text-xs font-semibold text-green-700">Admin Response</p>
                    <textarea
                      value={adminResponseDraft}
                      onChange={(e) => setAdminResponseDraft(e.target.value)}
                      rows={5}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                      placeholder="Write a response to the user/restaurant (optional)"
                    />
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Status</p>
                      <select
                        value={statusDraft}
                        onChange={(e) => setStatusDraft(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>
                    <div className="md:col-span-2 flex gap-2 justify-end">
                      <button
                        onClick={saveStatusAndResponse}
                        disabled={manageSaving}
                        className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50"
                      >
                        Save Status/Response
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-500">Internal Notes (admin only)</p>
                      <button
                        onClick={saveInternalNotes}
                        disabled={manageSavingNotes}
                        className="px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Save Notes
                      </button>
                    </div>
                    <textarea
                      value={internalNotesDraft}
                      onChange={(e) => setInternalNotesDraft(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="Private notes for admin team"
                    />
                  </div>
                </div>

                {isMismatchType(selectedComplaint.complaintType) && (
                  <div className="bg-purple-50 rounded-lg border border-purple-100 p-4 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold text-purple-700">Mismatch Action (Admin Final Decision)</p>
                        <p className="text-sm text-purple-800">
                          {selectedComplaint.adminDecision
                            ? `Already processed: ${String(selectedComplaint.adminDecision).toLowerCase()}`
                            : 'Choose refund/coupon/reject'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Action</p>
                        <select
                          value={mismatchActionDraft}
                          onChange={(e) => setMismatchActionDraft(e.target.value)}
                          disabled={!!selectedComplaint.adminDecision}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50"
                        >
                          <option value="REFUND">Refund</option>
                          <option value="COUPON">Coupon</option>
                          <option value="REJECT">Reject</option>
                        </select>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Amount (INR, optional)</p>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={mismatchAmountDraft}
                          onChange={(e) => setMismatchAmountDraft(e.target.value)}
                          disabled={mismatchActionDraft === 'REJECT' || !!selectedComplaint.adminDecision}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50"
                          placeholder="Leave empty = full order total"
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={runMismatchAction}
                          disabled={manageSavingMismatch || !!selectedComplaint.adminDecision}
                          className="px-4 py-2 rounded-lg bg-purple-700 text-white hover:bg-purple-800 disabled:opacity-50"
                        >
                          Apply Action
                        </button>
                      </div>
                    </div>

                    {selectedComplaint.couponCode && (
                      <div className="text-sm text-purple-900">
                        Coupon code: <span className="font-semibold">{selectedComplaint.couponCode}</span>
                      </div>
                    )}
                    {selectedComplaint.refundId && (
                      <div className="text-sm text-purple-900">
                        Refund id: <span className="font-semibold">{selectedComplaint.refundId}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} complaints
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
              disabled={filters.page === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
              disabled={filters.page >= pagination.pages}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
