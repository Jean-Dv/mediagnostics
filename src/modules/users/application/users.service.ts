import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { RequestContext } from '../../../common/types/request-context.js';
import { Role } from '../../access-control/domain/access-control.js';
import { AUDIT_WRITER, type AuditWriter } from '../../auth/application/audit-writer.js';
import { PASSWORD_HASHER, type PasswordHasher } from '../../auth/domain/password-hasher.js';
import { CREDENTIAL_GENERATOR, type CredentialGenerator } from '../domain/credential-generator.js';
import { DuplicateUserEmailError } from './user-errors.js';
import {
  USER_REPOSITORY,
  type ManagedUser,
  type ManagedUserStatus,
  type UserPage,
  type UserRepository,
} from './user.repository.js';

export interface TemporaryCredentialResult {
  temporaryPassword: string;
  user: ManagedUser;
}

export interface UserActionContext extends RequestContext {
  actorId: string;
}

@Injectable()
export class UsersService {
  public constructor(
    @Inject(USER_REPOSITORY)
    private readonly users: UserRepository,
    @Inject(AUDIT_WRITER)
    private readonly audit: AuditWriter,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasher,
    @Inject(CREDENTIAL_GENERATOR)
    private readonly credentials: CredentialGenerator,
  ) {}

  public async create(
    input: { email: string; fullName: string; role: Role },
    context: UserActionContext,
  ): Promise<TemporaryCredentialResult> {
    const email = this.normalizeEmail(input.email);
    if (await this.users.findByEmail(email)) {
      await this.writeFailure('user.create', null, 'DUPLICATE_EMAIL', context);
      throw new ConflictException({
        code: 'USER_EMAIL_ALREADY_EXISTS',
        message: 'A user with this email already exists.',
      });
    }

    const temporaryPassword = this.credentials.generateTemporaryPassword();
    const passwordHash = await this.passwordHasher.hash(temporaryPassword);

    try {
      const user = await this.users.create({
        clinicalCode: input.role === Role.Patient ? this.credentials.generateClinicalCode() : null,
        email,
        fullName: this.normalizeFullName(input.fullName),
        passwordHash,
        role: input.role,
      });
      await this.writeSuccess('user.create', user.id, { role: user.role }, context);
      return { temporaryPassword, user };
    } catch (error: unknown) {
      if (error instanceof DuplicateUserEmailError) {
        await this.writeFailure('user.create', null, 'DUPLICATE_EMAIL', context);
        throw new ConflictException({
          code: 'USER_EMAIL_ALREADY_EXISTS',
          message: error.message,
        });
      }
      throw error;
    }
  }

  public list(query: {
    page: number;
    role?: Role;
    search?: string;
    status?: ManagedUserStatus;
  }): Promise<UserPage> {
    return this.users.list({
      page: query.page,
      ...(query.role === undefined ? {} : { role: query.role }),
      ...(query.search === undefined || query.search.trim().length === 0
        ? {}
        : { search: query.search.trim() }),
      ...(query.status === undefined ? {} : { status: query.status }),
    });
  }

  public async updateProfile(
    userId: string,
    input: { email: string; fullName: string },
    context: UserActionContext,
  ): Promise<ManagedUser> {
    const current = await this.getUserOrThrow(userId);
    const email = this.normalizeEmail(input.email);
    const existing = await this.users.findByEmail(email);
    if (existing !== null && existing.id !== userId) {
      await this.writeFailure('user.update', userId, 'DUPLICATE_EMAIL', context);
      throw new ConflictException({
        code: 'USER_EMAIL_ALREADY_EXISTS',
        message: 'A user with this email already exists.',
      });
    }

    try {
      const updated = await this.users.updateProfile(userId, {
        email,
        fullName: this.normalizeFullName(input.fullName),
      });
      if (updated === null) {
        throw new NotFoundException('The user does not exist.');
      }

      const changedFields = [
        ...(current.email === updated.email ? [] : ['email']),
        ...(current.fullName === updated.fullName ? [] : ['fullName']),
      ].join(',');
      await this.writeSuccess('user.update', userId, { changedFields }, context);
      return updated;
    } catch (error: unknown) {
      if (error instanceof DuplicateUserEmailError) {
        await this.writeFailure('user.update', userId, 'DUPLICATE_EMAIL', context);
        throw new ConflictException({
          code: 'USER_EMAIL_ALREADY_EXISTS',
          message: error.message,
        });
      }
      throw error;
    }
  }

