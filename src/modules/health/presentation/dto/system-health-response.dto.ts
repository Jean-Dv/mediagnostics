import { ApiProperty } from '@nestjs/swagger';

export class ComponentHealthDto {
  @ApiProperty()
  public latencyMs!: number;

  @ApiProperty({ enum: ['down', 'up'] })
  public status!: string;
}

export class SystemComponentsDto {
  @ApiProperty({ type: ComponentHealthDto })
  public api!: ComponentHealthDto;

  @ApiProperty({ type: ComponentHealthDto })
  public database!: ComponentHealthDto;

  @ApiProperty({ type: ComponentHealthDto })
  public redis!: ComponentHealthDto;

  @ApiProperty({ type: ComponentHealthDto })
  public storage!: ComponentHealthDto;

  @ApiProperty({ type: ComponentHealthDto })
  public worker!: ComponentHealthDto;
}

export class SystemHealthResponseDto {
  @ApiProperty({ format: 'date-time' })
  public checkedAt!: string;

  @ApiProperty({ type: SystemComponentsDto })
  public components!: SystemComponentsDto;

  @ApiProperty({ enum: ['degraded', 'ok'] })
  public status!: string;
}
