import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { UnrecoverableError, Worker } from 'bullmq';

import { loadEnvironment } from '../../../common/config/environment.js';
import { RedisService } from '../../../common/infrastructure/redis.service.js';
import {
  documentQueueName,
  type ProcessDocumentJobData,
} from '../../documents/application/document-queue.js';
import { DocumentProcessingService } from '../application/document-processing.service.js';
import { PermanentProcessingError } from '../application/pdf-processor.js';

@Injectable()
export class BullMqProcessingWorker implements OnModuleInit, OnModuleDestroy {
  private readonly environment = loadEnvironment();
  private readonly logger = new Logger(BullMqProcessingWorker.name);
  private worker: Worker<ProcessDocumentJobData> | null = null;

  public constructor(
    private readonly processingService: DocumentProcessingService,
    private readonly redis: RedisService,
  ) {}

  public onModuleInit(): void {
    this.worker = new Worker<ProcessDocumentJobData>(
      documentQueueName,
      async (job) => {
        const attempts = job.opts.attempts ?? 1;
        const finalAttempt = job.attemptsMade + 1 >= attempts;
        try {
          await this.processingService.process(job.data, finalAttempt);
        } catch (error: unknown) {
          if (error instanceof PermanentProcessingError) {
            throw new UnrecoverableError(`${error.code}: ${error.message}`);
          }
          throw error;
        }
      },
      {
        concurrency: this.environment.workerConcurrency,
        connection: this.redis.getClient(),
        lockDuration: this.environment.jobTimeoutMs + 15_000,
      },
    );
    this.worker.on('completed', (job) => {
      this.logger.log(`Document processing completed for job ${job.id ?? 'unknown'}.`);
    });
    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `Document processing failed for job ${job?.id ?? 'unknown'}: ${error.message}`,
      );
    });
    this.worker.on('error', (error) => {
      this.logger.error(`Worker connection error: ${error.message}`);
    });
  }

  public async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
