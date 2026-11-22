import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { Permission } from '../../access-control/domain/access-control.js';
import {
  Public,
  RequirePermissions,
} from '../../access-control/presentation/access-control.decorators.js';
import { SystemHealthService } from '../application/system-health.service.js';
import { SystemHealthResponseDto } from './dto/system-health-response.dto.js';

interface HealthResponse {
  status: 'ok';
  service: 'api';
  timestamp: string;
}

@ApiTags('health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  public constructor(private readonly systemHealth: SystemHealthService) {}

  @Get('live')
  @Public()
  @ApiOkResponse({ description: 'The API process is alive.' })
  public getLiveness(): HealthResponse {
    return {
      status: 'ok',
      service: 'api',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @Public()
  @ApiOkResponse({ description: 'The API is ready to accept requests.' })
  public async getReadiness(): Promise<HealthResponse> {
    await this.systemHealth.assertReady();
    return {
      status: 'ok',
      service: 'api',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('system')
  @RequirePermissions(Permission.SystemHealthRead)
  @ApiOkResponse({ type: SystemHealthResponseDto })
  public async getSystemHealth(): Promise<SystemHealthResponseDto> {
    const health = await this.systemHealth.inspect();
    return {
      checkedAt: health.checkedAt.toISOString(),
      components: health.components,
      status: health.status,
    };
  }
}
