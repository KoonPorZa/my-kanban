import type { Request, Response } from 'express';

import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';

import type { SessionPrincipal } from './auth.types';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { GoogleCallbackGuard } from './guards/google-callback.guard';

@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(private readonly config: ConfigService) {}

  @Public()
  @Get('auth/google')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Start Google OpenID Connect login' })
  loginWithGoogle() {}

  @Public()
  @Get('auth/google/callback')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseGuards(GoogleCallbackGuard)
  @ApiOperation({ summary: 'Complete Google OpenID Connect login' })
  googleCallback(@Res() response: Response) {
    response.redirect(`${this.config.getOrThrow<string>('APP_ORIGIN')}/dashboard/kanban`);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get the authenticated owner profile' })
  me(@CurrentUser() user: SessionPrincipal) {
    return user;
  }

  @Post('auth/logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Destroy the current login session' })
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await new Promise<void>((resolve, reject) => {
      request.logout((error) =>
        error ? reject(error instanceof Error ? error : new Error('Logout failed')) : resolve()
      );
    });
    await new Promise<void>((resolve, reject) => {
      request.session.destroy((error) =>
        error
          ? reject(error instanceof Error ? error : new Error('Session cleanup failed'))
          : resolve()
      );
    });
    response.clearCookie('kanban.sid');
  }
}
