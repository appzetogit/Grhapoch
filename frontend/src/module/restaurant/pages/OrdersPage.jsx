import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Lenis from "lenis";
import BottomNavbar from "../components/BottomNavbar";
import MenuOverlay from "../components/MenuOverlay";
import NewOrderNotification from "../components/NewOrderNotification";
import {
  Home,
  ShoppingBag,
  Store,
  Wallet,
  Menu,
  CheckCircle,
  Loader2,
  Clock as ClockIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { getTransactionsByType } from "../utils/walletState";
import { restaurantAPI } from "@/lib/api";

export default function OrdersPage() {
  const navigate = useNavigate();
  const [activeFilterTab, setActiveFilterTab] = useState("all");
  const [showMenu, setShowMenu] = useState(false);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newOrder, setNewOrder] = useState(null);
  const [restaurantData, setRestaurantData] = useState(null);

  const clearNewOrder = () => setNewOrder(null);

  // Receive new-order events from global restaurant sound listener
  useEffect(() => {
    const handleNewOrder = (event) => {
      if (event?.detail) {
        setNewOrder(event.detail);
      }
    };
    window.addEventListener('restaurant:new-order', handleNewOrder);
    return () => window.removeEventListener('restaurant:new-order', handleNewOrder);
  }, []);

  // Lenis smooth scrolling
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true
    });
    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
    return () => lenis.destroy();
  }, []);

  // Calculate summary cards from payment transactions
  const calculateSummaryCards = () => {
    const paymentTransactions = getTransactionsByType("payment");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thisWeek = new Date(today);
    thisWeek.setDate(today.getDate() - 7);
    const thisMonth = new Date(today);
    thisMonth.setMonth(today.getMonth() - 1);

    const parseDate = (dateString) => {
      try {
        const parts = dateString.split(' ');
        if (parts.length === 3) {
          const day = parseInt(parts[0]);
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const month = monthNames.indexOf(parts[1]);
          const year = parseInt(parts[2]);
          return new Date(year, month, day);
        }
      } catch (e) { return new Date(0); }
      return new Date(0);
    };

    let todayCount = 0;
    let weekCount = 0;
    let monthCount = 0;

    paymentTransactions.forEach((transaction) => {
      const transactionDate = parseDate(transaction.date);
      transactionDate.setHours(0, 0, 0, 0);
      if (transactionDate >= today) todayCount++;
      if (transactionDate >= thisWeek) weekCount++;
      if (transactionDate >= thisMonth) monthCount++;
    });

    return [
      { label: "Today", count: todayCount },
      { label: "This Week", count: weekCount },
      { label: "This Month", count: monthCount }
    ];
  };

  const summaryCards = calculateSummaryCards();

  // Fetch orders from API
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch restaurant data first to check activation status
        let currentRestaurant = restaurantData;
        if (!currentRestaurant) {
          try {
            const resRes = await restaurantAPI.getCurrentRestaurant();
            currentRestaurant = resRes?.data?.data?.restaurant || resRes?.data?.restaurant;
            setRestaurantData(currentRestaurant);
          } catch (e) {}
        }

        // If not active, don't fetch orders to avoid 401 errors
        if (currentRestaurant && !currentRestaurant.isActive) {
          setOrders([]);
          setLoading(false);
          return;
        }

        const response = await restaurantAPI.getOrders();

        if (response.data?.success && response.data.data?.orders) {
          const transformedOrders = response.data.data.orders.map((order) => {
            const createdAt = new Date(order.createdAt);
            const now = new Date();
            const diffMs = now - createdAt;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);

            let timeAgo = "";
            if (diffMins < 1) timeAgo = "Just now";
            else if (diffMins < 60) timeAgo = `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
            else if (diffHours < 24) timeAgo = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
            else if (diffDays < 7) timeAgo = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
            else {
              const weeks = Math.floor(diffDays / 7);
              timeAgo = `${weeks} week${weeks > 1 ? 's' : ''} ago`;
            }

            return {
              id: order.orderId || order._id,
              mongoId: order._id,
              items: order.items?.length || 0,
              timeAgo: timeAgo,
              deliveryType: order.deliveryFleet === 'standard' ? 'Home Delivery' : 'Express Delivery',
              amount: order.pricing?.total || 0,
              status: order.status || 'pending',
              createdAt: order.createdAt,
              customerName: order.userId?.name || 'Customer',
              customerPhone: order.userId?.phone || '',
              address: order.address
            };
          });
          setOrders(transformedOrders);
        } else {
          setOrders([]);
        }
      } catch (err) {
        if (err.response?.status !== 401) {
          console.error('Error fetching orders:', err);
          setError(err.response?.data?.message || 'Failed to fetch orders');
        }
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();

    const refreshInterval = setInterval(() => {
      if (!restaurantData || restaurantData.isActive) {
        fetchOrders();
      }
    }, 10000);

    return () => clearInterval(refreshInterval);
  }, [restaurantData?.isActive]);

  // Refresh orders when new order notification is received or cleared
  useEffect(() => {
    if (newOrder || !newOrder) {
      if (!restaurantData || restaurantData.isActive) {
        // Redundant trigger, fetchOrders will be called by interval or manually
      }
    }
  }, [newOrder]);

  const filterTabs = [
    { id: "all", label: "All", count: orders.length },
    { id: "pending", label: "Pending", count: orders.filter((o) => o.status === 'pending').length },
    { id: "confirmed", label: "Confirmed", count: orders.filter((o) => o.status === 'confirmed').length },
    { id: "preparing", label: "Preparing", count: orders.filter((o) => o.status === 'preparing').length },
    { id: "ready", label: "Ready", count: orders.filter((o) => o.status === 'ready').length },
    { id: "delivered", label: "Delivered", count: orders.filter((o) => o.status === 'delivered').length },
    { id: "cancelled", label: "Cancelled", count: orders.filter((o) => o.status === 'cancelled').length }
  ];

  const filteredOrders = orders.filter((order) => {
    if (activeFilterTab === 'all') return true;
    return order.status === activeFilterTab;
  });

  const getStatusBadgeColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending': 
      case 'confirmed': return "bg-yellow-100 text-yellow-700";
      case 'preparing': return "bg-blue-100 text-blue-700";
      case 'ready': return "bg-purple-100 text-purple-700";
      case 'out_for_delivery': return "bg-indigo-100 text-indigo-700";
      case 'delivered': return "bg-green-100 text-green-700";
      case 'cancelled': return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const formatStatus = (status) => {
    if (!status) return 'Unknown';
    return status.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <div className="min-h-screen bg-[#f6e9dc] overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 py-6 pb-24 md:pb-6">
        <div className="flex flex-col gap-4 mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 text-center md:text-left">
            Orders
          </h1>

          {/* Approval Pending Banner */}
          {restaurantData && !restaurantData.isActive && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-blue-600 rounded-2xl p-5 text-white shadow-xl relative overflow-hidden"
            >
              <div className="flex items-center gap-4 relative z-10">
                <div className="bg-white/20 p-3 rounded-full">
                  <ClockIcon className="w-8 h-8 text-white animate-pulse" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold mb-1">Approval Pending</h2>
                  <p className="text-white/80 text-sm leading-relaxed">
                    Aapka restaurant setup ho gaya hai! Admin abhi review kar raha hai. Approval ke baad hi aap orders receive kar payenge.
                  </p>
                </div>
              </div>
              <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-white/10 rounded-full blur-2xl" />
              <div className="absolute bottom-[-10%] left-[-5%] w-24 h-24 bg-white/5 rounded-full blur-xl" />
            </motion.div>
          )}
        </div>

        <div className="flex gap-4 mb-6 border-b border-gray-200">
          <div className="pb-3 px-2 text-sm md:text-base font-medium text-[#ff8100] relative">
            Regular Order
            <motion.div
              layoutId="activeMainTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ff8100]"
              transition={{ type: "spring", stiffness: 500, damping: 30 }} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
          {summaryCards.map((card, index) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}>
              <Card className="bg-white shadow-md border-0 overflow-hidden">
                <CardContent className="p-2 md:p-3 text-center flex flex-col justify-center min-h-[60px] md:min-h-[70px]">
                  <p className="text-gray-900 text-sm md:text-base font-bold mb-0.5">{card.count}</p>
                  <p className="text-gray-600 text-sm md:text-base font-medium">{card.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="mb-6 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
          <div className="flex gap-3 min-w-max md:flex-wrap md:min-w-0 relative">
            {filterTabs.map((tab, index) => (
              <motion.button
                key={tab.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveFilterTab(tab.id)}
                className={`relative z-10 flex-shrink-0 px-4 py-2 rounded-full text-sm md:text-base font-medium transition-colors ${
                  activeFilterTab === tab.id ? "text-white" : "bg-white text-gray-600 hover:bg-gray-100"
                }`}>
                {activeFilterTab === tab.id && (
                  <motion.div
                    layoutId="activeFilterTab"
                    className="absolute inset-0 bg-[#ff8100] rounded-full z-0"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }} />
                )}
                <span className="relative z-10">{tab.label} {tab.count}</span>
              </motion.button>
            ))}
          </div>
        </div>

        <div className="space-y-3 md:space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-16 h-16 text-gray-400 mx-auto mb-4 animate-spin" />
              <p className="text-gray-600 text-base md:text-lg">Loading orders...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600 text-base md:text-lg mb-2">Error: {error}</p>
              <button onClick={() => window.location.reload()} className="text-blue-600 hover:underline">Retry</button>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-base md:text-lg">No {activeFilterTab !== 'all' ? activeFilterTab : ''} orders found</p>
            </div>
          ) : (
            filteredOrders.map((order, index) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                whileHover={{ y: -4, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}>
                <Card className="bg-white shadow-sm border-0 hover:shadow-md cursor-pointer" onClick={() => navigate(`/restaurant/orders/${order.mongoId || order.id}`)}>
                  <CardContent className="p-3 md:p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <p className="text-gray-900 font-bold text-sm md:text-base mb-1">Order #{order.id}</p>
                        <p className="text-gray-500 text-xs md:text-sm mb-1.5">{order.items} Items • {order.customerName}</p>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 ${getStatusBadgeColor(order.status)} text-[10px] md:text-xs font-medium px-2 py-0.5 rounded-full`}>
                            <CheckCircle className="w-2.5 h-2.5" />
                            {formatStatus(order.status)}
                          </span>
                          <span className="text-gray-500 text-[10px] md:text-xs">{order.timeAgo}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                      <span className="text-blue-600 text-xs md:text-sm font-medium">{order.deliveryType}</span>
                      <p className="text-gray-900 font-bold text-sm md:text-base">₹{order.amount?.toFixed(2)}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>
      <BottomNavbar onMenuClick={() => setShowMenu(true)} />
      <MenuOverlay showMenu={showMenu} setShowMenu={setShowMenu} />
      <NewOrderNotification order={newOrder} onClose={clearNewOrder} onViewOrder={(order) => navigate(`/restaurant/orders/${order.orderMongoId || order.orderId}`)} />
    </div>
  );
}
