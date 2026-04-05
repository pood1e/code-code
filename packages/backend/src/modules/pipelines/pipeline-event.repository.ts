import type { PipelineEvent } from '@agent-workbench/shared';

export abstract class PipelineEventRepository {
  abstract listEventsAfterEventId(
    pipelineId: string,
    afterEventId: number
  ): Promise<PipelineEvent[]>;
}
