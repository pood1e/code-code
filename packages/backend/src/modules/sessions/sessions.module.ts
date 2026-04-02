import { Module } from '@nestjs/common';

import { AgentRunnersModule } from '../agent-runners/agent-runners.module';
import { SessionEventStore } from './session-event.store';
import { SessionMapper } from './session-mapper';
import { SessionRuntimeService } from './session-runtime.service';
import { SessionsCommandService } from './sessions-command.service';
import { SessionsController } from './sessions.controller';
import { SessionsQueryService } from './sessions-query.service';
import { SessionsService } from './sessions.service';

@Module({
  imports: [AgentRunnersModule],
  controllers: [SessionsController],
  providers: [
    SessionsService,
    SessionsQueryService,
    SessionsCommandService,
    SessionRuntimeService,
    SessionEventStore,
    SessionMapper
  ]
})
export class SessionsModule {}
