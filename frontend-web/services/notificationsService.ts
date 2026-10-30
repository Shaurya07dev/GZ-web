import { http } from "@/lib/api";

// The in-app inbox: a persistent copy of every transactional email the API sends.
export interface AppNotification {
  id: string;
  title: string;
  body: string;
  /** A path on this site, or null. */
  url: string | null;
  read: boolean;
  createdAt: string;
}

export const notificationsService = {
  list: () => http.get<{ items: AppNotification[]; unreadCount: number }>("/v1/notifications"),
  markRead: (id: string) => http.post(`/v1/notifications/${encodeURIComponent(id)}/read`),
  markAllRead: () => http.post("/v1/notifications/read-all"),
};
