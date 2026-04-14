import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { restaurantAPI } from "@/lib/api";

const POLL_INTERVAL = 15000; // 15 seconds fallback polling

export default function RestaurantGlobalOrderSoundListener() {
  const location = useLocation();
  const audioRef = useRef(null);
  const [hasNewOrders, setHasNewOrders] = useState(false);
  const seenOrderIdsRef = useRef(new Set());
  const isFirstLoadRef = useRef(true);

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio("/sounds/new_order_sound.mp3");
    audioRef.current.loop = true;
  }, []);

  useEffect(() => {
    const fetchOrders = async () => {
      // Don't poll on restaurant profile or onboarding or to-hub routes to avoid 401 errors
      const excludeRoutes = ['/restaurant', '/onboarding', '/to-hub'];
      if (excludeRoutes.some(route => location.pathname.includes(route))) {
        return;
      }

      try {
        const response = await restaurantAPI.getOrders({ status: 'pending' });
        
        if (response.data?.success && response.data.data?.orders) {
          const orders = response.data.data.orders;
          const pendingOrders = orders.filter(o => o.status === 'pending');
          
          if (pendingOrders.length > 0) {
            // Check if there are any NEW pending orders we haven't seen
            let newlyDetected = false;
            pendingOrders.forEach(order => {
              const id = order.orderId || order._id;
              if (!seenOrderIdsRef.current.has(id)) {
                newlyDetected = true;
                seenOrderIdsRef.current.add(id);
                // Dispatch event for components to listen
                window.dispatchEvent(new CustomEvent('restaurant:new-order', { detail: order }));
              }
            });

            // If it's not the first load and we have new orders, play sound
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
        // Silently fail for 401/403 as it means restaurant is pending or logged out
        if (error.response?.status !== 401 && error.response?.status !== 403) {
          console.error("Order listener error:", error);
        }
      }
    };

    const interval = setInterval(fetchOrders, POLL_INTERVAL);
    fetchOrders(); // Initial check

    return () => clearInterval(interval);
  }, [location.pathname]);

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
