import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';

import { ApiRequestError } from '@/api/client';

import { useErrorMessage } from './use-error-message';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn()
  }
}));

describe('useErrorMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应展示默认错误消息，并支持 context 前缀', () => {
    const { result } = renderHook(() => useErrorMessage());

    result.current(
      new ApiRequestError({
        code: 500,
        message: 'Request failed',
        data: null
      }),
      { context: '加载资源失败' }
    );

    expect(toast.error).toHaveBeenCalledWith('加载资源失败: Request failed');
  });

  it('skipCodes 命中时应静默跳过', () => {
    const { result } = renderHook(() => useErrorMessage());
    const initialCallCount = vi.mocked(toast.error).mock.calls.length;

    result.current(
      new ApiRequestError({
        code: 404,
        message: 'Not found',
        data: null
      }),
      { skipCodes: [404] }
    );

    expect(vi.mocked(toast.error).mock.calls.length).toBe(initialCallCount);
  });

  it('未知错误应退化为通用 Request failed', () => {
    const { result } = renderHook(() => useErrorMessage());

    result.current('broken');

    expect(toast.error).toHaveBeenCalledWith('Request failed');
  });
});
