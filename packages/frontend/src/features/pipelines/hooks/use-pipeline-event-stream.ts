import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { createPipelineEventSource } from '@/api/pipelines';
import { queryKeys } from '@/query/query-keys';

type PipelineEventHandler = (eventType: string, data: unknown) => void;

/**
 * Subscribe to real-time pipeline events via SSE.
 * - Replays persisted events from `lastEventId` on reconnect.
 * - Auto-closes when the pipeline reaches a terminal state (completed | cancelled | failed).
 * - Invalidates TanStack Query cache on key lifecycle events.
 */
export function usePipelineEventStream(
  pipelineId: string | null | undefined,
  onEvent?: PipelineEventHandler
) {
  const queryClient = useQueryClient();
  const esRef = useRef<EventSource | null>(null);
  const lastEventIdRef = useRef<number>(0);
  const stableOnEvent = useRef(onEvent);
  stableOnEvent.current = onEvent;

  const invalidate = useCallback(() => {
    if (!pipelineId) return;
    void queryClient.invalidateQueries({
      queryKey: queryKeys.pipelines.detail(pipelineId)
    });
  }, [pipelineId, queryClient]);

  useEffect(() => {
    if (!pipelineId) return;

    let closed = false;

    function connect() {
      if (closed) return;
      const es = createPipelineEventSource(
        pipelineId!,
        lastEventIdRef.current > 0 ? lastEventIdRef.current : undefined
      );
      esRef.current = es;

      function handleMessage(eventType: string) {
        return (evt: MessageEvent<string>) => {
          let data: unknown;
          try {
            data = JSON.parse(evt.data) as unknown;
          } catch {
            data = evt.data;
          }

          // Track last event ID for reconnect continuity
          if (
            data &&
            typeof data === 'object' &&
            'eventId' in data &&
            typeof (data as { eventId: unknown }).eventId === 'number'
          ) {
            lastEventIdRef.current = (data as { eventId: number }).eventId;
          }

          stableOnEvent.current?.(eventType, data);

          // Invalidate cache on key state transitions
          if (
            eventType === 'stage_started' ||
            eventType === 'stage_completed' ||
            eventType === 'pipeline_paused' ||
            eventType === 'pipeline_completed' ||
            eventType === 'pipeline_failed' ||
            eventType === 'pipeline_cancelled'
          ) {
            invalidate();
          }

          // Close stream on terminal events
          if (
            eventType === 'pipeline_completed' ||
            eventType === 'pipeline_failed' ||
            eventType === 'pipeline_cancelled'
          ) {
            closed = true;
            es.close();
          }
        };
      }

      const PIPELINE_EVENT_TYPES = [
        'stage_started',
        'stage_completed',
        'stage_failed',
        'pipeline_paused',
        'pipeline_completed',
        'pipeline_failed',
        'pipeline_cancelled',
        'artifact_created',
        'done'
      ] as const;

      for (const type of PIPELINE_EVENT_TYPES) {
        es.addEventListener(type, handleMessage(type));
      }

      es.onerror = () => {
        es.close();
        if (!closed) {
          // Reconnect after brief delay
          setTimeout(connect, 2000);
        }
      };
    }

    connect();

    return () => {
      closed = true;
      esRef.current?.close();
      esRef.current = null;
    };
  }, [pipelineId, invalidate]);
}
