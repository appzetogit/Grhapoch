import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, CalendarDays, Clock, Users, Building2 } from "lucide-react"
import AnimatedPage from "../../components/AnimatedPage"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { diningAPI } from "@/lib/api"
import { mergeDiningBookings, normalizeDiningBooking, readDiningBookings, writeDiningBookings } from "../../utils/diningBookings"

export default function DiningBookings() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [cancellingId, setCancellingId] = useState(null)

  const syncBookings = useCallback(async () => {
    const cachedBookings = readDiningBookings()
    if (cachedBookings.length > 0) {
      setBookings(cachedBookings)
    }

    const hasUserToken = !!(localStorage.getItem("user_accessToken") || localStorage.getItem("accessToken"))
    if (!hasUserToken) {
      setLoading(false)
      return
    }

    try {
      const response = await diningAPI.getMyBookings()
      if (response.data?.success) {
        const apiBookings = Array.isArray(response.data.data) ? response.data.data : []
        const normalizedApiBookings = apiBookings.map((booking) => normalizeDiningBooking(booking))
        const mergedBookings = mergeDiningBookings(cachedBookings, normalizedApiBookings)
        setBookings(mergedBookings)
        writeDiningBookings(mergedBookings)
      }
    } catch {
      // Keep cached data when API fails.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    syncBookings()

    const onDiningBookingsUpdated = () => {
      syncBookings()
    }

    window.addEventListener("diningBookingsUpdated", onDiningBookingsUpdated)
    return () => {
      window.removeEventListener("diningBookingsUpdated", onDiningBookingsUpdated)
    }
  }, [syncBookings])

  const sortedBookings = useMemo(() => {
    return [...bookings].sort((a, b) => {
      const aTime = new Date(a.createdAt || a.updatedAt || 0).getTime()
      const bTime = new Date(b.createdAt || b.updatedAt || 0).getTime()
      return bTime - aTime
    })
  }, [bookings])

  const getStatusBadgeClass = (status) => {
    const normalized = String(status || "").toLowerCase()
    if (normalized === "confirmed" || normalized === "completed") return "bg-emerald-100 text-emerald-700"
    if (normalized === "pending") return "bg-amber-100 text-amber-700"
    if (normalized === "rejected") return "bg-red-100 text-red-700"
    if (normalized === "cancelled") return "bg-gray-100 text-gray-700"
    return "bg-blue-100 text-blue-700"
  }

  const canCancelBooking = (booking) => {
    const status = String(booking?.bookingStatus || "").toLowerCase()
    return status === "pending" || status === "confirmed"
  }

  const handleViewDetails = async (booking) => {
    const bookingId = booking?.id || booking?._id
    if (!bookingId) return
    setDetailsLoading(true)
    try {
      const response = await diningAPI.getMyBookingById(bookingId)
      if (response.data?.success && response.data?.data) {
        setSelectedBooking(normalizeDiningBooking(response.data.data))
      } else {
        setSelectedBooking(normalizeDiningBooking(booking))
      }
    } catch {
      setSelectedBooking(normalizeDiningBooking(booking))
    } finally {
      setDetailsLoading(false)
    }
  }

  const handleCancelBooking = async (booking) => {
    if (!canCancelBooking(booking)) return
    const bookingId = booking?.id || booking?._id
    if (!bookingId) return
    setCancellingId(bookingId)
    try {
      const response = await diningAPI.cancelMyBooking(bookingId)
      if (response.data?.success && response.data?.data) {
        const updatedBooking = normalizeDiningBooking(response.data.data)
        const merged = mergeDiningBookings(bookings, [updatedBooking])
        setBookings(merged)
        writeDiningBookings(merged)
        window.dispatchEvent(new Event("diningBookingsUpdated"))
      } else {
        syncBookings()
      }
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <AnimatedPage className="min-h-screen bg-[#f5f5f5] dark:bg-[#0a0a0a]">
      <div className="max-w-md mx-auto px-4 py-4">
        <div className="mb-4 flex items-center gap-2">
          <Link to="/user/profile">
            <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
              <ArrowLeft className="h-5 w-5 text-black dark:text-white" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Dining Bookings</h1>
        </div>

        {loading ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <p className="text-sm font-medium text-gray-500">Loading bookings...</p>
            </CardContent>
          </Card>
        ) : sortedBookings.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6 text-center">
              <CalendarDays className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-600">No dining bookings found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {sortedBookings.map((booking) => {
              return (
                <Card key={booking._id || booking.id} className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                          {booking.restaurantName || "Restaurant"}
                        </p>
                        <div className="mt-2 space-y-1.5">
                          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                            <CalendarDays className="h-3.5 w-3.5" />
                            <span>{booking.date || "-"}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{booking.time || "-"}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                            <Users className="h-3.5 w-3.5" />
                            <span>{booking.guests || 0} Guests</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                            <Building2 className="h-3.5 w-3.5" />
                            <span>Table {booking.tableNumber || "-"}</span>
                          </div>
                        </div>
                      </div>
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${getStatusBadgeClass(booking.bookingStatus)}`}>
                        {booking.bookingStatus || "Pending"}
                      </span>
                    </div>
                    <div className="mt-4 pt-3 border-t border-gray-100 flex gap-2">
                      <Button
                        onClick={() => handleViewDetails(booking)}
                        disabled={detailsLoading}
                        className="flex-1 h-9 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                      >
                        {detailsLoading ? "Loading..." : "View Details"}
                      </Button>
                      <Button
                        onClick={() => handleCancelBooking(booking)}
                        disabled={!canCancelBooking(booking) || cancellingId === (booking.id || booking._id)}
                        className="flex-1 h-9 bg-white border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-50"
                      >
                        {cancellingId === (booking.id || booking._id) ? "Cancelling..." : "Cancel Booking"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
      <Dialog open={Boolean(selectedBooking)} onOpenChange={(open) => { if (!open) setSelectedBooking(null) }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-3 border-b border-gray-100 pr-12">
            <DialogTitle className="text-lg">Booking Details</DialogTitle>
            <DialogDescription className="truncate">{selectedBooking?.restaurantName || "Restaurant"}</DialogDescription>
          </DialogHeader>
          {selectedBooking && (
            <div className="px-4 py-3 space-y-2.5 text-sm max-h-[60vh] overflow-y-auto">
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Status</span>
                <span className={`font-semibold px-2 py-0.5 rounded-full ${getStatusBadgeClass(selectedBooking.bookingStatus)}`}>
                  {selectedBooking.bookingStatus || "Pending"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3"><span className="text-gray-500">Date</span><span className="font-semibold text-right">{selectedBooking.date || "-"}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-gray-500">Time</span><span className="font-semibold text-right">{selectedBooking.time || "-"}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-gray-500">Guests</span><span className="font-semibold text-right">{selectedBooking.guests || 0}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-gray-500">Table</span><span className="font-semibold text-right">{selectedBooking.tableNumber || "-"}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-gray-500">Guest Name</span><span className="font-semibold text-right">{selectedBooking.guestName || "-"}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-gray-500">Phone</span><span className="font-semibold text-right break-all">{selectedBooking.guestPhone || "-"}</span></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AnimatedPage>
  )
}
