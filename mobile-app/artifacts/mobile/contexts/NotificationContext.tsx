import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "@/utils/api";
import { useAuth } from "./AuthContext";
import { io, Socket } from "socket.io-client";
import { Alert } from "react-native";

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "INFO" | "SUCCESS" | "WARNING" | "ALERT";
  read: boolean;
  createdAt: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  addLocalNotification: (title: string, message: string, type: Notification["type"]) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  // Fetch initial notifications
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await api.get<{
        notifications: Notification[];
        unreadCount: number;
      }>("/notification");

      if (response.success && response.data) {
        setNotifications(response.data.notifications);
        setUnreadCount(response.data.unreadCount);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Mark a notification as read
  const markAsRead = useCallback(async (id: string) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await api.put(`/notification/${id}/read`);
    } catch (err) {
      // Revert on failure
      fetchNotifications();
    }
  }, [fetchNotifications]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);

    try {
      await api.put("/notification/read-all");
    } catch (err) {
      fetchNotifications();
    }
  }, [fetchNotifications]);

  // Delete a notification
  const deleteNotification = useCallback(async (id: string) => {
    const isUnread = notifications.find((n) => n.id === id)?.read === false;
    
    // Optimistic update
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (isUnread) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    try {
      await api.delete(`/notification/${id}`);
    } catch (err) {
      fetchNotifications();
    }
  }, [notifications, fetchNotifications]);

  // Add local notification (fallback or custom action)
  const addLocalNotification = useCallback((title: string, message: string, type: Notification["type"]) => {
    const localNotif: Notification = {
      id: Math.random().toString(),
      userId: user?.id || "",
      title,
      message,
      type,
      read: false,
      createdAt: new Date().toISOString(),
    };
    setNotifications((prev) => [localNotif, ...prev]);
    setUnreadCount((prev) => prev + 1);
  }, [user]);

  // Load notifications when user logs in
  useEffect(() => {
    if (user) {
      fetchNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [user, fetchNotifications]);

  // Initialize Socket.io Connection
  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    // Get active token to authenticate the socket connection
    const setupSocket = async () => {
      try {
        const token = await api.request<string>("GET", "/user/profile", { requireAuth: true })
          .then(async () => {
            // Retrieve token from AsyncStorage (token_key is stored in api)
            const AsyncStorage = require("@react-native-async-storage/async-storage").default;
            return await AsyncStorage.getItem("payverify_access_token");
          });

        if (!token) return;

        // Connect to Socket server
        const socketUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:6000";
        const socketConn = io(socketUrl, {
          path: "/socket.io",
          auth: { token },
          transports: ["websocket"],
        });

        socketConn.on("connect", () => {
          console.log("🔌 Connected to real-time notification socket");
        });

        socketConn.on("notification", (newNotif: Notification) => {
          setNotifications((prev) => {
            // Avoid duplicate socket messages
            if (prev.some((n) => n.id === newNotif.id)) return prev;
            return [newNotif, ...prev];
          });
          setUnreadCount((prev) => prev + 1);
        });

        socketConn.on("disconnect", () => {
          console.log("🔴 Disconnected from notification socket");
        });

        setSocket(socketConn);

        return () => {
          socketConn.disconnect();
        };
      } catch (err) {
        console.warn("WebSocket initialization failed:", err);
      }
    };

    setupSocket();

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [user]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        addLocalNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used inside NotificationProvider");
  return ctx;
}
