import type { NotificationList } from "./notification-types";
import { api } from "./upload-client";

export type { NotificationItem, NotificationList } from "./notification-types";

export const fetchNotifications = () => api<NotificationList>("/api/notifications", { cache: "no-store" });
export const markNotificationsRead = (ids: string[]) =>
  ids.length === 0
    ? Promise.resolve({ ok: true as const })
    : api<{ ok: true }>("/api/notifications/seen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: ids.slice(0, 100) }),
      });
