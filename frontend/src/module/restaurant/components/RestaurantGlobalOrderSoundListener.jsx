import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { restaurantAPI } from "@/lib/api";
import { API_BASE_URL } from "@/lib/api/config";

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

    const unlockAudio = () => {
      if (!audioRef.current) return;
      audioRef.current.play()
        .then(() => {
          if (!audioRef.current) return;
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          audioRef.current.volume = 1;
        })
        .catch(() => {
          // Keep volume safe even if warm-up play is blocked.
          if (!audioRef.current) return;
          audioRef.current.volume = 1;
          audioRef.current.currentTime = 0;
        });
    };

    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio);

    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
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

    const resolveRestaurantId = (restaurantObj) => {
      if (!restaurantObj) return null;
      return restaurantObj._id || restaurantObj.id || restaurantObj.restaurantId || null;
    };

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

        const { default: io } = await import('socket.io-client');

        // Keep Socket URL normalization aligned with restaurant notification hook,
        // otherwise malformed env URLs can silently break sound on non-order pages.
        let backendUrl = API_BASE_URL;
        try {
          const urlObj = new URL(backendUrl);
          const pathname = urlObj.pathname.replace(/^\/api\/?$/, '');
          backendUrl = `${urlObj.protocol}//${urlObj.hostname}${urlObj.port ? `:${urlObj.port}` : ''}${pathname}`;
        } catch (e) {
          backendUrl = backendUrl.replace(/\/api\/?$/, '');
          backendUrl = backendUrl.replace(/\/+$/, '');
          backendUrl = backendUrl.replace(/^(https?):\/+/gi, '$1://');
        }
        backendUrl = backendUrl.replace(/\/+$/, '');
        const socketUrl = `${backendUrl}/restaurant`;

        socket = io(socketUrl, {
          path: '/socket.io/',
          transports: ['polling'],
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: Infinity,
          timeout: 20000,
          auth: { token: token || undefined }
        });

        socket.on('connect', async () => {
          let joined = false;
          // First try local cache to avoid waiting on network before room join.
          try {
            const cached = localStorage.getItem('restaurant_user');
            if (cached) {
              const parsed = JSON.parse(cached);
              const cachedRestaurantId = resolveRestaurantId(parsed);
              if (cachedRestaurantId) {
                socket.emit('join-restaurant', cachedRestaurantId);
                joined = true;
              }
            }
          } catch (e) {}

          try {
            const res = await restaurantAPI.getCurrentRestaurant();
            const restaurantObj = res.data?.data?.restaurant || res.data?.restaurant || null;
            const restaurantId = resolveRestaurantId(restaurantObj);
            if (restaurantId) {
              socket.emit('join-restaurant', restaurantId);
              joined = true;
              setTimeout(() => {
                if (socket?.connected) {
                  socket.emit('join-restaurant', restaurantId);
                }
              }, 2000);
            }
          } catch (err) {}

          // Last fallback: emit with known route key if available from local storage.
          if (!joined) {
            const fallbackId = localStorage.getItem('restaurantId');
            if (fallbackId) {
              socket.emit('join-restaurant', fallbackId);
            }
          }
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

        // Backend also emits explicit sound event for restaurant notifications.
        // Listen to it so audio still works even if order payload event is delayed/missed.
        socket.on('play_notification_sound', () => {
          setHasNewOrders(true);
          audioRef.current?.play().catch(e => console.log("Socket audio play blocked", e));
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
