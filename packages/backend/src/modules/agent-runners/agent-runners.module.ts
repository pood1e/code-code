import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { PrismaModule } from '../../prisma/prisma.module';
import { AgentRunnersController } from './agent-runners.controller';
import { AgentRunnersService } from './agent-runners.service';
import { CliSessionRegistry } from './cli/cli-session-registry';
import { RunnerTypeRegistry } from './runner-type.registry';

// Runner type implementations (auto-discovered via @RunnerTypeProvider)
import { ClaudeCodeRunnerType } from './runner-types/claude-code.runner-type';
import { CursorCliRunnerType } from './runner-types/cursor-cli.runner-type';
import { QwenCliRunnerType } from './runner-types/qwen-cli.runner-type';
import { MockRunnerType } from './runner-types/mock.runner-type';

@Module({
  imports: [PrismaModule, DiscoveryModule],
  controllers: [AgentRunnersController],
  providers: [
    AgentRunnersService,
    CliSessionRegistry,
    RunnerTypeRegistry,
    // Runner types — @RunnerTypeProvider() marks them for auto-discovery
    ClaudeCodeRunnerType,
    CursorCliRunnerType,
    QwenCliRunnerType,
    MockRunnerType
  ],
  exports: [RunnerTypeRegistry]
})
export class AgentRunnersModule {}
