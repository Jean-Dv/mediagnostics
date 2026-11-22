import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../common/infrastructure/database/prisma.service.js';
import type { User } from '../../../generated/prisma/client.js';
import { Prisma } from '../../../generated/prisma/client.js';
import { Role } from '../../access-control/domain/access-control.js';
import { DuplicateUserEmailError } from '../application/user-errors.js';
import type {
  ActivateUserResult,
  CreateUserRecord,
  DisableUserResult,
  ManagedUser,
  ManagedUserStatus,
  ResetPasswordResult,
  UserListQuery,
  UserPage,
  UserRepository,
} from '../application/user.repository.js';

const pageSize = 20;

@Injectable()
export class PrismaUserRepository implements UserRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async create(input: CreateUserRecord): Promise<ManagedUser> {
    try {
      const user = await this.prisma.user.create({
        data: {
          clinicalCode: input.clinicalCode,
          email: input.email,
          fullName: input.fullName,
          passwordHash: input.passwordHash,
          role: input.role,
        },
      });
      return this.toManagedUser(user);
    } catch (error: unknown) {
      if (this.isEmailUniqueViolation(error)) {
        throw new DuplicateUserEmailError();
      }
      throw error;
    }
  }

  public async findByEmail(email: string): Promise<ManagedUser | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return user === null ? null : this.toManagedUser(user);
  }

  public async findById(userId: string): Promise<ManagedUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return user === null ? null : this.toManagedUser(user);
  }

  public async list(query: UserListQuery): Promise<UserPage> {
    const where: Prisma.UserWhereInput = {
      ...(query.role === undefined ? {} : { role: query.role }),
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.search === undefined
        ? {}
        : {
            OR: [
              { clinicalCode: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { fullName: { contains: query.search, mode: 'insensitive' } },
            ],
          }),
    };
    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * pageSize,
        take: pageSize,
        where,
      }),
    ]);

    return {
      items: users.map((user) => this.toManagedUser(user)),
      page: query.page,
      pageSize,
      total,
    };
  }

  public async updateProfile(
    userId: string,
    input: { email: string; fullName: string },
  ): Promise<ManagedUser | null> {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (current === null) {
      return null;
    }

    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          email: input.email,
          fullName: input.fullName,
          ...(current.email === input.email ? {} : { sessionVersion: { increment: 1 } }),
        },
      });
      return this.toManagedUser(user);
    } catch (error: unknown) {
      if (this.isEmailUniqueViolation(error)) {
        throw new DuplicateUserEmailError();
      }
      throw error;
    }
  }

  public disable(userId: string): Promise<DisableUserResult> {
    return this.prisma.$transaction(async (transactionClient) => {
      const transaction = transactionClient as unknown as Prisma.TransactionClient;
      const user = await transaction.user.findUnique({ where: { id: userId } });
      if (user === null) {
        return 'NOT_FOUND';
      }
      if (user.status === 'DISABLED') {
        return 'ALREADY_DISABLED';
      }

      if (user.role === 'ADMIN') {
        const activeAdministrators = await transaction.$queryRaw<{ id: string }[]>`
          SELECT "id"
          FROM "users"
          WHERE "role" = 'ADMIN'::"Role" AND "status" = 'ACTIVE'::"UserStatus"
          FOR UPDATE
        `;
        if (activeAdministrators.length <= 1) {
          return 'LAST_ACTIVE_ADMINISTRATOR';
        }
      }

      await transaction.user.update({
        where: { id: userId },
        data: { sessionVersion: { increment: 1 }, status: 'DISABLED' },
      });
      return 'DISABLED';
    });
  }

  public async reactivate(userId: string, passwordHash: string): Promise<ActivateUserResult> {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    if (current === null) {
      return 'NOT_FOUND';
    }
    if (current.status === 'ACTIVE') {
      return 'ALREADY_ACTIVE';
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        mustChangePassword: true,
        passwordHash,
        sessionVersion: { increment: 1 },
        status: 'ACTIVE',
      },
    });
    return 'ACTIVATED';
  }

  public async resetPassword(userId: string, passwordHash: string): Promise<ResetPasswordResult> {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    if (current === null) {
      return 'NOT_FOUND';
    }
    if (current.status === 'DISABLED') {
      return 'DISABLED';
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        mustChangePassword: true,
        passwordHash,
        sessionVersion: { increment: 1 },
      },
    });
    return 'RESET';
  }

  private isEmailUniqueViolation(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return false;
    }
    if (error.code !== 'P2002') {
      return false;
    }

    return JSON.stringify('meta' in error ? error.meta : '').includes('email');
  }

  private toManagedUser(user: User): ManagedUser {
    return {
      clinicalCode: user.clinicalCode,
      createdAt: user.createdAt,
      email: user.email,
      fullName: user.fullName,
      id: user.id,
      mustChangePassword: user.mustChangePassword,
      role: this.toRole(user.role),
      status: this.toStatus(user.status),
      updatedAt: user.updatedAt,
    };
  }

  private toRole(role: string): Role {
    switch (role) {
      case 'ADMIN':
        return Role.Admin;
      case 'OPERATOR':
        return Role.Operator;
      case 'PATIENT':
        return Role.Patient;
      default:
        throw new Error(`Unsupported role: ${role}`);
    }
  }

  private toStatus(status: string): ManagedUserStatus {
    if (status === 'ACTIVE' || status === 'DISABLED') {
      return status;
    }
    throw new Error(`Unsupported user status: ${status}`);
  }
}
