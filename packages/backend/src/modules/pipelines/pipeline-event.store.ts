import { Injectable } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

import type { PipelineEvent } from '@agent-workbench/shared';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

type PipelineEventRow = Prisma.PipelineEventGetPayload<object>;


/**
 * PipelineEventStore — mirrors SessionEventStore.
 * Persists pipeline events to DB and broadcasts them via in-memory rxjs Subjects.
 * Supports replay via createStream(afterEventId) for reconnecting SSE clients.
 */
@Injectable()
export class PipelineEventStore {
  private readonly subjects = new Map<string, Subject<PipelineEvent>>();
  private readonly lastEventIds = new Map<string, number>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get and increment the event counter for a pipeline.
   * In-memory only — safe for single-process deployment.
   */
  nextEventId(pipelineId: string): number {
    const current = this.lastEventIds.get(pipelineId) ?? 0;
    const next = current + 1;
    this.lastEventIds.set(pipelineId, next);
    return next;
  }

  async append(event: PipelineEvent): Promise<void> {
    await this.prisma.pipelineEvent.create({
      data: {
        pipelineId: event.pipelineId,
        eventId: event.eventId,
        kind: event.kind,
        stageId: event.stageId ?? null,
        timestampMs: BigInt(Date.now()),
        data: event.data
          ? (event.data as Prisma.InputJsonValue)
          : undefined
      }
    });
    this.getSubject(event.pipelineId).next(event);
  }

  /**
   * Create an SSE-ready Observable stream for a pipeline.
   * Replays persisted events after afterEventId, then switches to live mode.
   */
  async createStream(
    pipelineId: string,
    afterEventId = 0
  ): Promise<Observable<MessageEvent>> {
    const snapshot = await this.prisma.pipelineEvent.findFirst({
      where: { pipelineId },
      orderBy: { eventId: 'desc' },
      select: { eventId: true }
    });
    const snapshotLastEventId = snapshot?.eventId ?? 0;

    return new Observable<MessageEvent>((subscriber) => {
      const subject = this.getSubject(pipelineId);
      const bufferedEvents: PipelineEvent[] = [];
      let liveMode = false;

      const subscription = subject.subscribe({
        next: (event) => {
          if (event.eventId <= afterEventId) return;
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
              eventId: { gt: afterEventId, lte: snapshotLastEventId }
            },
            orderBy: { eventId: 'asc' }
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
        const s = this.subjects.get(pipelineId);
        if (s && s.observers.length === 0) {
          this.subjects.delete(pipelineId);
        }
      };
    });
  }

  complete(pipelineId: string): void {
    const subject = this.subjects.get(pipelineId);
    if (!subject) return;
    subject.complete();
    this.subjects.delete(pipelineId);
    this.lastEventIds.delete(pipelineId);
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
      timestamp: new Date(Number(row.timestampMs)).toISOString(),
      data: row.data
        ? (row.data as Record<string, unknown>)
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
