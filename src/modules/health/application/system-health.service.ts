import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { PrismaService } from '../../../common/infrastructure/database/prisma.service.js';
import { RedisService } from '../../../common/infrastructure/redis.service.js';
import { S3DocumentStorage } from '../../documents/infrastructure/s3-document.storage.js';

export const workerHeartbeatKey = 'mediagnostics:worker:heartbeat';

export type ComponentStatus = 'down' | 'up';

export interface ComponentHealth {
  latencyMs: number;
  status: ComponentStatus;
}

export interface SystemHealth {
  checkedAt: Date;
  components: {
    api: ComponentHealth;
    database: ComponentHealth;
    redis: ComponentHealth;
    storage: ComponentHealth;
    worker: ComponentHealth;
  };
  status: 'degraded' | 'ok';
}

const componentTimeoutMs = 3_000;

@Injectable()
export class SystemHealthService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly storage: S3DocumentStorage,
  ) {}

  public async assertReady(): Promise<void> {
    const health = await this.inspect();
    if (health.status !== 'ok') {
      throw new ServiceUnavailableException('Service is not ready.');
    }
  }

  public async inspect(): Promise<SystemHealth> {
    const [database, redis, storage, worker] = await Promise.all([
      this.check(async () => {
        await this.prisma.$queryRaw`SELECT 1`;
      }),
      this.check(async () => {
        await this.redis.getClient().ping();
      }),
      this.check(() => this.storage.checkHealth()),
      this.check(async () => {
        const heartbeat = await this.redis.getClient().get(workerHeartbeatKey);
        if (heartbeat === null) throw new Error('Worker heartbeat is unavailable.');
      }),
    ]);
    const api: ComponentHealth = { latencyMs: 0, status: 'up' };
    const components = { api, database, redis, storage, worker };
    return {
      checkedAt: new Date(),
      components,
      status: Object.values(components).every((component) => component.status === 'up')
        ? 'ok'
        : 'degraded',
    };
  }

  private async check(operation: () => Promise<unknown>): Promise<ComponentHealth> {
    const startedAt = performance.now();
    const timeout = this.createTimeout();
    try {
      await Promise.race([operation(), timeout.promise]);
      return { latencyMs: Math.round(performance.now() - startedAt), status: 'up' };
    } catch {
      return { latencyMs: Math.round(performance.now() - startedAt), status: 'down' };
    } finally {
      timeout.cancel();
    }
  }

  private createTimeout(): { cancel: () => void; promise: Promise<never> } {
    let rejectTimeout: (reason: Error) => void = () => undefined;
    const promise = new Promise<never>((_, reject) => {
      rejectTimeout = reject;
    });
    const timer = setTimeout(() => {
      rejectTimeout(new Error('Health check timed out.'));
    }, componentTimeoutMs);
    timer.unref();
    return {
      cancel: () => {
        clearTimeout(timer);
      },
      promise,
    };
  }
}
