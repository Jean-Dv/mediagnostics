import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { destroySession } from '../../../common/http/session.js';
import {
  AUTH_USER_REPOSITORY,
  type AuthUserRepository,
} from '../../auth/application/auth-user.repository.js';
import { ALLOW_PENDING_PASSWORD_CHANGE_KEY, IS_PUBLIC_KEY } from './access-control.decorators.js';

@Injectable()
export class AuthenticationGuard implements CanActivate {
  public constructor(
    private readonly reflector: Reflector,
    @Inject(AUTH_USER_REPOSITORY)
    private readonly users: AuthUserRepository,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const principal = request.session.user;
    if (principal === undefined) {
      throw new UnauthorizedException('Authentication is required.');
    }

    const absoluteExpiration = Date.parse(principal.absoluteExpiresAt);
    const user = await this.users.findById(principal.id);
    if (
      !Number.isFinite(absoluteExpiration) ||
      absoluteExpiration <= Date.now() ||
      user?.status !== 'ACTIVE' ||
      user.sessionVersion !== principal.sessionVersion
    ) {
      await destroySession(request.session);
      throw new UnauthorizedException('The session is no longer valid.');
    }

    const allowsPendingPasswordChange = this.reflector.getAllAndOverride<boolean | undefined>(
      ALLOW_PENDING_PASSWORD_CHANGE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (user.mustChangePassword && !allowsPendingPasswordChange) {
      throw new ForbiddenException({
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'The temporary password must be changed before continuing.',
      });
    }

    request.user = {
      ...principal,
      mustChangePassword: user.mustChangePassword,
      role: user.role,
    };
    return true;
  }
}
