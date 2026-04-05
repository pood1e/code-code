import { useEffect, useEffectEvent, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import {
  PIPELINE_EVENT_KINDS,
  type PipelineEventKind
} from '@agent-workbench/shared';

import { createPipelineEventSource } from '@/api/pipelines';
import { queryKeys } from '@/query/query-keys';

type PipelineEventHandler = (eventType: PipelineEventKind, data: unknown) => void;

const TERMINAL_PIPELINE_EVENT_KINDS = new Set<PipelineEventKind>([
  'pipeline_completed',
  'pipeline_failed',
  'pipeline_cancelled'
]);

const INVALIDATING_PIPELINE_EVENT_KINDS = new Set<PipelineEventKind>([
  'pipeline_started',
  'stage_started',
  'stage_completed',
  'stage_failed',
  'pipeline_paused',
  'pipeline_resumed',
  'pipeline_completed',
  'pipeline_failed',
  'pipeline_cancelled'
]);

export function usePipelineEventStream(
  pipelineId: string | null | undefined,
  scopeId?: string,
  onEvent?: PipelineEventHandler
) {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const lastEventIdRef = useRef<number>(0);
  const handleExternalEvent = useEffectEvent(
    (eventType: PipelineEventKind, data: unknown) => {
      onEvent?.(eventType, data);
    }
  );

  useEffect(() => {
    if (!pipelineId) {
      return;
    }

    lastEventIdRef.current = 0;
    let closed = false;

    const invalidate = () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.pipelines.detail(pipelineId)
      });

      if (scopeId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.pipelines.list(scopeId)
        });
      }
    };

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const connect = () => {
      if (closed) {
        return;
      }

      const eventSource = createPipelineEventSource(
        pipelineId,
        lastEventIdRef.current > 0 ? lastEventIdRef.current : undefined
      );
      eventSourceRef.current = eventSource;

      const handleMessage = (eventType: PipelineEventKind) => {
        return (event: MessageEvent<string>) => {
          let data: unknown;
          try {
            data = JSON.parse(event.data) as unknown;
          } catch {
            data = event.data;
          }

          if (
            data &&
            typeof data === 'object' &&
            'eventId' in data &&
            typeof (data as { eventId: unknown }).eventId === 'number'
          ) {
            lastEventIdRef.current = (data as { eventId: number }).eventId;
          }

          handleExternalEvent(eventType, data);

          if (INVALIDATING_PIPELINE_EVENT_KINDS.has(eventType)) {
            invalidate();
          }

          if (TERMINAL_PIPELINE_EVENT_KINDS.has(eventType)) {
            closed = true;
            clearReconnectTimer();
            eventSource.close();
          }
        };
      };

      for (const eventKind of PIPELINE_EVENT_KINDS) {
        eventSource.addEventListener(eventKind, handleMessage(eventKind));
      }

      eventSource.onerror = () => {
        eventSource.close();
        if (closed) {
          return;
        }

        reconnectTimerRef.current = window.setTimeout(() => {
          reconnectTimerRef.current = null;
          connect();
        }, 2000);
      };
    };

    connect();

    return () => {
      closed = true;
      clearReconnectTimer();
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [pipelineId, queryClient, scopeId]);
}
