import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { Role } from '../../access-control/domain/access-control.js';
import type { AuditEntry, AuditWriter } from '../../auth/application/audit-writer.js';
import type { PasswordHasher } from '../../auth/domain/password-hasher.js';
import type { CredentialGenerator } from '../domain/credential-generator.js';
import type {
  ActivateUserResult,
  CreateUserRecord,
  DisableUserResult,
  ManagedUser,
  ResetPasswordResult,
  UserListQuery,
  UserPage,
  UserRepository,
} from './user.repository.js';
import { DuplicateUserEmailError } from './user-errors.js';
import { UsersService } from './users.service.js';

const administratorId = '6794791f-431b-4167-83b1-0996bda4d774';
const patientId = 'ec8f7c8e-3f26-47ef-b8c9-ea061027ae4d';
const context = {
  actorId: administratorId,
  ipAddress: '127.0.0.1',
  userAgent: 'test-agent',
};

class FakeCredentialGenerator implements CredentialGenerator {
  public generateClinicalCode(): string {
    return 'PAT-2026-ABC234';
  }

  public generateTemporaryPassword(): string {
    return 'temporary-password1';
  }
}

class FakePasswordHasher implements PasswordHasher {
  public hash(password: string): Promise<string> {
    return Promise.resolve(`hashed:${password}`);
  }

