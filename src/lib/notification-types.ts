export type NotificationTone = "info" | "success" | "warning" | "danger";

export interface NotificationItem {
  id: string;
  tone: NotificationTone;
  title: string;
  body: string;
  /** Where clicking it goes. */
  href: string;
  at: string;
  /** True when it happened after the customer last opened the bell. */
  unread: boolean;
}

export interface NotificationList {
  items: NotificationItem[];
  unread: number;
}
