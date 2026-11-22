import { ApiProperty } from '@nestjs/swagger';

import { Role } from '../../../access-control/domain/access-control.js';

export class UserSummaryDto {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty({ format: 'email' })
  public email!: string;

  @ApiProperty()
  public fullName!: string;

  @ApiProperty({ enum: Role })
  public role!: Role;

  @ApiProperty({ enum: ['ACTIVE', 'DISABLED'] })
  public status!: 'ACTIVE' | 'DISABLED';

  @ApiProperty({ nullable: true, type: String })
  public clinicalCode!: string | null;

  @ApiProperty()
  public passwordChangeRequired!: boolean;

  @ApiProperty({ format: 'date-time' })
  public createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  public updatedAt!: string;
}

export class TemporaryCredentialResponseDto {
  @ApiProperty({ description: 'Displayed once and never persisted in plaintext.' })
  public temporaryPassword!: string;

  @ApiProperty({ type: UserSummaryDto })
  public user!: UserSummaryDto;
}

export class PaginatedUsersResponseDto {
  @ApiProperty({ type: [UserSummaryDto] })
  public items!: UserSummaryDto[];

  @ApiProperty()
  public page!: number;

  @ApiProperty()
  public pageSize!: number;

  @ApiProperty()
  public total!: number;
}
