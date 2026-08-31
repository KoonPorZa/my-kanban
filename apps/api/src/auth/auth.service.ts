import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../database/prisma.service';
import type { GoogleIdentity, SessionPrincipal } from './auth.types';

const DEFAULT_COLUMNS = ['Backlog', 'To do', 'In progress', 'Done'] as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  isEmailAllowed(email: string) {
    return this.allowedEmails().has(email.trim().toLowerCase());
  }

  async authenticateGoogle(identity: GoogleIdentity): Promise<SessionPrincipal> {
    const email = identity.email.trim().toLowerCase();

    if (!identity.emailVerified || !this.isEmailAllowed(email)) {
      throw new UnauthorizedException('Google account is not authorized');
    }

    const authIdentity = await this.prisma.$transaction(async (transaction) => {
      const existingIdentity = await transaction.authIdentity.findUnique({
        where: {
          provider_providerSubject: {
            provider: identity.issuer,
            providerSubject: identity.subject,
          },
        },
      });

      if (existingIdentity) {
        return transaction.authIdentity.update({
          where: { id: existingIdentity.id },
          data: {
            email,
            emailVerified: true,
            lastLoginAt: new Date(),
            user: {
              update: {
                displayName: identity.displayName,
                avatarUrl: identity.avatarUrl,
              },
            },
          },
          include: { user: true },
        });
      }

      const ownerIdentity = await transaction.authIdentity.findFirst({
        where: { email: { in: [...this.allowedEmails()] } },
        include: { user: true },
      });

      let user = ownerIdentity?.user;

      if (!user) {
        user = await transaction.user.create({
          data: {
            displayName: identity.displayName,
            avatarUrl: identity.avatarUrl,
          },
        });
        const workspace = await transaction.workspace.create({
          data: { ownerId: user.id, name: 'My workspace' },
        });
        const project = await transaction.project.create({
          data: { workspaceId: workspace.id, name: 'My Kanban' },
        });
        await transaction.boardColumn.createMany({
          data: DEFAULT_COLUMNS.map((name, index) => ({
            projectId: project.id,
            name,
            rank: BigInt((index + 1) * 1000),
          })),
        });
        await transaction.workspace.update({
          where: { id: workspace.id },
          data: { activeProjectId: project.id },
        });
      } else {
        user = await transaction.user.update({
          where: { id: user.id },
          data: {
            displayName: identity.displayName,
            avatarUrl: identity.avatarUrl,
          },
        });
      }

      return transaction.authIdentity.create({
        data: {
          userId: user.id,
          provider: identity.issuer,
          providerSubject: identity.subject,
          email,
          emailVerified: true,
          lastLoginAt: new Date(),
        },
        include: { user: true },
      });
    });

    return this.toPrincipal(authIdentity);
  }

  async findSessionPrincipal(identityId: string): Promise<SessionPrincipal | null> {
    const identity = await this.prisma.authIdentity.findUnique({
      where: { id: identityId },
      include: { user: true },
    });

    if (!identity?.emailVerified || !this.isEmailAllowed(identity.email)) return null;

    return this.toPrincipal(identity);
  }

  private allowedEmails() {
    return new Set(
      this.config
        .getOrThrow<string>('ALLOWED_GOOGLE_EMAILS')
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
    );
  }

  private toPrincipal(identity: {
    id: string;
    email: string;
    user: { id: string; displayName: string; avatarUrl: string | null };
  }): SessionPrincipal {
    return {
      userId: identity.user.id,
      identityId: identity.id,
      email: identity.email,
      displayName: identity.user.displayName,
      avatarUrl: identity.user.avatarUrl,
    };
  }
}
