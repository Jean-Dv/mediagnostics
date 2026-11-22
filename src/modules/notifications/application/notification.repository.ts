export const NOTIFICATION_REPOSITORY = Symbol('NOTIFICATION_REPOSITORY');

export type NotificationType = 'DOCUMENT_ANNULLED' | 'DOCUMENT_PUBLISHED' | 'DOCUMENT_REPLACED';

export interface NotificationDocument {
  id: string;
  status: string;
  title: string;
}

export interface NotificationRecord {
  createdAt: Date;
  document: NotificationDocument | null;
  id: string;
  readAt: Date | null;
  type: NotificationType;
}

export interface NotificationFeed {
  items: NotificationRecord[];
  unreadCount: number;
}

export interface NotificationRepository {
  list(userId: string, limit: number): Promise<NotificationFeed>;
  markAllRead(userId: string, readAt: Date): Promise<void>;
  markRead(notificationId: string, userId: string, readAt: Date): Promise<boolean>;
}
