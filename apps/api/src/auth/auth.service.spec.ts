import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../database/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let authService: AuthService;
  let findUnique: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    findUnique = vi.fn();
    const prisma = {
      authIdentity: { findUnique },
      $transaction: vi.fn(),
    } as unknown as PrismaService;
    const config = {
      getOrThrow: vi.fn(() => 'owner@example.com, second@example.com'),
    } as unknown as ConfigService;

    authService = new AuthService(prisma, config);
  });

  it('normalizes the environment email allowlist', () => {
    expect(authService.isEmailAllowed(' OWNER@example.com ')).toBe(true);
    expect(authService.isEmailAllowed('outsider@example.com')).toBe(false);
  });

  it('rejects a Google identity without a verified email', async () => {
    await expect(
      authService.authenticateGoogle({
        issuer: 'https://accounts.google.com',
        subject: 'google-subject',
        email: 'owner@example.com',
        emailVerified: false,
        displayName: 'Owner',
        avatarUrl: null,
      })
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a Google identity outside the allowlist', async () => {
    await expect(
      authService.authenticateGoogle({
        issuer: 'https://accounts.google.com',
        subject: 'google-subject',
        email: 'outsider@example.com',
        emailVerified: true,
        displayName: 'Outsider',
        avatarUrl: null,
      })
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('restores an allowed, verified session principal', async () => {
    findUnique.mockResolvedValue({
      id: 'identity-id',
      email: 'owner@example.com',
      emailVerified: true,
      user: {
        id: 'user-id',
        displayName: 'Owner',
        avatarUrl: null,
      },
    });

    await expect(authService.findSessionPrincipal('identity-id')).resolves.toEqual({
      userId: 'user-id',
      identityId: 'identity-id',
      email: 'owner@example.com',
      displayName: 'Owner',
      avatarUrl: null,
    });
  });
});
