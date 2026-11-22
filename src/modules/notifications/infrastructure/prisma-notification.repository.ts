import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../common/infrastructure/database/prisma.service.js';
import type {
  NotificationFeed,
  NotificationRecord,
  NotificationRepository,
} from '../application/notification.repository.js';

@Injectable()
export class PrismaNotificationRepository implements NotificationRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async list(userId: string, limit: number): Promise<NotificationFeed> {
    const [notifications, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        include: {
          document: { select: { id: true, status: true, title: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        where: { userId },
      }),
      this.prisma.notification.count({ where: { readAt: null, userId } }),
    ]);
    return {
      items: notifications.map((notification): NotificationRecord => ({
        createdAt: notification.createdAt,
        document: notification.document,
        id: notification.id,
        readAt: notification.readAt,
        type: notification.type,
      })),
      unreadCount,
    };
  }

  public async markAllRead(userId: string, readAt: Date): Promise<void> {
    await this.prisma.notification.updateMany({
      data: { readAt },
      where: { readAt: null, userId },
    });
  }

  public async markRead(notificationId: string, userId: string, readAt: Date): Promise<boolean> {
    const result = await this.prisma.notification.updateMany({
      data: { readAt },
      where: { id: notificationId, userId },
    });
    return result.count > 0;
  }
}
