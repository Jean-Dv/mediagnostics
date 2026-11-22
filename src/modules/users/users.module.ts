import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { USER_REPOSITORY } from './application/user.repository.js';
import { UsersService } from './application/users.service.js';
import { CREDENTIAL_GENERATOR } from './domain/credential-generator.js';
import { NodeCredentialGenerator } from './infrastructure/node-credential-generator.js';
import { PrismaUserRepository } from './infrastructure/prisma-user.repository.js';
import { UsersController } from './presentation/users.controller.js';

@Module({
  controllers: [UsersController],
  imports: [AuthModule],
  providers: [
    UsersService,
    NodeCredentialGenerator,
    PrismaUserRepository,
    { provide: CREDENTIAL_GENERATOR, useExisting: NodeCredentialGenerator },
    { provide: USER_REPOSITORY, useExisting: PrismaUserRepository },
  ],
})
export class UsersModule {}
