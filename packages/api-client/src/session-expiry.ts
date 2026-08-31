type BrowserLocation = Pick<Location, 'pathname' | 'search' | 'hash'>;

const SIGN_IN_PATH = '/auth/jwt/sign-in';
let redirectInProgress = false;

export function sessionExpiryRedirectPath(
  status: number | undefined,
  requestUrl: string | undefined,
  location: BrowserLocation
) {
  if (status !== 401 || requestUrl?.includes('/api/v1/me')) return null;
  if (location.pathname === SIGN_IN_PATH) return null;

  const returnTo = `${location.pathname}${location.search}${location.hash}`;
  const query = new URLSearchParams({ returnTo }).toString();
  return `${SIGN_IN_PATH}?${query}`;
}

export function redirectExpiredSession(status?: number, requestUrl?: string) {
  if (typeof window === 'undefined' || redirectInProgress) return;

  const redirectPath = sessionExpiryRedirectPath(status, requestUrl, window.location);
  if (!redirectPath) return;

  redirectInProgress = true;
  window.location.assign(redirectPath);
}
