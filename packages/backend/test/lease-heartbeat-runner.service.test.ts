import { afterEach, describe, expect, it, vi } from 'vitest';

import { LeaseHeartbeatRunner } from '../src/modules/pipelines/lease-heartbeat-runner.service';

describe('LeaseHeartbeatRunner', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('应持续续租直到 stop', async () => {
    vi.useFakeTimers();
    const renew = vi.fn().mockResolvedValue(true);
    const runner = new LeaseHeartbeatRunner();

    const heartbeat = runner.start({
      intervalMs: 10,
      renew
    });

    await vi.advanceTimersByTimeAsync(35);
    await heartbeat.stop();

    expect(renew).toHaveBeenCalledTimes(3);
    expect(heartbeat.hasLease()).toBe(true);
  });

  it('续租返回 false 时应失去 lease 并停止后续续租', async () => {
    vi.useFakeTimers();
    const renew = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);
    const runner = new LeaseHeartbeatRunner();

    const heartbeat = runner.start({
      intervalMs: 10,
      renew
    });

    await vi.advanceTimersByTimeAsync(30);

    expect(heartbeat.hasLease()).toBe(false);
    expect(renew).toHaveBeenCalledTimes(2);

    await heartbeat.stop();
  });

  it('续租抛错时应失去 lease 并停止后续续租', async () => {
    vi.useFakeTimers();
    const renew = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error('renew failed'));
    const runner = new LeaseHeartbeatRunner();

    const heartbeat = runner.start({
      intervalMs: 10,
      renew
    });

    await vi.advanceTimersByTimeAsync(30);

    expect(heartbeat.hasLease()).toBe(false);
    expect(renew).toHaveBeenCalledTimes(2);

    await heartbeat.stop();
  });
});
