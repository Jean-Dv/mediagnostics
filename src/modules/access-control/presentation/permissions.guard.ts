import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { hasPermission, type Permission } from '../domain/access-control.js';
import { REQUIRED_PERMISSIONS_KEY } from './access-control.decorators.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  public constructor(private readonly reflector: Reflector) {}

  public canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[] | undefined>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (requiredPermissions === undefined || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const principal = request.user;
    if (
      principal === undefined ||
      !requiredPermissions.every((permission) => hasPermission(principal.role, permission))
    ) {
      throw new ForbiddenException('The current role does not have the required permission.');
    }

    return true;
  }
}
