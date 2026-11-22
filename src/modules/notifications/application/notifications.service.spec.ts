import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NotificationRepository } from './notification.repository.js';
import { NotificationsService } from './notifications.service.js';

describe('NotificationsService', () => {
  const userId = '1f97ba5b-e107-4a34-8b1d-386c55d96137';
  const notificationId = '5b594eb7-2dd4-4687-a4a5-2f0262f946d4';
  let list: ReturnType<typeof vi.fn<NotificationRepository['list']>>;
  let markAllRead: ReturnType<typeof vi.fn<NotificationRepository['markAllRead']>>;
  let markRead: ReturnType<typeof vi.fn<NotificationRepository['markRead']>>;
  let service: NotificationsService;

  beforeEach(() => {
    list = vi.fn<NotificationRepository['list']>().mockResolvedValue({
      items: [],
      unreadCount: 0,
    });
    markAllRead = vi.fn<NotificationRepository['markAllRead']>().mockResolvedValue(undefined);
    markRead = vi.fn<NotificationRepository['markRead']>().mockResolvedValue(true);
    service = new NotificationsService({ list, markAllRead, markRead });
  });

  it('returns the latest twenty notifications for the account', async () => {
    await expect(service.list(userId)).resolves.toEqual({ items: [], unreadCount: 0 });
    expect(list).toHaveBeenCalledWith(userId, 20);
  });

  it('marks one owned notification as read', async () => {
    await expect(service.markRead(notificationId, userId)).resolves.toBeUndefined();
    expect(markRead).toHaveBeenCalledWith(notificationId, userId, expect.any(Date));
  });

  it('does not reveal whether another account owns a notification', async () => {
    markRead.mockResolvedValueOnce(false);

    await expect(service.markRead(notificationId, userId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('marks all notifications owned by the account as read', async () => {
    await expect(service.markAllRead(userId)).resolves.toBeUndefined();
    expect(markAllRead).toHaveBeenCalledWith(userId, expect.any(Date));
  });
});
