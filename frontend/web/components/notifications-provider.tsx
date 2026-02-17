"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ApiNotification } from "@/lib/api";
import { fetchUserNotifications, markNotificationAsRead } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";

type NotificationsContextValue = {
  notifications: ApiNotification[];
  unreadCount: number;
  isLoading: boolean;
  refresh: (options?: { silent?: boolean }) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
};

const NotificationsContext = createContext<
  NotificationsContextValue | undefined
>(undefined);

const NOTIFICATIONS_POLL_INTERVAL_MS = 30000;
// *i'll hope this is working
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(
    async ({ silent }: { silent?: boolean } = {}) => {
      if (status !== "authenticated" || !user) {
        setNotifications([]);
        setIsLoading(false);
        return;
      }
      if (!silent) {
        setIsLoading(true);
      }
      try {
        const list = await fetchUserNotifications({ shown: true });
        setNotifications(list);
      } catch {
        if (!silent) {
          setNotifications([]);
        }
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [status, user],
  );

  useEffect(() => {
    if (status !== "authenticated" || !user) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }
    void refresh();
  }, [refresh, status, user]);

  useEffect(() => {
    if (status !== "authenticated" || !user) {
      return () => {};
    }
    const interval = window.setInterval(() => {
      void refresh({ silent: true });
    }, NOTIFICATIONS_POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [refresh, status, user]);

  const markAsRead = useCallback(
    async (id: string) => {
      const trimmed = id.trim();
      if (!trimmed) {
        return;
      }
      const now = new Date().toISOString();
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === trimmed ? { ...item, readAt: item.readAt ?? now } : item,
        ),
      );
      try {
        await markNotificationAsRead(trimmed);
      } catch {
        void refresh({ silent: true });
      }
    },
    [refresh],
  );

  const markAllAsRead = useCallback(async () => {
    const unreadIds = notifications
      .filter((item) => !item.readAt)
      .map((item) => item.id);
    if (unreadIds.length === 0) {
      return;
    }
    const now = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((item) => (item.readAt ? item : { ...item, readAt: now })),
    );
    await Promise.allSettled(unreadIds.map((id) => markNotificationAsRead(id)));
    void refresh({ silent: true });
  }, [notifications, refresh]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.readAt).length,
    [notifications],
  );

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notifications,
      unreadCount,
      isLoading,
      refresh,
      markAsRead,
      markAllAsRead,
    }),
    [isLoading, markAllAsRead, markAsRead, notifications, refresh, unreadCount],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationsProvider");
  }
  return context;
}
