import { firstValueFrom, take, toArray } from 'rxjs';
import { describe, expect, it } from 'vitest';

import {
  PipelineStageType,
  type PipelineEvent
} from '@agent-workbench/shared';

import { PipelineEventBroker } from '../src/modules/pipelines/pipeline-event-broker.service';
import { PipelineEventStreamService } from '../src/modules/pipelines/pipeline-event-stream.service';
import { PipelineRuntimeRepository } from '../src/modules/pipelines/pipeline-runtime.repository';

describe('PipelineEventStreamService', () => {
  it('应在 replay/live 混合时不丢事件也不重复事件', async () => {
    const broker = new PipelineEventBroker();
    const replay = createDeferred<PipelineEvent[]>();

    const repository: PipelineRuntimeRepository = {
      claimNextPendingPipeline: async () => null,
      recoverInterruptedPipelines: async () => 0,
      startDraftPipeline: async () => null,
      getDecisionContext: async () => null,
      startStage: async () => null,
      completeStage: async () => null,
      failStage: async () => null,
      pauseForHumanReview: async () => null,
      completeExecution: async () => null,
      failExecution: async () => null,
      cancelPipeline: async () => null,
      resumeFromHumanReview: async () => null,
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
