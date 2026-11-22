import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import type { RequestContext } from '../../../common/types/request-context.js';
import { Permission } from '../../access-control/domain/access-control.js';
import { RequirePermissions } from '../../access-control/presentation/access-control.decorators.js';
import type { ManagedUser, UserPage } from '../application/user.repository.js';
import { UsersService, type UserActionContext } from '../application/users.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import {
  PaginatedUsersResponseDto,
  TemporaryCredentialResponseDto,
  UserSummaryDto,
} from './dto/user-response.dto.js';

@ApiTags('users')
@ApiCookieAuth('mediagnostics.sid')
@Controller({ path: 'users', version: '1' })
export class UsersController {
  public constructor(private readonly usersService: UsersService) {}

  @Post()
  @RequirePermissions(Permission.UserCreate, Permission.RoleAssign)
  @ApiCreatedResponse({ type: TemporaryCredentialResponseDto })
  public async create(
    @Body() body: CreateUserDto,
    @Req() request: Request,
  ): Promise<TemporaryCredentialResponseDto> {
    const result = await this.usersService.create(body, this.getActionContext(request));
    return {
      temporaryPassword: result.temporaryPassword,
      user: this.toUserSummary(result.user),
    };
  }

  @Get()
  @RequirePermissions(Permission.UserRead)
  @ApiOkResponse({ type: PaginatedUsersResponseDto })
  public async list(@Query() query: ListUsersQueryDto): Promise<PaginatedUsersResponseDto> {
    const page = await this.usersService.list(query);
    return this.toPageResponse(page);
  }

  @Patch(':id')
  @RequirePermissions(Permission.UserUpdate)
  @ApiOkResponse({ type: UserSummaryDto })
  public async update(
    @Body() body: UpdateUserDto,
    @Req() request: Request,
    @Param('id', new ParseUUIDPipe({ version: '4' })) userId: string,
  ): Promise<UserSummaryDto> {
    const user = await this.usersService.updateProfile(
      userId,
      body,
      this.getActionContext(request),
    );
    return this.toUserSummary(user);
  }

  @Post(':id/disable')
  @HttpCode(204)
  @RequirePermissions(Permission.UserDisable)
  @ApiNoContentResponse()
  public disable(
    @Req() request: Request,
    @Param('id', new ParseUUIDPipe({ version: '4' })) userId: string,
  ): Promise<void> {
    return this.usersService.disable(userId, this.getActionContext(request));
  }

  @Post(':id/reactivate')
  @HttpCode(200)
  @RequirePermissions(Permission.UserReactivate)
  @ApiOkResponse({ type: TemporaryCredentialResponseDto })
  public async reactivate(
    @Req() request: Request,
    @Param('id', new ParseUUIDPipe({ version: '4' })) userId: string,
  ): Promise<TemporaryCredentialResponseDto> {
    const result = await this.usersService.reactivate(userId, this.getActionContext(request));
    return {
      temporaryPassword: result.temporaryPassword,
      user: this.toUserSummary(result.user),
    };
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  @RequirePermissions(Permission.UserPasswordReset)
  @ApiOkResponse({ type: TemporaryCredentialResponseDto })
  public async resetPassword(
    @Req() request: Request,
    @Param('id', new ParseUUIDPipe({ version: '4' })) userId: string,
  ): Promise<TemporaryCredentialResponseDto> {
    const result = await this.usersService.resetPassword(userId, this.getActionContext(request));
    return {
      temporaryPassword: result.temporaryPassword,
      user: this.toUserSummary(result.user),
    };
  }

  private getActionContext(request: Request): UserActionContext {
    const principal = request.user;
    if (principal === undefined) {
      throw new UnauthorizedException('Authentication is required.');
    }

    return {
      actorId: principal.id,
      ...this.getRequestContext(request),
    };
  }

  private getRequestContext(request: Request): RequestContext {
    return {
      ipAddress: request.ip ?? null,
      userAgent: request.get('user-agent')?.slice(0, 512) ?? null,
    };
  }

  private toPageResponse(page: UserPage): PaginatedUsersResponseDto {
    return {
      items: page.items.map((user) => this.toUserSummary(user)),
      page: page.page,
      pageSize: page.pageSize,
      total: page.total,
    };
  }

  private toUserSummary(user: ManagedUser): UserSummaryDto {
    return {
      clinicalCode: user.clinicalCode,
      createdAt: user.createdAt.toISOString(),
      email: user.email,
      fullName: user.fullName,
      id: user.id,
      passwordChangeRequired: user.mustChangePassword,
      role: user.role,
      status: user.status,
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
