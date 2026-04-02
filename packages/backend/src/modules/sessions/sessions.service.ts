import { Injectable, OnModuleInit } from '@nestjs/common';

import {
  CreateSessionDto,
  EditSessionMessageDto,
  SendSessionMessageDto
} from './dto/session.dto';
import { SessionEventStore } from './session-event.store';
import { SessionsCommandService } from './sessions-command.service';
import { SessionsQueryService } from './sessions-query.service';
import { SessionRuntimeService } from './session-runtime.service';

@Injectable()
export class SessionsService implements OnModuleInit {
  constructor(
    private readonly sessionsQueryService: SessionsQueryService,
    private readonly sessionsCommandService: SessionsCommandService,
    private readonly sessionRuntimeService: SessionRuntimeService,
    private readonly sessionEventStore: SessionEventStore
  ) {}

  async onModuleInit() {
    await this.sessionRuntimeService.recoverInterruptedSessionsOnBoot();
  }

  list(scopeId: string) {
    return this.sessionsQueryService.list(scopeId);
  }

  getById(id: string) {
    return this.sessionsQueryService.getById(id);
  }

  create(dto: CreateSessionDto) {
    return this.sessionsCommandService.create(dto);
  }

  listMessages(sessionId: string) {
    return this.sessionsQueryService.listMessages(sessionId);
  }

  sendMessage(sessionId: string, dto: SendSessionMessageDto) {
    return this.sessionsCommandService.sendMessage(sessionId, dto);
  }

  cancel(sessionId: string) {
    return this.sessionsCommandService.cancel(sessionId);
  }

  reload(sessionId: string) {
    return this.sessionsCommandService.reload(sessionId);
  }

  editMessage(
    sessionId: string,
    messageId: string,
    dto: EditSessionMessageDto
  ) {
    return this.sessionsCommandService.editMessage(sessionId, messageId, dto);
  }

  dispose(sessionId: string) {
    return this.sessionsCommandService.dispose(sessionId);
  }

  async createEventsStream(sessionId: string, afterEventId = 0) {
    await this.sessionsQueryService.getSessionOrThrow(sessionId);
    return this.sessionEventStore.createStream(sessionId, afterEventId);
  }
}
