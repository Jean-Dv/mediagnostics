import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NotificationDocumentDto {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty()
  public status!: string;

  @ApiProperty()
  public title!: string;
}

export class NotificationDto {
  @ApiProperty({ format: 'date-time' })
  public createdAt!: string;

  @ApiPropertyOptional({ nullable: true, type: NotificationDocumentDto })
  public document!: NotificationDocumentDto | null;

  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  public readAt!: string | null;

  @ApiProperty({ enum: ['DOCUMENT_ANNULLED', 'DOCUMENT_PUBLISHED', 'DOCUMENT_REPLACED'] })
  public type!: string;
}

export class NotificationFeedDto {
  @ApiProperty({ isArray: true, type: NotificationDto })
  public items!: NotificationDto[];

  @ApiProperty()
  public unreadCount!: number;
}
