import { apiRequest } from './client';

export type NotificationType = 'DOCUMENT_ANNULLED' | 'DOCUMENT_PUBLISHED' | 'DOCUMENT_REPLACED';

export interface NotificationRecord {
  createdAt: string;
  document: { id: string; status: string; title: string } | null;
  id: string;
  readAt: string | null;
  type: NotificationType;
}

export interface NotificationFeed {
  items: NotificationRecord[];
  unreadCount: number;
}

export function getNotifications(): Promise<NotificationFeed> {
  return apiRequest<NotificationFeed>('/api/v1/notifications');
}

export function markNotificationRead(notificationId: string): Promise<undefined> {
  return apiRequest<undefined>(`/api/v1/notifications/${notificationId}/read`, {
    method: 'PATCH',
  });
}

export function markAllNotificationsRead(): Promise<undefined> {
  return apiRequest<undefined>('/api/v1/notifications/read-all', { method: 'PATCH' });
}
