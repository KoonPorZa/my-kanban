import { paths } from 'src/routes/paths';

type BrowserLocation = Pick<Location, 'pathname' | 'search' | 'hash'>;

export function sessionExpiryRedirectPath(
  status: number | undefined,
  requestUrl: string | undefined,
  location: BrowserLocation
) {
  if (status !== 401 || requestUrl?.includes('/api/v1/me')) return null;
  if (location.pathname === paths.auth.jwt.signIn) return null;

  const returnTo = `${location.pathname}${location.search}${location.hash}`;
  const query = new URLSearchParams({ returnTo }).toString();
  return `${paths.auth.jwt.signIn}?${query}`;
}

export function redirectExpiredSession(status?: number, requestUrl?: string) {
  if (typeof window === 'undefined') return;

  const redirectPath = sessionExpiryRedirectPath(status, requestUrl, window.location);
  if (redirectPath) window.location.assign(redirectPath);
}
