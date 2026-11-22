import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ format: 'password' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  public currentPassword!: string;

  @ApiProperty({ format: 'password', minLength: 15 })
  @IsString()
  @MinLength(15)
  @MaxLength(128)
  public newPassword!: string;
}
