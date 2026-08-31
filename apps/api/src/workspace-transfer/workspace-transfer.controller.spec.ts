import { describe, expect, it, vi } from 'vitest';
import { PayloadTooLargeException } from '@nestjs/common';

import { WorkspaceTransferController } from './workspace-transfer.controller';
import type { WorkspaceTransferService } from './workspace-transfer.service';

function setup() {
  const transfer = {
    parse: vi.fn(),
    previewImport: vi.fn(),
    import: vi.fn(),
  };
  const controller = new WorkspaceTransferController(
    transfer as unknown as WorkspaceTransferService
  );
  return { controller, transfer };
}

describe('WorkspaceTransferController', () => {
  it('rejects files over 10 MB before parsing or writing', async () => {
    const { controller, transfer } = setup();

    await expect(
      controller.import(
        { userId: 'owner' } as never,
        { mode: 'replace' },
        { buffer: Buffer.from('{}'), size: 10 * 1024 * 1024 + 1 }
      )
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
    expect(transfer.parse).not.toHaveBeenCalled();
    expect(transfer.import).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON before calling the import transaction', async () => {
    const { controller, transfer } = setup();

    await expect(
      controller.import(
        { userId: 'owner' } as never,
        { mode: 'merge' },
        { buffer: Buffer.from('{'), size: 1 }
      )
    ).rejects.toThrow('Import file must contain valid JSON');
    expect(transfer.parse).not.toHaveBeenCalled();
    expect(transfer.import).not.toHaveBeenCalled();
  });

  it('previews a parsed import without invoking the mutating import transaction', async () => {
    const { controller, transfer } = setup();
    const parsed = { schemaVersion: 1 };
    transfer.parse.mockReturnValue(parsed);
    transfer.previewImport.mockResolvedValue({ mode: 'merge', schemaVersion: 1 });

    await expect(
      controller.previewImport(
        { userId: 'owner' } as never,
        { mode: 'merge' },
        { buffer: Buffer.from('{"schemaVersion":1}'), size: 19 }
      )
    ).resolves.toEqual({ mode: 'merge', schemaVersion: 1 });

    expect(transfer.parse).toHaveBeenCalledWith({ schemaVersion: 1 });
    expect(transfer.previewImport).toHaveBeenCalledWith('owner', parsed, 'merge');
    expect(transfer.import).not.toHaveBeenCalled();
  });

  it('applies the 10 MB limit to preview before parsing', () => {
    const { controller, transfer } = setup();

    expect(() =>
      controller.previewImport(
        { userId: 'owner' } as never,
        { mode: 'replace' },
        { buffer: Buffer.from('{}'), size: 10 * 1024 * 1024 + 1 }
      )
    ).toThrow(PayloadTooLargeException);
    expect(transfer.parse).not.toHaveBeenCalled();
    expect(transfer.previewImport).not.toHaveBeenCalled();
  });
});
