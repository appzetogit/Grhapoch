import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { restaurantAPI } from "@/lib/api";

const POLL_INTERVAL = 15000; // 15 seconds fallback polling

import alertSound from "@/assets/audio/alert.mp3";

export default function RestaurantGlobalOrderSoundListener() {
  const location = useLocation();
  const audioRef = useRef(null);
  const [hasNewOrders, setHasNewOrders] = useState(false);
  const seenOrderIdsRef = useRef(new Set());
  const isFirstLoadRef = useRef(true);
  const isRestaurantRoute = location.pathname.startsWith("/restaurant");
  const excludeRoutes = ['/onboarding', '/login', '/signup', '/auth', '/forgot-password', '/welcome'];
  const isExcludedPath = excludeRoutes.some(route => location.pathname.includes(route));
  // OrdersMain on "/restaurant" already has its own looping audio popup logic.
  const shouldSkipBecauseOrdersMainHandles = location.pathname === "/restaurant";

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio(alertSound);
    audioRef.current.loop = true;
  }, []);

  // Socket and Polling listener
  useEffect(() => {
    if (!isRestaurantRoute || isExcludedPath || shouldSkipBecauseOrdersMainHandles) {
      setHasNewOrders(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      return undefined;
    }

    let socket = null;

    const fetchOrders = async () => {
      try {
        const response = await restaurantAPI.getOrders({ status: 'pending' });
        
        if (response.data?.success && response.data.data?.orders) {
          const orders = response.data.data.orders;
          const pendingOrders = orders.filter(o => o.status === 'pending');
          
          if (pendingOrders.length > 0) {
            let newlyDetected = false;
            pendingOrders.forEach(order => {
              const id = order.orderId || order._id;
              if (!seenOrderIdsRef.current.has(id)) {
                newlyDetected = true;
                seenOrderIdsRef.current.add(id);
                window.dispatchEvent(new CustomEvent('restaurant:new-order', { detail: order }));
              }
            });

            if (newlyDetected && !isFirstLoadRef.current) {
              setHasNewOrders(true);
              audioRef.current?.play().catch(e => console.log("Audio play blocked", e));
            }
          } else {
            setHasNewOrders(false);
            audioRef.current?.pause();
          }
          isFirstLoadRef.current = false;
        }
      } catch (error) {
        if (error.response?.status !== 401 && error.response?.status !== 403) {
          console.error("Order listener polling error:", error);
        }
      }
    };

    // Initialize Socket Connection
    const initSocket = async () => {
      try {
        const token = localStorage.getItem('restaurant_accessToken') || localStorage.getItem('accessToken');
        if (!token) {
          return;
        }

        const { default: io } = await import('socket.io-client');
        import('@/lib/api/config').then(({ API_BASE_URL }) => {
          const socketUrl = API_BASE_URL.replace(/\/api\/?$/, '') + '/restaurant';
          socket = io(socketUrl, {
            path: '/socket.io/',
            transports: ['polling', 'websocket'],
            auth: {
              token
            }
          });

          socket.on('connect', async () => {
            try {
              const res = await restaurantAPI.getCurrentRestaurant();
              const restaurantId = res.data?.data?.restaurant?._id;
              if (restaurantId) {
                socket.emit('join-restaurant', restaurantId);
              }
            } catch (err) {}
          });

          socket.on('new_order', (orderData) => {
            const id = orderData.orderId || orderData._id;
            if (!seenOrderIdsRef.current.has(id)) {
              seenOrderIdsRef.current.add(id);
              window.dispatchEvent(new CustomEvent('restaurant:new-order', { detail: orderData }));
              setHasNewOrders(true);
              audioRef.current?.play().catch(e => console.log("Socket audio play blocked", e));
            }
          });
        });
      } catch (err) {
        console.error("Socket initialization failed:", err);
      }
    };

    const interval = setInterval(fetchOrders, POLL_INTERVAL);
    fetchOrders(); // Initial polling check
    initSocket(); // Initialize real-time socket

    return () => {
      clearInterval(interval);
      if (socket) {
        socket.disconnect();
      }
    };
  }, [location.pathname, isRestaurantRoute, isExcludedPath, shouldSkipBecauseOrdersMainHandles]);

  const stopSound = () => {
    setHasNewOrders(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  if (!hasNewOrders) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] animate-bounce">
      <button 
        onClick={stopSound}
        className="bg-red-600 text-white px-6 py-3 rounded-full shadow-2xl font-bold flex items-center gap-2 hover:bg-red-700 transition-colors"
      >
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
        </span>
        New Order! Click to Stop Sound
      </button>
    </div>
  );
}
