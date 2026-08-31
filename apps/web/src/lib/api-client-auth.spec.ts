import type { AxiosRequestConfig } from 'axios';

import { it, vi, expect, describe } from 'vitest';
import { apiClient } from '@my-kanban/api-client';

describe('generated API client authentication failures', () => {
  it('redirects one protected 401 without retrying or looping and ignores profile bootstrap', async () => {
    const assign = vi.fn();
    vi.stubGlobal('window', {
      location: {
        pathname: '/dashboard/kanban',
        search: '?focus=true',
        hash: '#task',
        assign,
      },
    });
    const adapter = vi.fn(async (config: AxiosRequestConfig) =>
      Promise.reject({
        config,
        isAxiosError: true,
        response: { status: 401 },
      })
    );

    await expect(apiClient({ url: '/api/v1/me' }, { adapter })).rejects.toMatchObject({
      isAxiosError: true,
    });
    expect(assign).not.toHaveBeenCalled();

    await expect(
      apiClient({ url: '/api/v1/issues/task-id/move' }, { adapter })
    ).rejects.toMatchObject({ isAxiosError: true });
    await expect(
      apiClient({ url: '/api/v1/issues/other-task' }, { adapter })
    ).rejects.toMatchObject({ isAxiosError: true });

    expect(adapter).toHaveBeenCalledTimes(3);
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith(
      '/auth/jwt/sign-in?returnTo=%2Fdashboard%2Fkanban%3Ffocus%3Dtrue%23task'
    );
  });
});
