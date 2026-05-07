import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, Bell, CheckCircle2, Clock, Tag, Gift, AlertCircle, Loader2 } from "lucide-react"
import AnimatedPage from "../components/AnimatedPage"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { notificationAPI } from "@/lib/api"
import { formatDistanceToNow } from "date-fns"

export default function Notifications() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setLoading(true)
        const response = await notificationAPI.getActiveNotifications()
        if (response.data.success) {
          setNotifications(response.data.data)
        }
      } catch (error) {
        console.error("Error fetching notifications:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchNotifications()
  }, [])

  const unreadCount = notifications.length // Assuming all fetched are "new" for now as we don't have read status in DB yet

  const getIcon = (type) => {
    switch (type) {
      case 'order': return CheckCircle2;
      case 'offer': return Tag;
      case 'promotion': return Gift;
      default: return AlertCircle;
    }
  }

  const getIconColor = (type) => {
    switch (type) {
      case 'order': return "text-green-600";
      case 'offer': return "text-red-600";
      case 'promotion': return "text-blue-600";
      default: return "text-orange-600";
    }
  }

  const getIconBg = (type) => {
    switch (type) {
      case 'order': return "bg-green-100 dark:bg-green-900/40";
      case 'offer': return "bg-red-100 dark:bg-red-900/40";
      case 'promotion': return "bg-blue-100 dark:bg-blue-900/40";
      default: return "bg-orange-100 dark:bg-orange-900/40";
    }
  }

  return (
    <AnimatedPage className="min-h-screen bg-white dark:bg-[#0a0a0a]">
      <div className="max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        {/* Header */}
        <div className="flex items-center gap-3 sm:gap-4 mb-4 md:mb-6 lg:mb-8">
          <Link to="/user">
            <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 sm:h-10 sm:w-10">
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3 flex-1">
            <Bell className="h-5 w-5 sm:h-6 sm:w-6 text-red-600 fill-red-600" />
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-gray-800 dark:text-white">Notifications</h1>
            {unreadCount > 0 && (
              <Badge className="bg-red-600 text-white text-xs md:text-sm">
                {unreadCount}
              </Badge>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="space-y-3 md:space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-10 w-10 text-red-600 animate-spin mb-4" />
              <p className="text-gray-500">Loading your notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12 md:py-16 lg:py-20">
              <Bell className="h-16 w-16 md:h-20 md:w-20 lg:h-24 lg:w-24 text-gray-300 dark:text-gray-600 mx-auto mb-4 md:mb-5 lg:mb-6" />
              <h3 className="text-lg md:text-xl lg:text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-2 md:mb-3">No notifications</h3>
              <p className="text-sm md:text-base text-gray-500 dark:text-gray-400">You're all caught up!</p>
            </div>
          ) : (
            notifications.map((notification) => {
              const Icon = getIcon(notification.type || 'promotion')
              return (
                <Card
                  key={notification._id}
                  className="relative cursor-pointer transition-all duration-200 py-1 hover:shadow-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                >
                  <CardContent className="p-3 md:p-4 lg:p-5">
                    <div className="flex items-start gap-3 sm:gap-4 md:gap-5">
                      {/* Icon */}
                      <div className={`flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center ${getIconBg(notification.type || 'promotion')}`}>
                        <Icon className={`h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 ${getIconColor(notification.type || 'promotion')}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <h3 className="text-sm sm:text-base md:text-lg font-bold text-gray-900 dark:text-white">
                            {notification.title}
                          </h3>
                        </div>
                        <p className="text-xs sm:text-sm md:text-base text-gray-600 dark:text-gray-400 mb-2 md:mb-3">
                          {notification.description}
                        </p>
                        {notification.banner && (
                          <div className="mb-3 rounded-lg overflow-hidden max-w-sm border border-gray-100">
                             <img src={notification.banner} alt="Notification Banner" className="w-full h-auto object-cover" />
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-xs md:text-sm text-gray-500 dark:text-gray-400">
                          <Clock className="h-3 w-3 md:h-4 md:w-4" />
                          <span>{formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </div>
    </AnimatedPage>
  )
}

