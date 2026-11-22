import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuditActorDto {
  @ApiProperty({ format: 'email' })
  public email!: string;

  @ApiProperty()
  public fullName!: string;

  @ApiProperty({ format: 'uuid' })
  public id!: string;
}

export class AuditRecordDto {
  @ApiProperty()
  public action!: string;

  @ApiPropertyOptional({ nullable: true, type: AuditActorDto })
  public actor!: AuditActorDto | null;

  @ApiProperty({ format: 'date-time' })
  public createdAt!: string;

  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiPropertyOptional({ nullable: true })
  public ipAddress!: string | null;

  @ApiPropertyOptional({ nullable: true, type: Object })
  public metadata!: unknown;

  @ApiPropertyOptional({ nullable: true })
  public resourceId!: string | null;

  @ApiProperty()
  public resourceType!: string;

  @ApiProperty({ enum: ['FAILURE', 'SUCCESS'] })
  public result!: string;

  @ApiPropertyOptional({ nullable: true })
  public userAgent!: string | null;
}

export class AuditPageDto {
  @ApiProperty({ isArray: true, type: AuditRecordDto })
  public items!: AuditRecordDto[];

  @ApiProperty()
  public page!: number;

  @ApiProperty()
  public pageSize!: number;

  @ApiProperty()
  public total!: number;

  @ApiProperty()
  public totalPages!: number;
}
