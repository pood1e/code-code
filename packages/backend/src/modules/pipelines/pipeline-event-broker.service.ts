import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

import type { PipelineEvent } from '@agent-workbench/shared';

@Injectable()
export class PipelineEventBroker {
  private readonly subjects = new Map<string, Subject<PipelineEvent>>();

  publish(event: PipelineEvent): void {
    this.getSubject(event.pipelineId).next(event);
  }

  publishAll(events: readonly PipelineEvent[]): void {
    for (const event of events) {
      this.publish(event);
    }
  }

  complete(pipelineId: string): void {
    const subject = this.subjects.get(pipelineId);
    if (!subject) {
      return;
    }

    subject.complete();
    this.subjects.delete(pipelineId);
  }

  stream(pipelineId: string): Observable<PipelineEvent> {
    return this.getSubject(pipelineId).asObservable();
  }

  private getSubject(pipelineId: string): Subject<PipelineEvent> {
    let subject = this.subjects.get(pipelineId);
    if (!subject) {
      subject = new Subject<PipelineEvent>();
      this.subjects.set(pipelineId, subject);
    }

    return subject;
  }
}
