import { describe, expect, it } from 'vitest';

import { queryClient } from './query-client';

describe('queryClient', () => {
  it('应使用稳定的默认查询策略', () => {
    expect(queryClient.getDefaultOptions().queries).toMatchObject({
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false
    });
  });
});
