import { Injectable } from '@nestjs/common';
import { PassportSerializer } from '@nestjs/passport';

import { AuthService } from './auth.service';
import type { SessionPrincipal } from './auth.types';

@Injectable()
export class SessionSerializer extends PassportSerializer {
  constructor(private readonly authService: AuthService) {
    super();
  }

  serializeUser(user: SessionPrincipal, done: (error: Error | null, id?: string) => void) {
    done(null, user.identityId);
  }

  async deserializeUser(
    identityId: string,
    done: (error: Error | null, user?: SessionPrincipal | false) => void
  ) {
    try {
      const principal = await this.authService.findSessionPrincipal(identityId);
      done(null, principal ?? false);
    } catch (error) {
      done(error instanceof Error ? error : new Error('Unable to restore session'));
    }
  }
}
