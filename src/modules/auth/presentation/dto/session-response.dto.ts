import { ApiProperty } from '@nestjs/swagger';

import { Role } from '../../../access-control/domain/access-control.js';

export class SessionResponseDto {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty({ format: 'email' })
  public email!: string;

  @ApiProperty()
  public fullName!: string;

  @ApiProperty({ enum: Role })
  public role!: Role;

  @ApiProperty()
  public passwordChangeRequired!: boolean;
}
