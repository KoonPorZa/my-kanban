import type { Profile } from 'passport';
import GoogleOidcStrategy from 'passport-google-oidc';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';

import { AuthService } from './auth.service';

type GoogleIdClaims = {
  email?: string;
  email_verified?: boolean;
  picture?: string;
};

@Injectable()
export class GoogleStrategy extends PassportStrategy(GoogleOidcStrategy, 'google', true) {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService
  ) {
    super({
      clientID: config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      clientSecret: config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: config.getOrThrow<string>('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
      nonce: 'required',
    });
  }

  validate(_issuer: string, profile: Profile, _context: object, idToken: string | object) {
    const claims = decodeIdToken(idToken);
    const email = claims.email ?? profile.emails?.[0]?.value;

    if (!email || claims.email_verified !== true) {
      throw new UnauthorizedException('Google account is not authorized');
    }

    return this.authService.authenticateGoogle({
      issuer: 'https://accounts.google.com',
      subject: profile.id,
      email,
      emailVerified: true,
      displayName: profile.displayName || email,
      avatarUrl: claims.picture ?? profile.photos?.[0]?.value ?? null,
    });
  }
}

function decodeIdToken(idToken: string | object): GoogleIdClaims {
  if (typeof idToken !== 'string') return idToken;

  const payload = idToken.split('.')[1];
  if (!payload) throw new UnauthorizedException('Invalid Google identity token');

  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as GoogleIdClaims;
  } catch {
    throw new UnauthorizedException('Invalid Google identity token');
  }
}
