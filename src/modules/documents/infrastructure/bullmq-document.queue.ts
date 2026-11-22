import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';

import { RedisService } from '../../../common/infrastructure/redis.service.js';
import {
  documentQueueName,
  processDocumentJobName,
  type DocumentQueue,
  type ProcessDocumentJobData,
} from '../application/document-queue.js';

@Injectable()
export class BullMqDocumentQueue implements DocumentQueue, OnModuleDestroy {
  private readonly queue: Queue<ProcessDocumentJobData>;

  public constructor(redis: RedisService) {
    this.queue = new Queue<ProcessDocumentJobData>(documentQueueName, {
      connection: redis.getClient(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { delay: 2_000, type: 'exponential' },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });
  }

  public async enqueue(data: ProcessDocumentJobData): Promise<void> {
    await this.queue.add(processDocumentJobName, data, { jobId: data.processingJobId });
  }

  public async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
