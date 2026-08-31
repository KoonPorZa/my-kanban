import { it, expect, describe } from 'vitest';

import { GET } from './route';

describe('Web liveness route', () => {
  it('returns a stable deployment health response', async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok', service: 'web' });
  });
});