  public verify(hash: string, password: string): Promise<boolean> {
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

class FakeUserRepository implements UserRepository {
  public createError: Error | null = null;
  public disableResult: DisableUserResult = 'DISABLED';
  public lastListQuery: UserListQuery | null = null;
  public reactivateResult: ActivateUserResult = 'ACTIVATED';
  public resetResult: ResetPasswordResult = 'RESET';
  public createdInput: CreateUserRecord | null = null;
  public updateError: Error | null = null;
  public updateReturnsNull = false;

  public constructor(public users: ManagedUser[]) {}

  public create(input: CreateUserRecord): Promise<ManagedUser> {
    if (this.createError !== null) {
      throw this.createError;
    }
    this.createdInput = input;
    const user = createUser({
      clinicalCode: input.clinicalCode,
      email: input.email,
      fullName: input.fullName,
      role: input.role,
    });
    this.users.push(user);
    return Promise.resolve(user);
  }

  public disable(): Promise<DisableUserResult> {
    return Promise.resolve(this.disableResult);
  }

  public findByEmail(email: string): Promise<ManagedUser | null> {
    return Promise.resolve(this.users.find((user) => user.email === email) ?? null);
  }

  public findById(userId: string): Promise<ManagedUser | null> {
    return Promise.resolve(this.users.find((user) => user.id === userId) ?? null);
  }

  public list(query: UserListQuery): Promise<UserPage> {
    this.lastListQuery = query;
    return Promise.resolve({
      items: this.users,
      page: query.page,
      pageSize: 20,
      total: this.users.length,
    });
  }

  public reactivate(userId: string): Promise<ActivateUserResult> {
    const user = this.users.find((candidate) => candidate.id === userId);
    if (user !== undefined && this.reactivateResult === 'ACTIVATED') {
      user.status = 'ACTIVE';
      user.mustChangePassword = true;
    }
    return Promise.resolve(this.reactivateResult);
  }

  public resetPassword(): Promise<ResetPasswordResult> {
    return Promise.resolve(this.resetResult);
  }

  public updateProfile(
    userId: string,
    input: { email: string; fullName: string },
  ): Promise<ManagedUser | null> {
    if (this.updateError !== null) {
      throw this.updateError;
    }
    if (this.updateReturnsNull) {
      return Promise.resolve(null);
    }
    const user = this.users.find((candidate) => candidate.id === userId);
    if (user === undefined) {
      return Promise.resolve(null);
    }
    user.email = input.email;
    user.fullName = input.fullName;
    return Promise.resolve(user);
  }
}

function createUser(overrides: Partial<ManagedUser> = {}): ManagedUser {
  return {
    clinicalCode: 'PAT-2026-ABC234',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    email: 'patient@example.test',
    fullName: 'Test Patient',
    id: patientId,
    mustChangePassword: true,
    role: Role.Patient,
    status: 'ACTIVE',
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createService(users: FakeUserRepository, audit = new FakeAuditWriter()): UsersService {
  return new UsersService(users, audit, new FakePasswordHasher(), new FakeCredentialGenerator());
}

describe('UsersService', () => {
  it('creates a patient with generated credentials and an immutable clinical code', async () => {
    const repository = new FakeUserRepository([]);
    const audit = new FakeAuditWriter();

    const result = await createService(repository, audit).create(
      { email: 'PATIENT@EXAMPLE.TEST', fullName: ' Test   Patient ', role: Role.Patient },
      context,
    );

    expect(result.temporaryPassword).toBe('temporary-password1');
    expect(repository.createdInput).toMatchObject({
      clinicalCode: 'PAT-2026-ABC234',
      email: 'patient@example.test',
      fullName: 'Test Patient',
      passwordHash: 'hashed:temporary-password1',
    });
    expect(audit.entries.at(-1)).toMatchObject({ action: 'user.create', result: 'SUCCESS' });
  });

  it('rejects duplicate email addresses', async () => {
    const repository = new FakeUserRepository([createUser()]);

    await expect(
      createService(repository).create(
        { email: 'patient@example.test', fullName: 'Another Patient', role: Role.Patient },
        context,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('handles a concurrent duplicate email during creation', async () => {
    const repository = new FakeUserRepository([]);
    repository.createError = new DuplicateUserEmailError();

    await expect(
      createService(repository).create(
        { email: 'operator@example.test', fullName: 'Test Operator', role: Role.Operator },
        context,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('creates non-patient accounts without a clinical code', async () => {
    const repository = new FakeUserRepository([]);

    await createService(repository).create(
      { email: 'operator@example.test', fullName: 'Test Operator', role: Role.Operator },
      context,
    );

    expect(repository.createdInput?.clinicalCode).toBeNull();
  });

  it('normalizes listing filters before querying the repository', async () => {
    const repository = new FakeUserRepository([]);

    await createService(repository).list({
      page: 2,
      role: Role.Patient,
      search: '  patient  ',
      status: 'ACTIVE',
    });

    expect(repository.lastListQuery).toEqual({
      page: 2,
      role: Role.Patient,
      search: 'patient',
      status: 'ACTIVE',
    });
  });

  it('omits an empty search from listing filters', async () => {
    const repository = new FakeUserRepository([]);

    await createService(repository).list({ page: 1, search: '   ' });

    expect(repository.lastListQuery).toEqual({ page: 1 });
  });

  it('updates the editable profile fields', async () => {
    const repository = new FakeUserRepository([createUser()]);
    const audit = new FakeAuditWriter();

    const user = await createService(repository, audit).updateProfile(
      patientId,
      { email: 'NEW@EXAMPLE.TEST', fullName: ' Updated   Patient ' },
      context,
    );

    expect(user).toMatchObject({ email: 'new@example.test', fullName: 'Updated Patient' });
    expect(audit.entries.at(-1)?.action).toBe('user.update');
  });

  it('rejects updating a profile to another user email', async () => {
    const repository = new FakeUserRepository([
      createUser(),
      createUser({ email: 'existing@example.test', id: '3b938625-a4e8-47f5-b7d2-d9ae652a1753' }),
    ]);

    await expect(
      createService(repository).updateProfile(
        patientId,
        { email: 'existing@example.test', fullName: 'Test Patient' },
        context,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('handles a concurrent duplicate email during profile update', async () => {
    const repository = new FakeUserRepository([createUser()]);
    repository.updateError = new DuplicateUserEmailError();

    await expect(
      createService(repository).updateProfile(
        patientId,
        { email: 'new@example.test', fullName: 'Test Patient' },
        context,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('reports a profile that disappears during update', async () => {
    const repository = new FakeUserRepository([createUser()]);
    repository.updateReturnsNull = true;

    await expect(
      createService(repository).updateProfile(
        patientId,
        { email: 'new@example.test', fullName: 'Test Patient' },
        context,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('prevents an administrator from disabling their own account', async () => {
    const repository = new FakeUserRepository([
      createUser({ id: administratorId, role: Role.Admin }),
    ]);

    await expect(createService(repository).disable(administratorId, context)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('prevents disabling the final active administrator', async () => {
    const repository = new FakeUserRepository([createUser({ role: Role.Admin })]);
    repository.disableResult = 'LAST_ACTIVE_ADMINISTRATOR';

    await expect(createService(repository).disable(patientId, context)).rejects.toThrow(
      ConflictException,
    );
  });

  it('disables an eligible account and audits the action', async () => {
    const repository = new FakeUserRepository([createUser()]);
    const audit = new FakeAuditWriter();

    await createService(repository, audit).disable(patientId, context);

    expect(audit.entries.at(-1)).toMatchObject({ action: 'user.disable', result: 'SUCCESS' });
  });

  it.each([
    ['NOT_FOUND', NotFoundException],
    ['ALREADY_DISABLED', BadRequestException],
  ] as const)('maps the %s disable result to an HTTP error', async (result, errorType) => {
    const repository = new FakeUserRepository([createUser()]);
    repository.disableResult = result;

    await expect(createService(repository).disable(patientId, context)).rejects.toThrow(errorType);
  });

  it('reactivates a disabled user with a new temporary password', async () => {
    const repository = new FakeUserRepository([createUser({ status: 'DISABLED' })]);

    const result = await createService(repository).reactivate(patientId, context);

    expect(result.temporaryPassword).toBe('temporary-password1');
    expect(result.user.status).toBe('ACTIVE');
    expect(result.user.mustChangePassword).toBe(true);
  });

  it('rejects reactivating an active user', async () => {
    const repository = new FakeUserRepository([createUser()]);

    await expect(createService(repository).reactivate(patientId, context)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('reports a conflicting reactivation result', async () => {
    const repository = new FakeUserRepository([createUser({ status: 'DISABLED' })]);
    repository.reactivateResult = 'NOT_FOUND';

    await expect(createService(repository).reactivate(patientId, context)).rejects.toThrow(
      ConflictException,
    );
  });

  it('prevents administrators from resetting their own password', async () => {
    const repository = new FakeUserRepository([
      createUser({ id: administratorId, role: Role.Admin }),
    ]);

    await expect(createService(repository).resetPassword(administratorId, context)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects resetting the password of a disabled user', async () => {
    const repository = new FakeUserRepository([createUser({ status: 'DISABLED' })]);

    await expect(createService(repository).resetPassword(patientId, context)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('resets an active user password and returns the one-time credential', async () => {
    const repository = new FakeUserRepository([createUser()]);
    const audit = new FakeAuditWriter();

    const result = await createService(repository, audit).resetPassword(patientId, context);

    expect(result.temporaryPassword).toBe('temporary-password1');
    expect(audit.entries.at(-1)?.action).toBe('user.password-reset');
  });

  it('reports a conflicting password reset result', async () => {
    const repository = new FakeUserRepository([createUser()]);
    repository.resetResult = 'NOT_FOUND';

    await expect(createService(repository).resetPassword(patientId, context)).rejects.toThrow(
      ConflictException,
    );
  });

  it('returns not found when the target user does not exist', async () => {
    const repository = new FakeUserRepository([]);

    await expect(createService(repository).reactivate(patientId, context)).rejects.toThrow(
      NotFoundException,
    );
  });
});
