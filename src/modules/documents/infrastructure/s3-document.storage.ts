import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';

import { loadEnvironment } from '../../../common/config/environment.js';
import type { DocumentStorage, StoreObjectInput } from '../application/document-storage.js';

@Injectable()
export class S3DocumentStorage implements DocumentStorage, OnModuleInit, OnModuleDestroy {
  private readonly bucket: string;
  private readonly client: S3Client;
  private readonly localEndpoint: boolean;

  public constructor() {
    const environment = loadEnvironment();
    if (
      (environment.storageAccessKey === undefined) !==
      (environment.storageSecretKey === undefined)
    ) {
      throw new Error('STORAGE_ACCESS_KEY and STORAGE_SECRET_KEY must be configured together.');
    }
    const credentials =
      environment.storageAccessKey === undefined || environment.storageSecretKey === undefined
        ? undefined
        : {
            accessKeyId: environment.storageAccessKey,
            secretAccessKey: environment.storageSecretKey,
          };
    this.bucket = environment.storageBucket;
    this.localEndpoint = environment.storageEndpoint !== undefined;
    this.client = new S3Client({
      ...(credentials === undefined ? {} : { credentials }),
      ...(environment.storageEndpoint === undefined
        ? {}
        : { endpoint: environment.storageEndpoint }),
      forcePathStyle: environment.storageForcePathStyle,
      region: environment.storageRegion,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  public async onModuleInit(): Promise<void> {
    if (!this.localEndpoint) return;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }

  public async get(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (response.Body === undefined) {
      throw new Error(`Stored object has no body: ${key}`);
    }
    return Buffer.from(await response.Body.transformToByteArray());
  }

  public async checkHealth(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
  }

  public async store(input: StoreObjectInput): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Body: input.body,
        Bucket: this.bucket,
        ContentLength: input.body.length,
        ContentType: input.contentType,
        Key: input.key,
        ServerSideEncryption: this.localEndpoint ? undefined : 'AES256',
      }),
    );
  }

  public async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  public onModuleDestroy(): void {
    this.client.destroy();
  }
}
