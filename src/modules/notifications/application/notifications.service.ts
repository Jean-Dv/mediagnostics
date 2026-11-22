import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import {
  NOTIFICATION_REPOSITORY,
  type NotificationFeed,
  type NotificationRepository,
} from './notification.repository.js';

const feedLimit = 20;

@Injectable()
export class NotificationsService {
  public constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notifications: NotificationRepository,
  ) {}

  public list(userId: string): Promise<NotificationFeed> {
    return this.notifications.list(userId, feedLimit);
  }

  public markAllRead(userId: string): Promise<void> {
    return this.notifications.markAllRead(userId, new Date());
  }

  public async markRead(notificationId: string, userId: string): Promise<void> {
    const found = await this.notifications.markRead(notificationId, userId, new Date());
    if (!found) throw new NotFoundException('The notification does not exist.');
  }
}
