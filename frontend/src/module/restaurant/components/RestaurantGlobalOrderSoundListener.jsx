import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { restaurantAPI } from "@/lib/api";
import { useRestaurantNotifications } from "../hooks/useRestaurantNotifications";

export default function RestaurantGlobalOrderSoundListener() {
  const { isConnected, playNotificationSound } = useRestaurantNotifications({
    enableSound: true,
    emitWindowEvent: true
  });
  const location = useLocation();
  const seenConfirmedOrderIdsRef = useRef(new Set());

  // Fallback for routes other than /restaurant:
  // if socket misses updates, poll confirmed orders and play a sound for newly detected ones.
  useEffect(() => {
    if (location.pathname === "/restaurant") return;

    let isMounted = true;
    let intervalId = null;
    let isPolling = false;

    const hydrateSeenOrders = async () => {
      try {
        const response = await restaurantAPI.getOrders();
        const orders = response?.data?.data?.orders || [];
        const confirmed = orders.filter((o) => o.status === "confirmed");
        seenConfirmedOrderIdsRef.current = new Set(
          confirmed.map((o) => String(o.orderId || o._id)).filter(Boolean)
        );
      } catch {
        // Best-effort initialization only.
      }
    };

    const pollConfirmedOrders = async () => {
      if (!isMounted || isPolling) return;
      if (isConnected) return; // Socket is healthy, no need for fallback polling.

      try {
        isPolling = true;
        const response = await restaurantAPI.getOrders();
        const orders = response?.data?.data?.orders || [];
        const confirmed = orders.filter((o) => o.status === "confirmed");

        let hasNewConfirmedOrder = false;
        confirmed.forEach((order) => {
          const id = String(order.orderId || order._id || "");
          if (!id) return;
          if (!seenConfirmedOrderIdsRef.current.has(id)) {
            hasNewConfirmedOrder = true;
            seenConfirmedOrderIdsRef.current.add(id);
          }
        });

        if (hasNewConfirmedOrder) {
          playNotificationSound();
        }
      } catch {
        // Silent fallback; avoid noisy logs from periodic polling.
      } finally {
        isPolling = false;
      }
    };

    hydrateSeenOrders();
    intervalId = setInterval(pollConfirmedOrders, 8000);

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [location.pathname, isConnected, playNotificationSound]);

  return null;
}
