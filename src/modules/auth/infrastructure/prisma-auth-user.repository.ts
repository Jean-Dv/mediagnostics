import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../common/infrastructure/database/prisma.service.js';
import { Role } from '../../access-control/domain/access-control.js';
import type { AuthUser, AuthUserRepository } from '../application/auth-user.repository.js';

const maximumFailedAttempts = 5;
const lockDurationMs = 15 * 60 * 1000;

@Injectable()
export class PrismaAuthUserRepository implements AuthUserRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async findByEmail(email: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return user === null ? null : this.toAuthUser(user);
  }

  public async findById(id: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user === null ? null : this.toAuthUser(user);
  }

  public async clearFailedLogins(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  public async recordFailedLogin(userId: string, occurredAt: Date): Promise<void> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    });

    if (user.failedLoginAttempts >= maximumFailedAttempts) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: new Date(occurredAt.getTime() + lockDurationMs),
        },
      });
    }
  }

  public async updatePasswordAndInvalidateSessions(
    userId: string,
    passwordHash: string,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mustChangePassword: false,
        passwordHash,
        sessionVersion: { increment: 1 },
      },
    });
  }

  private toAuthUser(user: {
    email: string;
    fullName: string;
    id: string;
    lockedUntil: Date | null;
    mustChangePassword: boolean;
    passwordHash: string;
    role: string;
    sessionVersion: number;
    status: string;
  }): AuthUser {
    return {
      email: user.email,
      fullName: user.fullName,
      id: user.id,
      lockedUntil: user.lockedUntil,
      mustChangePassword: user.mustChangePassword,
      passwordHash: user.passwordHash,
      role: this.toRole(user.role),
      sessionVersion: user.sessionVersion,
      status: this.toStatus(user.status),
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

  private toStatus(status: string): AuthUser['status'] {
    if (status === 'ACTIVE' || status === 'DISABLED') {
      return status;
    }

    throw new Error(`Unsupported user status: ${status}`);
  }
}
