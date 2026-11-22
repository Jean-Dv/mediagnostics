import { ServiceUnavailableException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../../common/infrastructure/database/prisma.service.js';
import type { RedisService } from '../../../common/infrastructure/redis.service.js';
import type { S3DocumentStorage } from '../../documents/infrastructure/s3-document.storage.js';
import { SystemHealthService } from './system-health.service.js';

describe('SystemHealthService', () => {
  let checkStorage: ReturnType<typeof vi.fn<() => Promise<void>>>;
  let getHeartbeat: ReturnType<typeof vi.fn<(key: string) => Promise<string | null>>>;
  let ping: ReturnType<typeof vi.fn<() => Promise<string>>>;
  let query: ReturnType<typeof vi.fn<() => Promise<unknown>>>;
  let service: SystemHealthService;

  beforeEach(() => {
    checkStorage = vi.fn().mockResolvedValue(undefined);
    getHeartbeat = vi.fn().mockResolvedValue('2026-11-22T15:00:00.000Z');
    ping = vi.fn().mockResolvedValue('PONG');
    query = vi.fn().mockResolvedValue([{ '?column?': 1 }]);
    const prisma = { $queryRaw: query } as unknown as PrismaService;
    const redis = {
      getClient: () => ({ get: getHeartbeat, ping }),
    } as unknown as RedisService;
    const storage = { checkHealth: checkStorage } as unknown as S3DocumentStorage;
    service = new SystemHealthService(prisma, redis, storage);
  });

  it('reports every required component as available', async () => {
    await expect(service.inspect()).resolves.toMatchObject({
      components: {
        api: { status: 'up' },
        database: { status: 'up' },
        redis: { status: 'up' },
        storage: { status: 'up' },
        worker: { status: 'up' },
      },
      status: 'ok',
    });
  });

  it('reports degraded state without exposing dependency errors', async () => {
    getHeartbeat.mockResolvedValueOnce(null);

    await expect(service.inspect()).resolves.toMatchObject({
      components: { worker: { status: 'down' } },
      status: 'degraded',
    });
  });

  it('rejects public readiness when a dependency is unavailable', async () => {
    ping.mockRejectedValueOnce(new Error('redis unavailable'));

    await expect(service.assertReady()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
