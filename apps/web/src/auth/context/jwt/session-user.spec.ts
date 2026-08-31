import { it, expect, describe } from 'vitest';

import { toAuthUser } from './session-user';

describe('toAuthUser', () => {
  it('maps the server-side Google profile to the fields consumed by the UI', () => {
    expect(
      toAuthUser({
        userId: 'user-id',
        identityId: 'identity-id',
        email: 'owner@example.com',
        displayName: 'Owner',
        avatarUrl: 'https://example.com/avatar.png',
      })
    ).toEqual({
      id: 'user-id',
      identityId: 'identity-id',
      email: 'owner@example.com',
      displayName: 'Owner',
      photoURL: 'https://example.com/avatar.png',
      role: 'admin',
    });
  });
});
