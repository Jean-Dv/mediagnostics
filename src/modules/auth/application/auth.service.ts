import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';

import type { AuthenticatedPrincipal } from '../../../common/types/authenticated-principal.js';
import type { RequestContext } from '../../../common/types/request-context.js';
import { AUTH_USER_REPOSITORY, type AuthUserRepository } from './auth-user.repository.js';
import { AUDIT_WRITER, type AuditWriter } from './audit-writer.js';
import { PASSWORD_HASHER, type PasswordHasher } from '../domain/password-hasher.js';

const invalidCredentialsMessage = 'The email or password is invalid.';

@Injectable()
export class AuthService {
  private dummyHash: Promise<string> | undefined;

  public constructor(
    @Inject(AUTH_USER_REPOSITORY)
    private readonly users: AuthUserRepository,
    @Inject(AUDIT_WRITER)
    private readonly audit: AuditWriter,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasher,
  ) {}

  public async authenticate(
    email: string,
    password: string,
    context: RequestContext,
  ): Promise<Omit<AuthenticatedPrincipal, 'absoluteExpiresAt'>> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.users.findByEmail(normalizedEmail);

    if (user === null) {
      await this.passwordHasher.verify(await this.getDummyHash(), password);
      await this.audit.write({
        action: 'auth.login',
        actorId: null,
        ipAddress: context.ipAddress,
        metadata: { reason: 'INVALID_CREDENTIALS' },
        resourceId: null,
        resourceType: 'user',
        result: 'FAILURE',
        userAgent: context.userAgent,
      });
      throw new UnauthorizedException(invalidCredentialsMessage);
    }

    if (user.lockedUntil !== null && user.lockedUntil.getTime() > Date.now()) {
      await this.writeLoginFailure(user.id, 'ACCOUNT_LOCKED', context);
      throw new UnauthorizedException(invalidCredentialsMessage);
    }

    if (user.lockedUntil !== null) {
      await this.users.clearFailedLogins(user.id);
    }

    const passwordIsValid = await this.passwordHasher.verify(user.passwordHash, password);
    if (!passwordIsValid || user.status !== 'ACTIVE') {
      if (!passwordIsValid) {
        await this.users.recordFailedLogin(user.id, new Date());
      }
      await this.writeLoginFailure(
        user.id,
        user.status === 'ACTIVE' ? 'INVALID_CREDENTIALS' : 'ACCOUNT_DISABLED',
        context,
      );
      throw new UnauthorizedException(invalidCredentialsMessage);
    }

    await this.users.clearFailedLogins(user.id);
    await this.audit.write({
      action: 'auth.login',
      actorId: user.id,
      ipAddress: context.ipAddress,
      metadata: {},
      resourceId: user.id,
      resourceType: 'user',
      result: 'SUCCESS',
      userAgent: context.userAgent,
    });

    return {
      email: user.email,
      fullName: user.fullName,
      id: user.id,
      mustChangePassword: user.mustChangePassword,
      role: user.role,
      sessionVersion: user.sessionVersion,
    };
  }

  public async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    context: RequestContext,
  ): Promise<void> {
    const user = await this.users.findById(userId);
    if (user === null || !(await this.passwordHasher.verify(user.passwordHash, currentPassword))) {
      await this.audit.write({
        action: 'auth.password-change',
        actorId: userId,
        ipAddress: context.ipAddress,
        metadata: { reason: 'INVALID_CURRENT_PASSWORD' },
        resourceId: userId,
        resourceType: 'user',
        result: 'FAILURE',
        userAgent: context.userAgent,
      });
      throw new UnauthorizedException('The current password is invalid.');
    }

    if (await this.passwordHasher.verify(user.passwordHash, newPassword)) {
      throw new BadRequestException({
        code: 'PASSWORD_REUSE_NOT_ALLOWED',
        message: 'The new password must be different from the current password.',
      });
    }

    const passwordHash = await this.passwordHasher.hash(newPassword);
    await this.users.updatePasswordAndInvalidateSessions(userId, passwordHash);
    await this.audit.write({
      action: 'auth.password-change',
      actorId: userId,
      ipAddress: context.ipAddress,
      metadata: {},
      resourceId: userId,
      resourceType: 'user',
      result: 'SUCCESS',
      userAgent: context.userAgent,
    });
  }

  public async recordLogout(userId: string, context: RequestContext): Promise<void> {
    await this.audit.write({
      action: 'auth.logout',
      actorId: userId,
      ipAddress: context.ipAddress,
      metadata: {},
      resourceId: userId,
      resourceType: 'user',
      result: 'SUCCESS',
      userAgent: context.userAgent,
    });
  }

  private async writeLoginFailure(
    userId: string,
    reason: string,
    context: RequestContext,
  ): Promise<void> {
    await this.audit.write({
      action: 'auth.login',
      actorId: userId,
      ipAddress: context.ipAddress,
      metadata: { reason },
      resourceId: userId,
      resourceType: 'user',
      result: 'FAILURE',
      userAgent: context.userAgent,
    });
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.passwordHasher.hash('dummy password used to equalize login timing');
    return this.dummyHash;
  }
}
