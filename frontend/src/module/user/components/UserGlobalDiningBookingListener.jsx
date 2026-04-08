import { useEffect, useMemo, useRef } from "react";
import io from "socket.io-client";
import { API_BASE_URL } from "@/lib/api/config";

const buildSocketBaseUrl = () => {
  try {
    const parsed = new URL(API_BASE_URL);
    return `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}`;
  } catch {
    return String(API_BASE_URL || "").replace(/\/api\/?$/, "").replace(/\/+$/, "");
  }
};

const getUserIdFromStorage = () => {
  try {
    const raw = localStorage.getItem("user_user");
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    return String(parsed?._id || parsed?.id || "");
  } catch {
    return "";
  }
};

export default function UserGlobalDiningBookingListener() {
  const socketRef = useRef(null);
  const socketBaseUrl = useMemo(() => buildSocketBaseUrl(), []);

  useEffect(() => {
    const userId = getUserIdFromStorage();
    const userToken = localStorage.getItem("user_accessToken") || localStorage.getItem("accessToken");
    if (!userId || !userToken || !socketBaseUrl) return;

    socketRef.current = io(socketBaseUrl, {
      path: "/socket.io/",
      transports: ["polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      auth: {
        token: userToken
      }
    });

    socketRef.current.on("connect", () => {
      socketRef.current?.emit("join-user", userId);
    });

    socketRef.current.on("dining_booking_status_update", () => {
      window.dispatchEvent(new Event("diningBookingsUpdated"));
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [socketBaseUrl]);

  return null;
}

