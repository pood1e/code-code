import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AgentRunnersController } from './agent-runners.controller';
import { AgentRunnersService } from './agent-runners.service';
import { RunnerTypeRegistry } from './runner-type.registry';

@Module({
  imports: [PrismaModule],
  controllers: [AgentRunnersController],
  providers: [AgentRunnersService, RunnerTypeRegistry],
  exports: [RunnerTypeRegistry]
})
export class AgentRunnersModule {}
