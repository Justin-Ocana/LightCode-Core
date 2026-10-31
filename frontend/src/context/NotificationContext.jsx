/**
 * NotificationContext - Real-time notifications via WebSocket
 */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';

// Helper functions - logs disabled in production
const devLog = () => {};
const devError = () => {};

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState([]);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const handlersRef = useRef({});

  // Obtener token directamente de localStorage
  const token = localStorage.getItem('access_token');

  // Fetch initial notifications
  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    
    try {
      const response = await api.get('/notifications/');
      const fetchedNotifications = response.data.results || response.data || [];
      setNotifications(fetchedNotifications);
      
      const countResponse = await api.get('/notifications/unread_count/');
      setUnreadCount(countResponse.data.count || 0);
      
      // NO mostrar toasts de notificaciones antiguas al cargar
      // Solo se mostrarán toasts de notificaciones nuevas que lleguen por WebSocket
    } catch (error) {
      devError('Error fetching notifications:', error);
    }
  }, [token]);

  // Connect to WebSocket
  const connectWebSocket = useCallback(() => {
    // Solo conectar en rutas del dashboard
    const isDashboardRoute = window.location.pathname.startsWith('/dashboard');
    
    if (!token || !user || !isDashboardRoute) {
      return;
    }

    // Don't reconnect if already connected
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Determine WebSocket URL - DEBE apuntar al backend, no al frontend
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    
    // Detectar si estamos en local o producción
    const isLocalHost = 
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1';
    
    // Usar el backend correcto según el entorno
    const wsHost = isLocalHost ? 'localhost:8000' : 'lightcode-backend.onrender.com';
    
    // El WebSocket NO usa el prefijo /api/, va directo al host
    const wsUrl = `${wsProtocol}//${wsHost}/ws/notifications/?token=${token}`;

    devLog('🔌 Connecting to WebSocket:', wsUrl.replace(token, 'TOKEN_HIDDEN'));

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      devLog('✅ WebSocket connected');
      reconnectAttemptsRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        devLog('📨 WebSocket message:', message);

        if (message.type === 'connection_established') {
          devLog('✅ Connection established:', message.message);
          return;
        }

        if (message.type === 'notification') {
          handlersRef.current.handleNewNotification?.(message.data);
        }

        if (message.type === 'order_update') {
          handlersRef.current.handleOrderUpdate?.(message.data);
        }
      } catch (error) {
        devError('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      devError('❌ WebSocket error:', error);
    };

    ws.onclose = (event) => {
      devLog('🔌 WebSocket closed:', event.code, event.reason);
      wsRef.current = null;
      
      // Only attempt to reconnect if it wasn't a clean close and we haven't exceeded max attempts
      if (event.code !== 1000 && reconnectAttemptsRef.current < 5) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        devLog(`🔄 Reconnecting in ${delay}ms...`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current++;
          connectWebSocket();
        }, delay);
      }
    };
  }, [token, user]);

  // Get toast type from notification type
  const getToastType = (notificationType) => {
    const typeMap = {
      'new_order': 'success',
      'order_delivered': 'success',
      'order_failed': 'error',
      'payment_received': 'success',
      'low_stock': 'warning',
      'server_offline': 'warning',
      'system': 'info'
    };
    return typeMap[notificationType] || 'info';
  };

  // Dismiss toast
  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Show toast notification
  const showToast = useCallback((toast) => {
    devLog('🍞 Showing toast:', toast);
    const id = Date.now() + Math.random();
    const newToast = { id, ...toast };
    
    setToasts(prev => {
      // Keep max 3 toasts
      const updated = [...prev, newToast];
      devLog('🍞 Updated toasts:', updated);
      return updated.slice(-3);
    });

    // Auto-dismiss
    setTimeout(() => {
      dismissToast(id);
    }, toast.duration || 4000);
  }, [dismissToast]);

  // Handle new notification
  const handleNewNotification = useCallback((data) => {
    devLog('🔔 Handling new notification:', data);
    
    // Add to notifications list
    setNotifications(prev => [data, ...prev]);
    setUnreadCount(prev => prev + 1);

    // Show toast
    showToast({
      type: getToastType(data.type),
      title: data.title,
      message: data.message,
      duration: data.type === 'order_failed' ? 6000 : 4000
    });

    // Si es una notificación de pedido, emitir evento para que Orders.jsx lo escuche
    if (data.type === 'new_order' && data.data?.order_id) {
      window.dispatchEvent(new CustomEvent('newOrder', { 
        detail: { 
          orderId: data.data.order_id,
          orderNumber: data.data.order_number 
        } 
      }));
    }
  }, [showToast]);

  // Handle order update
  const handleOrderUpdate = useCallback((data) => {
    devLog('📦 Order update:', data);
    // Trigger custom event for Orders page to listen
    window.dispatchEvent(new CustomEvent('orderUpdate', { detail: data }));
  }, []);

  // Update handlers ref
  useEffect(() => {
    handlersRef.current = {
      handleNewNotification,
      handleOrderUpdate
    };
  }, [handleNewNotification, handleOrderUpdate]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId) => {
    try {
      await api.post(`/notifications/${notificationId}/mark_read/`);
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      devError('Error marking notification as read:', error);
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      await api.post('/notifications/mark_all_read/');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      devError('Error marking all as read:', error);
    }
  }, []);

  // Clear all notifications
  const clearAll = useCallback(async () => {
    try {
      await api.delete('/notifications/clear_all/');
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      devError('Error clearing notifications:', error);
    }
  }, []);

  // Initialize
  useEffect(() => {
    devLog('🔔 NotificationProvider useEffect triggered', { user: user?.username, hasToken: !!token });
    
    // Solo conectar si hay usuario autenticado Y estamos en el dashboard
    const isDashboardRoute = window.location.pathname.startsWith('/dashboard');
    
    if (user && token && isDashboardRoute) {
      devLog('🔔 Fetching notifications and connecting WebSocket...');
      fetchNotifications();
      connectWebSocket();
    } else {
      if (!isDashboardRoute) {
        devLog('⚠️ Not in dashboard route, skipping WebSocket connection');
      } else {
        devLog('⚠️ No user or token, skipping WebSocket connection');
      }
    }

    return () => {
      devLog('🔔 NotificationProvider cleanup');
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [user?.id, token, fetchNotifications, connectWebSocket]); // Include all dependencies

  const value = {
    notifications,
    unreadCount,
    toasts,
    showToast,
    dismissToast,
    markAsRead,
    markAllAsRead,
    clearAll,
    refreshNotifications: fetchNotifications
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}
