import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { it, vi, expect, describe, afterEach } from 'vitest';

import {
  useDelayedDelete,
  scheduleDelayedDelete,
  PERMANENT_DELETE_DELAY_MS,
} from './use-delayed-delete';

const toast = vi.hoisted(() => ({ warning: vi.fn(), success: vi.fn() }));

vi.mock('src/components/snackbar', () => ({ toast }));

describe('scheduleDelayedDelete', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('never sends the request before five seconds', async () => {
    vi.useFakeTimers();
    const operation = vi.fn().mockResolvedValue(undefined);
    const onComplete = vi.fn();

    scheduleDelayedDelete(operation, onComplete, vi.fn(), 0);
    await vi.advanceTimersByTimeAsync(PERMANENT_DELETE_DELAY_MS - 1);
    expect(operation).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(operation).toHaveBeenCalledOnce();
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('Undo cancels the pending request', async () => {
    vi.useFakeTimers();
    const operation = vi.fn().mockResolvedValue(undefined);
    const cancel = scheduleDelayedDelete(operation, vi.fn(), vi.fn());

    cancel();
    await vi.advanceTimersByTimeAsync(PERMANENT_DELETE_DELAY_MS);
    expect(operation).not.toHaveBeenCalled();
  });

  it('reports a deletion failure without calling completion', async () => {
    vi.useFakeTimers();
    const failure = new Error('delete failed');
    const onComplete = vi.fn();
    const onError = vi.fn();

    scheduleDelayedDelete(vi.fn().mockRejectedValue(failure), onComplete, onError);
    await vi.advanceTimersByTimeAsync(PERMANENT_DELETE_DELAY_MS);

    expect(onComplete).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(failure);
  });

  it('runs the hook operation after the warning window and announces completion', async () => {
    vi.useFakeTimers();
    const schedule = renderHookSchedule();
    const operation = vi.fn().mockResolvedValue(undefined);
    const onComplete = vi.fn();

    schedule({ label: 'Archived project', operation, onComplete, onError: vi.fn() });
    expect(toast.warning).toHaveBeenCalledWith(
      'Archived project will be permanently deleted in 5 seconds',
      expect.objectContaining({ duration: PERMANENT_DELETE_DELAY_MS })
    );

    await vi.advanceTimersByTimeAsync(PERMANENT_DELETE_DELAY_MS);

    expect(operation).toHaveBeenCalledOnce();
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('exposes an Undo toast action that cancels the hook operation', async () => {
    vi.useFakeTimers();
    const schedule = renderHookSchedule();
    const operation = vi.fn().mockResolvedValue(undefined);

    schedule({ label: 'Archived task', operation, onComplete: vi.fn(), onError: vi.fn() });
    const options = toast.warning.mock.calls[0]?.[1] as {
      action: { onClick: () => void };
    };
    options.action.onClick();
    await vi.advanceTimersByTimeAsync(PERMANENT_DELETE_DELAY_MS);

    expect(operation).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Permanent deletion cancelled');
  });
});

function renderHookSchedule() {
  let schedule!: ReturnType<typeof useDelayedDelete>;
  function Harness() {
    schedule = useDelayedDelete();
    return null;
  }
  renderToStaticMarkup(createElement(Harness));
  return schedule;
}