  public async disable(userId: string, context: UserActionContext): Promise<void> {
    if (userId === context.actorId) {
      await this.writeFailure('user.disable', userId, 'SELF_DISABLE_NOT_ALLOWED', context);
      throw new BadRequestException({
        code: 'SELF_DISABLE_NOT_ALLOWED',
        message: 'Administrators cannot disable their own account.',
      });
    }

    const result = await this.users.disable(userId);
    if (result === 'NOT_FOUND') {
      throw new NotFoundException('The user does not exist.');
    }
    if (result === 'ALREADY_DISABLED') {
      throw new BadRequestException({
        code: 'USER_ALREADY_DISABLED',
        message: 'The user is already disabled.',
      });
    }
    if (result === 'LAST_ACTIVE_ADMINISTRATOR') {
      await this.writeFailure('user.disable', userId, result, context);
      throw new ConflictException({
        code: result,
        message: 'The last active administrator cannot be disabled.',
      });
    }

    await this.writeSuccess('user.disable', userId, {}, context);
  }

  public async reactivate(
    userId: string,
    context: UserActionContext,
  ): Promise<TemporaryCredentialResult> {
    const current = await this.getUserOrThrow(userId);
    if (current.status === 'ACTIVE') {
      throw new BadRequestException({
        code: 'USER_ALREADY_ACTIVE',
        message: 'The user is already active.',
      });
    }

    const temporaryPassword = this.credentials.generateTemporaryPassword();
    const passwordHash = await this.passwordHasher.hash(temporaryPassword);
    const result = await this.users.reactivate(userId, passwordHash);
    if (result !== 'ACTIVATED') {
      throw new ConflictException('The user could not be reactivated.');
    }

    const user = await this.getUserOrThrow(userId);
    await this.writeSuccess('user.reactivate', userId, {}, context);
    return { temporaryPassword, user };
  }

  public async resetPassword(
    userId: string,
    context: UserActionContext,
  ): Promise<TemporaryCredentialResult> {
    if (userId === context.actorId) {
      await this.writeFailure('user.password-reset', userId, 'SELF_RESET_NOT_ALLOWED', context);
      throw new BadRequestException({
        code: 'SELF_RESET_NOT_ALLOWED',
        message: 'Administrators must change their own password through the authenticated flow.',
      });
    }

    const current = await this.getUserOrThrow(userId);
    if (current.status === 'DISABLED') {
      throw new BadRequestException({
        code: 'USER_DISABLED',
        message: 'Reactivate the user instead of resetting a disabled account.',
      });
    }

    const temporaryPassword = this.credentials.generateTemporaryPassword();
    const passwordHash = await this.passwordHasher.hash(temporaryPassword);
    const result = await this.users.resetPassword(userId, passwordHash);
    if (result !== 'RESET') {
      throw new ConflictException('The password could not be reset.');
    }

    const user = await this.getUserOrThrow(userId);
    await this.writeSuccess('user.password-reset', userId, {}, context);
    return { temporaryPassword, user };
  }

  private async getUserOrThrow(userId: string): Promise<ManagedUser> {
    const user = await this.users.findById(userId);
    if (user === null) {
      throw new NotFoundException('The user does not exist.');
    }
    return user;
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private normalizeFullName(fullName: string): string {
    return fullName.trim().replace(/\s+/g, ' ');
  }

  private writeSuccess(
    action: string,
    resourceId: string,
    metadata: Record<string, boolean | number | string | null>,
    context: UserActionContext,
  ): Promise<void> {
    return this.audit.write({
      action,
      actorId: context.actorId,
      ipAddress: context.ipAddress,
      metadata,
      resourceId,
      resourceType: 'user',
      result: 'SUCCESS',
      userAgent: context.userAgent,
    });
  }

  private writeFailure(
    action: string,
    resourceId: string | null,
    reason: string,
    context: UserActionContext,
  ): Promise<void> {
    return this.audit.write({
      action,
      actorId: context.actorId,
      ipAddress: context.ipAddress,
      metadata: { reason },
      resourceId,
      resourceType: 'user',
      result: 'FAILURE',
      userAgent: context.userAgent,
    });
  }
}
