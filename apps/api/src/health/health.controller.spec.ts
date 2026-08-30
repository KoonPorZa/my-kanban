import { describe, expect, it, vi } from 'vitest';

import { HealthController } from './health.controller';
import type { PrismaService } from '../database/prisma.service';

describe('HealthController', () => {
  it('reports process liveness', () => {
    const prisma = { $queryRaw: vi.fn() } as unknown as PrismaService;
    const controller = new HealthController(prisma);

    expect(controller.live()).toEqual({ status: 'ok' });
  });
});
