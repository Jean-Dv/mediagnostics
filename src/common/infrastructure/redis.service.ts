import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { createClient, type RedisClientType } from 'redis';

import { loadEnvironment } from '../config/environment.js';

@Injectable()
export class RedisService implements OnApplicationShutdown {
  private readonly client: RedisClientType;
  private readonly logger = new Logger(RedisService.name);

  public constructor() {
    this.client = createClient({ url: loadEnvironment().redisUrl });
    this.client.on('error', (error: Error) => {
      this.logger.error('Redis client error', error.stack);
    });
  }

  public async connect(): Promise<void> {
    if (!this.client.isOpen) {
      await this.client.connect();
    }
  }

  public getClient(): RedisClientType {
    return this.client;
  }

  public async onApplicationShutdown(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.quit();
    }
  }
}
