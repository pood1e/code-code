import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import type { PipelineEvent } from '@agent-workbench/shared';

import { sanitizeJson } from '../../common/json.utils';
import { PrismaService } from '../../prisma/prisma.service';
import { PipelineEventRepository } from './pipeline-event.repository';

type PipelineEventRow = Prisma.PipelineEventGetPayload<object>;

@Injectable()
export class PrismaPipelineEventRepository extends PipelineEventRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async listEventsAfterEventId(
    pipelineId: string,
    afterEventId: number
  ): Promise<PipelineEvent[]> {
    const rows = await this.prisma.pipelineEvent.findMany({
      where: {
        pipelineId,
        eventId: {
          gt: afterEventId
        }
      },
      orderBy: [{ eventId: 'asc' }, { id: 'asc' }]
    });

    return rows.map(toPipelineEvent);
  }
}

function toPipelineEvent(row: PipelineEventRow): PipelineEvent {
  return {
    kind: row.kind as PipelineEvent['kind'],
    pipelineId: row.pipelineId,
    eventId: row.eventId,
    ...(row.stageId ? { stageId: row.stageId } : {}),
    ...(row.stageType ? { stageType: row.stageType as PipelineEvent['stageType'] } : {}),
    timestamp: new Date(Number(row.timestampMs)).toISOString(),
    ...(row.data
      ? {
          data: sanitizeJson(row.data) as Record<string, unknown>
        }
      : {})
  };
}
