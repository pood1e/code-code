import { Injectable } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import type { Prisma } from '@prisma/client';

import type { PipelineEvent } from '@agent-workbench/shared';

import { sanitizeJson, toOptionalInputJson } from '../../common/json.utils';
import { PrismaService } from '../../prisma/prisma.service';

type PipelineEventRow = Prisma.PipelineEventGetPayload<object>;
type AppendPipelineEventInput = Omit<PipelineEvent, 'eventId'>;

@Injectable()
export class PipelineEventStore {
  private readonly subjects = new Map<string, Subject<PipelineEvent>>();

  constructor(private readonly prisma: PrismaService) {}

  async appendInTransaction(
    tx: Prisma.TransactionClient,
    event: AppendPipelineEventInput
  ): Promise<PipelineEvent> {
    const pipeline = await tx.pipeline.update({
      where: { id: event.pipelineId },
      data: {
        lastEventId: {
          increment: 1
        }
      },
      select: {
        lastEventId: true
      }
    });

    const persistedEvent: PipelineEvent = {
      ...event,
      eventId: pipeline.lastEventId
    };

    await tx.pipelineEvent.create({
      data: {
        pipelineId: persistedEvent.pipelineId,
        eventId: persistedEvent.eventId,
        kind: persistedEvent.kind,
        stageId: persistedEvent.stageId ?? null,
        stageType: persistedEvent.stageType ?? null,
        timestampMs: BigInt(new Date(persistedEvent.timestamp).getTime()),
        data: toOptionalInputJson(
          persistedEvent.data as Prisma.InputJsonValue | undefined
        )
      }
    });

    return persistedEvent;
  }

  publish(event: PipelineEvent): void {
    this.getSubject(event.pipelineId).next(event);
  }

  publishAll(events: readonly PipelineEvent[]): void {
    for (const event of events) {
      this.publish(event);
    }
  }

  async createStream(
    pipelineId: string,
    afterEventId = 0
  ): Promise<Observable<MessageEvent>> {
    const snapshot = await this.prisma.pipeline.findUnique({
      where: { id: pipelineId },
      select: { lastEventId: true }
    });
    const snapshotLastEventId = snapshot?.lastEventId ?? 0;

    return new Observable<MessageEvent>((subscriber) => {
      const subject = this.getSubject(pipelineId);
      const bufferedEvents: PipelineEvent[] = [];
      let liveMode = false;

      const subscription = subject.subscribe({
        next: (event) => {
          if (event.eventId <= afterEventId) {
            return;
          }

          if (!liveMode) {
            bufferedEvents.push(event);
            return;
          }

          subscriber.next(this.toMessageEvent(event));
        },
        error: (error) => subscriber.error(error),
        complete: () => subscriber.complete()
      });

      void (async () => {
        try {
          const replayRows = await this.prisma.pipelineEvent.findMany({
            where: {
              pipelineId,
              eventId: {
                gt: afterEventId,
                lte: snapshotLastEventId
              }
            },
            orderBy: [{ eventId: 'asc' }, { id: 'asc' }]
          });

          for (const row of replayRows) {
            subscriber.next(this.toMessageEvent(this.toEvent(row)));
          }

          for (const event of bufferedEvents) {
            if (event.eventId > snapshotLastEventId) {
              subscriber.next(this.toMessageEvent(event));
            }
          }

          liveMode = true;
        } catch (error) {
          subscriber.error(error);
        }
      })();

      return () => {
        subscription.unsubscribe();
        const subjectForPipeline = this.subjects.get(pipelineId);
        if (subjectForPipeline && subjectForPipeline.observers.length === 0) {
          this.subjects.delete(pipelineId);
        }
      };
    });
  }

  complete(pipelineId: string): void {
    const subject = this.subjects.get(pipelineId);
    if (!subject) {
      return;
    }

    subject.complete();
    this.subjects.delete(pipelineId);
  }

  private getSubject(pipelineId: string): Subject<PipelineEvent> {
    let subject = this.subjects.get(pipelineId);
    if (!subject) {
      subject = new Subject<PipelineEvent>();
      this.subjects.set(pipelineId, subject);
    }

    return subject;
  }

  private toEvent(row: PipelineEventRow): PipelineEvent {
    return {
      kind: row.kind as PipelineEvent['kind'],
      pipelineId: row.pipelineId,
      eventId: row.eventId,
      stageId: row.stageId ?? undefined,
      stageType: row.stageType
        ? (row.stageType as PipelineEvent['stageType'])
        : undefined,
      timestamp: new Date(Number(row.timestampMs)).toISOString(),
      data: row.data
        ? (sanitizeJson(row.data) as Record<string, unknown>)
        : undefined
    };
  }

  private toMessageEvent(event: PipelineEvent): MessageEvent {
    return {
      type: event.kind,
      data: event
    };
  }
}
