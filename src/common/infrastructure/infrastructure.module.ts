import { Global, Module } from '@nestjs/common';

import { DatabaseModule } from './database/database.module.js';
import { RedisService } from './redis.service.js';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [RedisService],
  exports: [DatabaseModule, RedisService],
})
export class InfrastructureModule {}
