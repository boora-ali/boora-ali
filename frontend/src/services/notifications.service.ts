import { api } from "./api";

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  read_at: string | null;
  expires_at: string;
  created_at: string;
}

export const notificationsService = {
  list: () => api.get<Notification[]>("/notifications/"),
  markRead: (id: string) => api.post(`/notifications/${id}/read/`),
  markAllRead: () => api.post("/notifications/read-all/"),
};
