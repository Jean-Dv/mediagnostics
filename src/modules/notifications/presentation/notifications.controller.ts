import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiCookieAuth, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { Permission } from '../../access-control/domain/access-control.js';
import { RequirePermissions } from '../../access-control/presentation/access-control.decorators.js';
import type { NotificationRecord } from '../application/notification.repository.js';
import { NotificationsService } from '../application/notifications.service.js';
import { NotificationDto, NotificationFeedDto } from './dto/notification-response.dto.js';

@ApiTags('notifications')
@ApiCookieAuth('mediagnostics.sid')
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  public constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @RequirePermissions(Permission.NotificationReadOwn)
  @ApiOkResponse({ type: NotificationFeedDto })
  public async list(@Req() request: Request): Promise<NotificationFeedDto> {
    const feed = await this.notificationsService.list(this.getUserId(request));
    return {
      items: feed.items.map((notification) => this.toResponse(notification)),
      unreadCount: feed.unreadCount,
    };
  }

  @Patch('read-all')
  @HttpCode(204)
  @RequirePermissions(Permission.NotificationUpdateOwn)
  @ApiNoContentResponse()
  public markAllRead(@Req() request: Request): Promise<void> {
    return this.notificationsService.markAllRead(this.getUserId(request));
  }

  @Patch(':id/read')
  @HttpCode(204)
  @RequirePermissions(Permission.NotificationUpdateOwn)
  @ApiNoContentResponse()
  public markRead(
    @Param('id', new ParseUUIDPipe({ version: '4' })) notificationId: string,
    @Req() request: Request,
  ): Promise<void> {
    return this.notificationsService.markRead(notificationId, this.getUserId(request));
  }

  private getUserId(request: Request): string {
    if (request.user === undefined) {
      throw new UnauthorizedException('Authentication is required.');
    }
    return request.user.id;
  }

  private toResponse(notification: NotificationRecord): NotificationDto {
    return {
      createdAt: notification.createdAt.toISOString(),
      document: notification.document,
      id: notification.id,
      readAt: notification.readAt?.toISOString() ?? null,
      type: notification.type,
    };
  }
}
