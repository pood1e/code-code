import { Injectable } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import {
  Observable,
  Subject
} from 'rxjs';
import {
  type OutputChunk
} from '@agent-workbench/shared';
import type { Prisma } from '@prisma/client';

import {
  sanitizeJson,
  toOptionalInputJson
} from '../../common/json.utils';
import { PrismaService } from '../../prisma/prisma.service';
import type { SessionEventRow } from './session.types';

@Injectable()
export class SessionEventStore {
  private readonly subjects = new Map<string, Subject<OutputChunk>>();

  constructor(private readonly prisma: PrismaService) {}

  async nextEventId(sessionId: string) {
    const session = await this.prisma.agentSession.update({
      where: { id: sessionId },
      data: {
        lastEventId: {
          increment: 1
        }
      },
      select: {
        lastEventId: true
      }
    });

    return session.lastEventId;
  }

  async append(chunk: OutputChunk): Promise<OutputChunk> {
    await this.prisma.sessionEvent.create({
      data: {
        sessionId: chunk.sessionId,
        eventId: chunk.eventId,
        kind: chunk.kind,
        messageId: chunk.messageId ?? null,
        timestampMs: chunk.timestampMs,
        data: toOptionalInputJson(
          ('data' in chunk ? chunk.data : undefined) as
            | Prisma.InputJsonValue
            | undefined
        )
      }
    });

    this.getSubject(chunk.sessionId).next(chunk);
    return chunk;
  }

  async createStream(sessionId: string, afterEventId = 0) {
    const snapshot = await this.prisma.agentSession.findUnique({
      where: { id: sessionId },
      select: { lastEventId: true }
    });
    const snapshotLastEventId = snapshot?.lastEventId ?? 0;

    return new Observable<MessageEvent>((subscriber) => {
      const subject = this.getSubject(sessionId);
      const bufferedEvents: OutputChunk[] = [];
      let liveMode = false;

      const subscription = subject.subscribe({
        next: (chunk) => {
          if (chunk.eventId <= afterEventId) {
            return;
          }

          if (!liveMode) {
            bufferedEvents.push(chunk);
            return;
          }

          subscriber.next(this.toMessageEvent(chunk));
        },
        error: (error) => subscriber.error(error),
        complete: () => subscriber.complete()
      });

      void (async () => {
        try {
          const replayEvents = await this.prisma.sessionEvent.findMany({
            where: {
              sessionId,
              eventId: {
                gt: afterEventId,
                lte: snapshotLastEventId
              }
            },
            orderBy: [{ eventId: 'asc' }, { id: 'asc' }]
          });

          for (const replayEvent of replayEvents) {
            subscriber.next(this.toMessageEvent(this.toOutputChunk(replayEvent)));
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
        const subject = this.subjects.get(sessionId);
        if (subject && subject.observers.length === 0) {
          this.subjects.delete(sessionId);
        }
      };
    });
  }

  async listMessageDeltas(sessionId: string, messageId: string) {
    const rows = await this.prisma.sessionEvent.findMany({
      where: {
        sessionId,
        messageId,
        kind: 'message_delta'
      },
      orderBy: [{ eventId: 'asc' }, { id: 'asc' }]
    });

    return rows.map((row: SessionEventRow) => this.toOutputChunk(row));
  }

  complete(sessionId: string) {
    const subject = this.subjects.get(sessionId);
    if (!subject) {
      return;
    }

    subject.complete();
    this.subjects.delete(sessionId);
  }

  private getSubject(sessionId: string) {
    let subject = this.subjects.get(sessionId);
    if (!subject) {
      subject = new Subject<OutputChunk>();
      this.subjects.set(sessionId, subject);
    }

    return subject;
  }

  private toOutputChunk(event: SessionEventRow): OutputChunk {
    const common = {
      sessionId: event.sessionId,
      eventId: event.eventId,
      timestampMs: Number(event.timestampMs)
    };
    const sanitizedData = event.data ? sanitizeJson(event.data) : undefined;

    switch (event.kind) {
      case 'session_status':
        return {
          ...common,
          kind: 'session_status',
          data: sanitizedData as Extract<OutputChunk, { kind: 'session_status' }>['data']
        };
      case 'thinking_delta':
        return {
          ...common,
          kind: 'thinking_delta',
          messageId: event.messageId ?? '',
          data: sanitizedData as Extract<OutputChunk, { kind: 'thinking_delta' }>['data']
        };
      case 'message_delta':
        return {
          ...common,
          kind: 'message_delta',
          messageId: event.messageId ?? '',
          data: sanitizedData as Extract<OutputChunk, { kind: 'message_delta' }>['data']
        };
      case 'message_result':
        return {
          ...common,
          kind: 'message_result',
          messageId: event.messageId ?? '',
          data: sanitizedData as Extract<OutputChunk, { kind: 'message_result' }>['data']
        };
      case 'tool_use':
        return {
          ...common,
          kind: 'tool_use',
          messageId: event.messageId ?? '',
          data: sanitizedData as Extract<OutputChunk, { kind: 'tool_use' }>['data']
        };
      case 'usage':
        return {
          ...common,
          kind: 'usage',
          messageId: event.messageId ?? undefined,
          data: sanitizedData as Extract<OutputChunk, { kind: 'usage' }>['data']
        };
      case 'error':
        return {
          ...common,
          kind: 'error',
          messageId: event.messageId ?? '',
          data: sanitizedData as Extract<OutputChunk, { kind: 'error' }>['data']
        };
      case 'done':
        return {
          ...common,
          kind: 'done',
          messageId: event.messageId ?? undefined
        };
      default:
        throw new Error(`Unsupported session event kind: ${event.kind}`);
    }
  }

  private toMessageEvent(chunk: OutputChunk): MessageEvent {
    return {
      type: chunk.kind === 'error' ? 'session_error' : chunk.kind,
      data: chunk
    };
  }
}
