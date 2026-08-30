export type SessionPrincipal = {
  userId: string;
  identityId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
};

export type GoogleIdentity = {
  issuer: string;
  subject: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  avatarUrl: string | null;
};

declare global {
  // Express uses namespace merging for Passport's request user type.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface User {
      userId: string;
      identityId: string;
      email: string;
      displayName: string;
      avatarUrl: string | null;
    }
  }
}
