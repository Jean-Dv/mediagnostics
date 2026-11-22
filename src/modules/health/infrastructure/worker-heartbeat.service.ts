import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';

import { RedisService } from '../../../common/infrastructure/redis.service.js';
import { workerHeartbeatKey } from '../application/system-health.service.js';

const heartbeatIntervalMs = 10_000;
const heartbeatTtlMs = 30_000;

@Injectable()
export class WorkerHeartbeatService implements OnModuleInit, OnModuleDestroy {
  private interval: NodeJS.Timeout | null = null;
  private readonly logger = new Logger(WorkerHeartbeatService.name);

  public constructor(private readonly redis: RedisService) {}

  public async onModuleInit(): Promise<void> {
    await this.redis.connect();
    await this.writeHeartbeat();
    this.interval = setInterval(() => {
      void this.writeHeartbeat().catch((error: unknown) => {
        this.logger.error(
          error instanceof Error
            ? `Worker heartbeat failed: ${error.message}`
            : 'Worker heartbeat failed.',
        );
      });
    }, heartbeatIntervalMs);
    this.interval.unref();
  }

  public async onModuleDestroy(): Promise<void> {
    if (this.interval !== null) clearInterval(this.interval);
    if (this.redis.getClient().isOpen) {
      await this.redis.getClient().del(workerHeartbeatKey);
    }
  }

  private async writeHeartbeat(): Promise<void> {
    await this.redis
      .getClient()
      .set(workerHeartbeatKey, new Date().toISOString(), { PX: heartbeatTtlMs });
  }
}
