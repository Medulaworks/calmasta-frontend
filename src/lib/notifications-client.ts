import type { NotificationList } from "./notification-types";
import { api } from "./upload-client";

export type { NotificationItem, NotificationList } from "./notification-types";

export const fetchNotifications = () => api<NotificationList>("/api/notifications", { cache: "no-store" });
export const markNotificationsRead = () => api<{ ok: true }>("/api/notifications/seen", { method: "POST" });
