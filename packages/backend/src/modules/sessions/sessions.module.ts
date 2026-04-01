import { Module } from '@nestjs/common';

import { AgentRunnersModule } from '../agent-runners/agent-runners.module';
import { FileDeltaStore } from './file-delta.store';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

@Module({
  imports: [AgentRunnersModule],
  controllers: [SessionsController],
  providers: [SessionsService, FileDeltaStore]
})
export class SessionsModule {}
