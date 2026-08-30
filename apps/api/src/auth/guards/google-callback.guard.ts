import type { Request } from 'express';

import { Injectable, type ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleCallbackGuard extends AuthGuard('google') {
  async canActivate(context: ExecutionContext) {
    const canActivate = await (super.canActivate(context) as Promise<boolean>);
    const request = context.switchToHttp().getRequest<Request>();

    await super.logIn(request);
    return canActivate;
  }
}
