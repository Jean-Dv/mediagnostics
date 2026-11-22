import { Module } from '@nestjs/common';

import { NOTIFICATION_REPOSITORY } from './application/notification.repository.js';
import { NotificationsService } from './application/notifications.service.js';
import { PrismaNotificationRepository } from './infrastructure/prisma-notification.repository.js';
import { NotificationsController } from './presentation/notifications.controller.js';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    PrismaNotificationRepository,
    { provide: NOTIFICATION_REPOSITORY, useExisting: PrismaNotificationRepository },
  ],
})
export class NotificationsModule {}
