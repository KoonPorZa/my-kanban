import type { AuthUser } from '../../types';

export type SessionPrincipalResponse = {
  userId: string;
  identityId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
};

export function toAuthUser(principal: SessionPrincipalResponse): AuthUser {
  return {
    id: principal.userId,
    identityId: principal.identityId,
    email: principal.email,
    displayName: principal.displayName,
    photoURL: principal.avatarUrl,
    role: 'admin',
  };
}
