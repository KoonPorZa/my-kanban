import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { SessionPrincipal } from '../auth.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SessionPrincipal =>
    context.switchToHttp().getRequest<{ user: SessionPrincipal }>().user
);
