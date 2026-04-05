import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestQueryClient } from '@/test/render';
import { queryKeys } from '@/query/query-keys';

import { usePipelineEventStream } from './use-pipeline-event-stream';

const pipelinesApiMock = vi.hoisted(() => ({
  createPipelineEventSource: vi.fn()
}));

vi.mock('@/api/pipelines', () => pipelinesApiMock);

class FakePipelineEventSource {
  onerror: (() => void) | null = null;

  private closed = false;
  private readonly listeners = new Map<
    string,
    Array<(event: MessageEvent<string>) => void>
  >();

  addEventListener(type: string, listener: (event: MessageEvent<string>) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  close() {
    this.closed = true;
  }

  emit(type: string, data: unknown) {
    const event = new MessageEvent(type, {
      data: JSON.stringify(data)
    });

    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }

  fail() {
    this.onerror?.();
  }

  isClosed() {
    return this.closed;
  }
}

describe('usePipelineEventStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('收到状态类事件时应失效 detail/list 查询，并在终态事件后关闭连接', () => {
    const source = new FakePipelineEventSource();
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    pipelinesApiMock.createPipelineEventSource.mockReturnValue(source);

    renderHook(
      () => usePipelineEventStream('pipeline-1', 'project-1'),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        )
      }
    );

    act(() => {
      source.emit('stage_completed', {
        pipelineId: 'pipeline-1',
        eventId: 5
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.pipelines.detail('pipeline-1')
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.pipelines.list('project-1')
    });

    act(() => {
      source.emit('pipeline_cancelled', {
        pipelineId: 'pipeline-1',
        eventId: 6
      });
    });

    expect(source.isClosed()).toBe(true);
  });

  it('收到 pipeline_started 时也应失效 detail/list 查询', () => {
    const source = new FakePipelineEventSource();
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    pipelinesApiMock.createPipelineEventSource.mockReturnValue(source);

    renderHook(
      () => usePipelineEventStream('pipeline-1', 'project-1'),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        )
      }
    );

    act(() => {
      source.emit('pipeline_started', {
        pipelineId: 'pipeline-1',
        eventId: 4
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.pipelines.detail('pipeline-1')
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.pipelines.list('project-1')
    });
    expect(source.isClosed()).toBe(false);
  });

  it('收到 pipeline_resumed 时也应失效 detail/list 查询', () => {
    const source = new FakePipelineEventSource();
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    pipelinesApiMock.createPipelineEventSource.mockReturnValue(source);

    renderHook(
      () => usePipelineEventStream('pipeline-1', 'project-1'),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        )
      }
    );

    act(() => {
      source.emit('pipeline_resumed', {
        pipelineId: 'pipeline-1',
        eventId: 7
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.pipelines.detail('pipeline-1')
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.pipelines.list('project-1')
    });
    expect(source.isClosed()).toBe(false);
  });

  it('连接异常后应使用最新 eventId 重连', () => {
    vi.useFakeTimers();

    const firstSource = new FakePipelineEventSource();
    const secondSource = new FakePipelineEventSource();

    pipelinesApiMock.createPipelineEventSource
      .mockReturnValueOnce(firstSource)
      .mockReturnValueOnce(secondSource);

    const queryClient = createTestQueryClient();

    renderHook(
      () => usePipelineEventStream('pipeline-1', 'project-1'),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        )
      }
    );

    act(() => {
      firstSource.emit('stage_started', {
        pipelineId: 'pipeline-1',
        eventId: 9
      });
      firstSource.fail();
    });

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(pipelinesApiMock.createPipelineEventSource).toHaveBeenNthCalledWith(
      2,
      'pipeline-1',
      9
    );
  });
});
