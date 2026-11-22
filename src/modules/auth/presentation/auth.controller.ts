import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { loadEnvironment } from '../../../common/config/environment.js';
import { destroySession, regenerateSession, saveSession } from '../../../common/http/session.js';
import type { RequestContext } from '../../../common/types/request-context.js';
import {
  AllowPendingPasswordChange,
  Public,
} from '../../access-control/presentation/access-control.decorators.js';
import { AuthService } from '../application/auth.service.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { SessionResponseDto } from './dto/session-response.dto.js';

const sessionCookieName = 'mediagnostics.sid';

@ApiTags('authentication')
@ApiCookieAuth(sessionCookieName)
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  public constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOkResponse({ type: SessionResponseDto })
  @ApiUnauthorizedResponse({ description: 'The credentials are invalid.' })
  public async login(@Body() body: LoginDto, @Req() request: Request): Promise<SessionResponseDto> {
    const principal = await this.authService.authenticate(
      body.email,
      body.password,
      this.getRequestContext(request),
    );
    await regenerateSession(request.session);

    const { sessionAbsoluteTimeoutMs } = loadEnvironment();
    request.session.user = {
      ...principal,
      absoluteExpiresAt: new Date(Date.now() + sessionAbsoluteTimeoutMs).toISOString(),
    };
    await saveSession(request.session);

    return this.toResponse(request.session.user);
  }

  @AllowPendingPasswordChange()
  @Get('me')
  @ApiOkResponse({ type: SessionResponseDto })
  public getCurrentSession(@Req() request: Request): SessionResponseDto {
    const principal = request.user;
    if (principal === undefined) {
      throw new UnauthorizedException('Authentication is required.');
    }

    return this.toResponse(principal);
  }

  @AllowPendingPasswordChange()
  @Post('logout')
  @HttpCode(204)
  @ApiNoContentResponse()
  public async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const principal = request.user;
    if (principal !== undefined) {
      await this.authService.recordLogout(principal.id, this.getRequestContext(request));
    }
    await destroySession(request.session);
    response.clearCookie(sessionCookieName, { path: '/' });
  }

  @AllowPendingPasswordChange()
  @Post('change-password')
  @HttpCode(204)
  @ApiNoContentResponse()
  public async changePassword(
    @Body() body: ChangePasswordDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const principal = request.user;
    if (principal === undefined) {
      throw new UnauthorizedException('Authentication is required.');
    }

    await this.authService.changePassword(
      principal.id,
      body.currentPassword,
      body.newPassword,
      this.getRequestContext(request),
    );
    await destroySession(request.session);
    response.clearCookie(sessionCookieName, { path: '/' });
  }

  private getRequestContext(request: Request): RequestContext {
    return {
      ipAddress: request.ip ?? null,
      userAgent: request.get('user-agent')?.slice(0, 512) ?? null,
    };
  }

  private toResponse(principal: {
    email: string;
    fullName: string;
    id: string;
    mustChangePassword: boolean;
    role: SessionResponseDto['role'];
  }): SessionResponseDto {
    return {
      email: principal.email,
      fullName: principal.fullName,
      id: principal.id,
      passwordChangeRequired: principal.mustChangePassword,
      role: principal.role,
    };
  }
}
