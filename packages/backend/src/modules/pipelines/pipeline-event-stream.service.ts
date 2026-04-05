import { Injectable, type MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';

import type { PipelineEvent } from '@agent-workbench/shared';

import { PipelineRuntimeRepository } from './pipeline-runtime.repository';
import { PipelineEventBroker } from './pipeline-event-broker.service';

@Injectable()
export class PipelineEventStreamService {
  constructor(
    private readonly pipelineRuntimeRepository: PipelineRuntimeRepository,
    private readonly pipelineEventBroker: PipelineEventBroker
  ) {}

  createStream(
    pipelineId: string,
    afterEventId = 0
  ): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      let lastDeliveredEventId = afterEventId;
      let replayCompleted = false;
      const bufferedLiveEvents: PipelineEvent[] = [];

      const flushLiveEvent = (event: PipelineEvent) => {
        if (event.eventId <= lastDeliveredEventId) {
          return;
        }

        lastDeliveredEventId = event.eventId;
        subscriber.next({
          type: event.kind,
          data: event
        });
      };

      const subscription = this.pipelineEventBroker.stream(pipelineId).subscribe({
        next: (event) => {
          if (!replayCompleted) {
            bufferedLiveEvents.push(event);
            return;
          }

          flushLiveEvent(event);
        },
        error: (error) => subscriber.error(error),
        complete: () => subscriber.complete()
      });

      void (async () => {
        try {
          const replayEvents = await this.pipelineRuntimeRepository.listEventsAfterEventId(
            pipelineId,
            afterEventId
          );

          for (const event of replayEvents) {
            flushLiveEvent(event);
          }

          replayCompleted = true;

          for (const event of bufferedLiveEvents) {
            flushLiveEvent(event);
          }
        } catch (error) {
          subscriber.error(error);
        }
      })();

      return () => subscription.unsubscribe();
    });
  }
}
