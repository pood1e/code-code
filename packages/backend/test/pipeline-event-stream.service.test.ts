import { firstValueFrom, take, toArray } from 'rxjs';
import { describe, expect, it } from 'vitest';

import {
  PipelineStageType,
  type PipelineEvent
} from '@agent-workbench/shared';

import { PipelineEventBroker } from '../src/modules/pipelines/pipeline-event-broker.service';
import { PipelineEventRepository } from '../src/modules/pipelines/pipeline-event.repository';
import { PipelineEventStreamService } from '../src/modules/pipelines/pipeline-event-stream.service';

describe('PipelineEventStreamService', () => {
  it('应在 replay/live 混合时不丢事件也不重复事件', async () => {
    const broker = new PipelineEventBroker();
    const replay = createDeferred<PipelineEvent[]>();

    const repository: PipelineEventRepository = {
      listEventsAfterEventId: () => replay.promise
    };

    const service = new PipelineEventStreamService(repository, broker);
    const receivedEvents = firstValueFrom(
      service.createStream('pipeline-1', 0).pipe(take(2), toArray())
    );

    broker.publish({
      kind: 'pipeline_completed',
      pipelineId: 'pipeline-1',
      eventId: 2,
      timestamp: new Date().toISOString()
    });

    replay.resolve([
      {
        kind: 'stage_started',
        pipelineId: 'pipeline-1',
        eventId: 1,
        timestamp: new Date().toISOString(),
        stageType: PipelineStageType.Breakdown
      },
      {
        kind: 'pipeline_completed',
        pipelineId: 'pipeline-1',
        eventId: 2,
        timestamp: new Date().toISOString()
      }
    ]);

    const messages = await receivedEvents;
    expect(messages.map((message) => (message.data as { eventId: number }).eventId)).toEqual([
      1,
      2
    ]);
  });

  it('replay 期间 broker complete 时也应先送达 terminal event 再结束流', async () => {
    const broker = new PipelineEventBroker();
    const replay = createDeferred<PipelineEvent[]>();
    const repository: PipelineEventRepository = {
      listEventsAfterEventId: () => replay.promise
    };

    const service = new PipelineEventStreamService(repository, broker);
    const receivedEvents = firstValueFrom(
      service.createStream('pipeline-1', 0).pipe(take(2), toArray())
    );

    broker.publish({
      kind: 'pipeline_cancelled',
      pipelineId: 'pipeline-1',
      eventId: 2,
      timestamp: new Date().toISOString()
    });
    broker.complete('pipeline-1');

    replay.resolve([
      {
        kind: 'stage_started',
        pipelineId: 'pipeline-1',
        eventId: 1,
        timestamp: new Date().toISOString(),
        stageType: PipelineStageType.Breakdown
      },
      {
        kind: 'pipeline_cancelled',
        pipelineId: 'pipeline-1',
        eventId: 2,
        timestamp: new Date().toISOString()
      }
    ]);

    const messages = await receivedEvents;
    expect(messages.map((message) => (message.data as { eventId: number }).eventId)).toEqual([
      1,
      2
    ]);
  });
});

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });

  return {
    promise,
    resolve
  };
}
