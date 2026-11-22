import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

import { Role } from '../../../access-control/domain/access-control.js';

export class CreateUserDto {
  @ApiProperty({ example: 'patient@example.test', format: 'email' })
  @IsEmail()
  @MaxLength(254)
  public email!: string;

  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  public fullName!: string;

  @ApiProperty({ enum: Role })
  @IsEnum(Role)
  public role!: Role;
}
