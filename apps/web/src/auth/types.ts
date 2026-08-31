export type AuthUser = {
  id: string;
  identityId: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: 'admin';
};

export type UserType = AuthUser | null;

export type AuthState = {
  user: UserType;
  loading: boolean;
};

export type AuthContextValue = {
  user: UserType;
  loading: boolean;
  authenticated: boolean;
  unauthenticated: boolean;
  checkUserSession?: () => Promise<void>;
};
