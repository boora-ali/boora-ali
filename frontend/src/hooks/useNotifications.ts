import { useState, useEffect, useCallback } from "react";
import { notificationsService, type Notification } from "../services/notifications.service";

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const fetchNotifications = useCallback(() => {
    notificationsService
      .list()
      .then(({ data }) => setNotifications(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markRead = useCallback(async (id: string) => {
    await notificationsService.markRead(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const markAllRead = useCallback(async () => {
    await notificationsService.markAllRead();
    setNotifications([]);
  }, []);

  return { notifications, unreadCount: notifications.length, markRead, markAllRead };
}
