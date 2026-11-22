import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { Role } from '../../access-control/domain/access-control.js';
import { AuthService } from './auth.service.js';
import type { AuthUser, AuthUserRepository } from './auth-user.repository.js';
import type { AuditEntry, AuditWriter } from './audit-writer.js';
import type { PasswordHasher } from '../domain/password-hasher.js';

const context = { ipAddress: '127.0.0.1', userAgent: 'test-agent' };

class FakePasswordHasher implements PasswordHasher {
  public async hash(password: string): Promise<string> {
    return Promise.resolve(`hashed:${password}`);
  }

  public async verify(hash: string, password: string): Promise<boolean> {
    return Promise.resolve(hash === `hashed:${password}`);
  }
}

class FakeAuditWriter implements AuditWriter {
  public readonly entries: AuditEntry[] = [];

  public write(entry: AuditEntry): Promise<void> {
    this.entries.push(entry);
    return Promise.resolve();
  }
}

class FakeAuthUserRepository implements AuthUserRepository {
  public clearedLoginCount = 0;
  public failedLoginCount = 0;
  public passwordUpdate: string | null = null;

  public constructor(public user: AuthUser | null) {}

  public clearFailedLogins(): Promise<void> {
    this.clearedLoginCount += 1;
    return Promise.resolve();
  }

  public findByEmail(): Promise<AuthUser | null> {
    return Promise.resolve(this.user);
  }

  public findById(): Promise<AuthUser | null> {
    return Promise.resolve(this.user);
  }

  public recordFailedLogin(): Promise<void> {
    this.failedLoginCount += 1;
    return Promise.resolve();
  }

  public updatePasswordAndInvalidateSessions(_userId: string, passwordHash: string): Promise<void> {
    this.passwordUpdate = passwordHash;
    return Promise.resolve();
  }
}

function createUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    email: 'patient@example.test',
    fullName: 'Test Patient',
    id: '5d94a9d8-130b-42ec-92e1-b77a50c65dc3',
    lockedUntil: null,
    mustChangePassword: false,
    passwordHash: 'hashed:a sufficiently long password',
    role: Role.Patient,
    sessionVersion: 0,
    status: 'ACTIVE',
    ...overrides,
  };
}

describe('AuthService', () => {
  it('authenticates an active user and writes a successful audit event', async () => {
    const users = new FakeAuthUserRepository(createUser());
    const audit = new FakeAuditWriter();
    const service = new AuthService(users, audit, new FakePasswordHasher());

    const principal = await service.authenticate(
      'PATIENT@example.test',
      'a sufficiently long password',
      context,
    );

    expect(principal.email).toBe('patient@example.test');
    expect(audit.entries.at(-1)?.result).toBe('SUCCESS');
  });

  it('records a failed login without exposing whether the user exists', async () => {
    const users = new FakeAuthUserRepository(createUser());
    const audit = new FakeAuditWriter();
    const service = new AuthService(users, audit, new FakePasswordHasher());

    await expect(
      service.authenticate('patient@example.test', 'wrong password', context),
    ).rejects.toThrow(UnauthorizedException);

    expect(users.failedLoginCount).toBe(1);
    expect(audit.entries.at(-1)).toMatchObject({
      action: 'auth.login',
      result: 'FAILURE',
    });
  });

  it('rejects a disabled account even when its password is valid', async () => {
    const users = new FakeAuthUserRepository(createUser({ status: 'DISABLED' }));
    const service = new AuthService(users, new FakeAuditWriter(), new FakePasswordHasher());

    await expect(
      service.authenticate('patient@example.test', 'a sufficiently long password', context),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('updates a password and invalidates existing sessions', async () => {
    const users = new FakeAuthUserRepository(createUser());
    const audit = new FakeAuditWriter();
    const service = new AuthService(users, audit, new FakePasswordHasher());

    await service.changePassword(
      '5d94a9d8-130b-42ec-92e1-b77a50c65dc3',
      'a sufficiently long password',
      'a new sufficiently long password',
      context,
    );

    expect(users.passwordUpdate).toBe('hashed:a new sufficiently long password');
    expect(audit.entries.at(-1)?.action).toBe('auth.password-change');
  });

  it('uses a dummy hash and a generic error when the email does not exist', async () => {
    const audit = new FakeAuditWriter();
    const service = new AuthService(
      new FakeAuthUserRepository(null),
      audit,
      new FakePasswordHasher(),
    );

    await expect(
      service.authenticate('missing@example.test', 'wrong password', context),
    ).rejects.toThrow(UnauthorizedException);

    expect(audit.entries.at(-1)).toMatchObject({ actorId: null, result: 'FAILURE' });
  });

  it('rejects a currently locked account without checking its password', async () => {
    const audit = new FakeAuditWriter();
    const service = new AuthService(
      new FakeAuthUserRepository(createUser({ lockedUntil: new Date(Date.now() + 60_000) })),
      audit,
      new FakePasswordHasher(),
    );

    await expect(
      service.authenticate('patient@example.test', 'a sufficiently long password', context),
    ).rejects.toThrow(UnauthorizedException);

    expect(audit.entries.at(-1)?.metadata).toEqual({ reason: 'ACCOUNT_LOCKED' });
  });

  it('clears an expired lock before authenticating', async () => {
    const users = new FakeAuthUserRepository(
      createUser({ lockedUntil: new Date(Date.now() - 60_000) }),
    );
    const service = new AuthService(users, new FakeAuditWriter(), new FakePasswordHasher());

    await service.authenticate('patient@example.test', 'a sufficiently long password', context);

    expect(users.clearedLoginCount).toBe(2);
  });

  it('rejects an invalid current password and audits the failure', async () => {
    const audit = new FakeAuditWriter();
    const service = new AuthService(
      new FakeAuthUserRepository(createUser()),
      audit,
      new FakePasswordHasher(),
    );

    await expect(
      service.changePassword('user-id', 'wrong password', 'a new secure password', context),
    ).rejects.toThrow(UnauthorizedException);

    expect(audit.entries.at(-1)).toMatchObject({
      action: 'auth.password-change',
      result: 'FAILURE',
    });
  });

  it('rejects reusing the current password', async () => {
    const service = new AuthService(
      new FakeAuthUserRepository(createUser()),
      new FakeAuditWriter(),
      new FakePasswordHasher(),
    );

    await expect(
      service.changePassword(
        'user-id',
        'a sufficiently long password',
        'a sufficiently long password',
        context,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('records a successful logout', async () => {
    const audit = new FakeAuditWriter();
    const service = new AuthService(
      new FakeAuthUserRepository(createUser()),
      audit,
      new FakePasswordHasher(),
    );

    await service.recordLogout('user-id', context);

    expect(audit.entries.at(-1)).toMatchObject({ action: 'auth.logout', result: 'SUCCESS' });
  });
});
