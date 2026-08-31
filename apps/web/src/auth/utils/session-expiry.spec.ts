import { it, expect, describe } from 'vitest';

import { sessionExpiryRedirectPath } from './session-expiry';

const dashboardLocation = {
  pathname: '/dashboard/kanban',
  search: '?focus=true',
  hash: '#task',
};

describe('sessionExpiryRedirectPath', () => {
  it('redirects a failed protected action to login with the full return path', () => {
    expect(sessionExpiryRedirectPath(401, '/api/v1/issues/task-id/move', dashboardLocation)).toBe(
      '/auth/jwt/sign-in?returnTo=%2Fdashboard%2Fkanban%3Ffocus%3Dtrue%23task'
    );
  });

  it('lets the auth bootstrap own an unauthenticated profile response', () => {
    expect(sessionExpiryRedirectPath(401, '/api/v1/me', dashboardLocation)).toBeNull();
  });

  it('does not redirect non-authentication failures or loop on the login page', () => {
    expect(sessionExpiryRedirectPath(409, '/api/v1/issues/task-id', dashboardLocation)).toBeNull();
    expect(
      sessionExpiryRedirectPath(401, '/api/v1/issues/task-id', {
        pathname: '/auth/jwt/sign-in',
        search: '',
        hash: '',
      })
    ).toBeNull();
  });
});
