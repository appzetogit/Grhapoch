import { useEffect, useRef, useState, useCallback } from 'react';
import io from 'socket.io-client';
import { API_BASE_URL } from '@/lib/api/config';
import { deliveryAPI } from '@/lib/api';
const alertSound = "/assets/audio/alert.mp3";
const originalSound = "/assets/audio/original.mp3";

export const useDeliveryNotifications = () => {
  // Step 1: All refs first
  const socketRef = useRef(null);
  const audioRef = useRef(null);
  const pendingSoundRef = useRef(false);
  const suppressedSoundOrderIdsRef = useRef(new Set());
  const userInteractedRef = useRef(false);

  // Step 2: All state hooks
  const [newOrder, setNewOrder] = useState(null);
  const [orderReady, setOrderReady] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [deliveryPartnerId, setDeliveryPartnerId] = useState(null);
  const [rejectedOrderIds, setRejectedOrderIds] = useState(new Set());
  
  // NEW: track isOnline locally to control socket connection
  const [isOnline, setIsOnline] = useState(() => {
    try {
      const raw = localStorage.getItem('app:isOnline');
      return raw ? JSON.parse(raw) === true : false;
    } catch {
      return false;
    }
  });

  // Step 3: Callbacks
  const playNotificationSound = useCallback(() => {
    try {
      const selectedSound = localStorage.getItem('delivery_alert_sound') || 'zomato_tone';
      const soundFile = selectedSound === 'original' ? originalSound : alertSound;

      if (audioRef.current) {
        if (!audioRef.current.src.includes(soundFile.split('/').pop())) {
          audioRef.current.pause();
          audioRef.current.src = soundFile;
          audioRef.current.load();
        }
      } else {
        audioRef.current = new Audio(soundFile);
        audioRef.current.volume = 0.7;
      }

      if (audioRef.current) {
        if (!userInteractedRef.current && navigator?.userActivation?.hasBeenActive) {
          userInteractedRef.current = true;
        }
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch((error) => {
          if (error?.name?.includes('NotAllowedError')) {
            pendingSoundRef.current = true;
          }
        });
      }
    } catch (error) {}
  }, []);

  const stopNotificationSound = useCallback(() => {
    try {
      pendingSoundRef.current = false;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    } catch (error) {}
  }, []);

  // Sync isOnline with localStorage
  useEffect(() => {
    const handleSync = () => {
      try {
        const raw = localStorage.getItem('app:isOnline');
        const next = raw ? JSON.parse(raw) === true : false;
        setIsOnline(next);
        
        // CRITICAL: If going offline, clear any pending notifications immediately
        if (!next) {
          setNewOrder(null);
          setOrderReady(null);
          stopNotificationSound();
        }
      } catch {}
    };

    window.addEventListener('storage', handleSync);
    window.addEventListener('onlineStatusChanged', handleSync);
    
    // Polling as fallback
    const interval = setInterval(handleSync, 2000);

    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('onlineStatusChanged', handleSync);
      clearInterval(interval);
    };
  }, [stopNotificationSound]);

  // Fetch delivery partner ID
  useEffect(() => {
    const fetchId = async () => {
      try {
        const response = await deliveryAPI.getCurrentDelivery();
        if (response.data?.success && response.data.data) {
          const partner = response.data.data.user || response.data.data.deliveryPartner;
          const id = partner?.id || partner?._id || partner?.deliveryId;
          if (id) setDeliveryPartnerId(id);
        }
      } catch (error) {}
    };
    fetchId();
  }, []);

  // Socket connection effect - NOW DEPENDS ON isOnline
  useEffect(() => {
    if (!deliveryPartnerId || !isOnline) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    let backendUrl = API_BASE_URL.replace(/\/api\/?$/, '').replace(/\/+$/, '');
    backendUrl = backendUrl.replace(/^(https?):\/+/gi, '$1://');
    
    // Auto-fix localhost to current hostname if accessed via IP (useful for mobile testing)
    const currentHost = window.location.hostname;
    if (currentHost !== 'localhost' && currentHost !== '127.0.0.1' && (backendUrl.includes('localhost') || backendUrl.includes('127.0.0.1'))) {
      const url = new URL(backendUrl);
      url.hostname = currentHost;
      backendUrl = url.origin;
    }

    const socketUrl = `${backendUrl}/delivery`;

    socketRef.current = io(socketUrl, {
      path: '/socket.io/',
      transports: ['polling', 'websocket'], // Allow upgrade to websocket
      reconnection: true,
      auth: {
        token: localStorage.getItem('delivery_accessToken') || localStorage.getItem('accessToken')
      }
    });

    socketRef.current.on('connect', () => {
      setIsConnected(true);
      socketRef.current.emit('join-delivery', deliveryPartnerId);
    });

    socketRef.current.on('disconnect', () => setIsConnected(false));
    socketRef.current.on('connect_error', () => setIsConnected(false));

    socketRef.current.on('new_order', (orderData) => {
      // Final check: don't process if offline (even if socket was connected)
      if (!isOnline) return;
      
      const orderId = orderData?.orderMongoId || orderData?.orderId || orderData?._id;
      if (orderId && rejectedOrderIds.has(String(orderId))) return;
      
      setNewOrder(orderData);
      if (!(orderId && suppressedSoundOrderIdsRef.current.has(String(orderId)))) {
        playNotificationSound();
      }
    });

    socketRef.current.on('new_order_available', (orderData) => {
      if (!isOnline) return;
      const orderId = orderData?.orderMongoId || orderData?.orderId || orderData?._id;
      if (orderId && rejectedOrderIds.has(String(orderId))) return;
      setNewOrder(orderData);
      if (!(orderId && suppressedSoundOrderIdsRef.current.has(String(orderId)))) {
        playNotificationSound();
      }
    });

    socketRef.current.on('play_notification_sound', (data) => {
      if (!isOnline) return;
      const soundType = data?.type;
      if (soundType === 'new_order' || soundType === 'new_order_available') return;
      playNotificationSound();
    });

    socketRef.current.on('order_ready', (orderData) => {
      if (!isOnline) return;
      setOrderReady(orderData);
      playNotificationSound();
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [deliveryPartnerId, isOnline, playNotificationSound, rejectedOrderIds]);

  const clearNewOrder = useCallback((orderId = null) => {
    stopNotificationSound();
    if (orderId) setRejectedOrderIds(prev => new Set([...prev, String(orderId)]));
    setNewOrder(null);
  }, [stopNotificationSound]);

  const clearOrderReady = useCallback(() => {
    stopNotificationSound();
    setOrderReady(null);
  }, [stopNotificationSound]);

  return {
    newOrder,
    clearNewOrder,
    orderReady,
    clearOrderReady,
    isConnected,
    isOnline, // expose isOnline status
    playNotificationSound,
    stopNotificationSound,
    rejectedOrderIds,
    suppressOrderSound: (id) => id && suppressedSoundOrderIdsRef.current.add(String(id)),
    unsuppressOrderSound: (id) => id && suppressedSoundOrderIdsRef.current.delete(String(id))
  };
};
