import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { SessionsModule } from '../sessions/sessions.module';
import { ArtifactContentRepository } from './artifact-content.repository';
import { HumanReviewAssemblerService } from './human-review-assembler.service';
import { LeaseHeartbeatRunner } from './lease-heartbeat-runner.service';
import { PipelineAgentConfigResolverService } from './pipeline-agent-config-resolver.service';
import { PipelineArtifactMaterializerService } from './pipeline-artifact-materializer.service';
import { PipelineArtifactRepository } from './pipeline-artifact.repository';
import { PipelineArtifactVersionRepository } from './pipeline-artifact-version.repository';
import {
  ARTIFACT_STORAGE
} from './artifact-storage/artifact-storage.interface';
import { FsArtifactStorage } from './artifact-storage/fs-artifact-storage';
import { DefaultArtifactContentRepository } from './default-artifact-content.repository';
import { PipelineEventBroker } from './pipeline-event-broker.service';
import { PipelineEventRepository } from './pipeline-event.repository';
import { PipelineEventStreamService } from './pipeline-event-stream.service';
import { PipelineExecutionLeaseRepository } from './pipeline-execution-lease.repository';
import { PipelineQueryService } from './pipeline-query.service';
import { PipelineRepository } from './pipeline.repository';
import { PipelineRuntimeCommandService } from './pipeline-runtime-command.service';
import { PipelineRuntimeRepository } from './pipeline-runtime.repository';
import { PipelineSessionBridgeService } from './pipeline-session-bridge.service';
import { PipelineStageAttemptService } from './pipeline-stage-attempt.service';
import { PipelineStagePromptService } from './pipeline-stage-prompt.service';
import { PipelineWorkerService } from './pipeline-worker.service';
import { PipelinesController } from './pipelines.controller';
import { PipelinesService } from './pipelines.service';
import { PrismaPipelineArtifactRepository } from './prisma-pipeline-artifact.repository';
import { PrismaPipelineArtifactVersionRepository } from './prisma-pipeline-artifact-version.repository';
import { PrismaPipelineEventRepository } from './prisma-pipeline-event.repository';
import { PrismaPipelineExecutionLeaseRepository } from './prisma-pipeline-execution-lease.repository';
import { PrismaPipelineRepository } from './prisma-pipeline.repository';
import { PrismaPipelineRuntimeRepository } from './prisma-pipeline-runtime.repository';
import { StructuredOutputParser } from './structured-output.parser';

@Module({
  imports: [PrismaModule, SessionsModule],
  controllers: [PipelinesController],
  providers: [
    PipelineEventBroker,
    PipelineEventStreamService,
    LeaseHeartbeatRunner,
    PipelineAgentConfigResolverService,
    PipelineStagePromptService,
    PipelineSessionBridgeService,
    PipelineStageAttemptService,
    StructuredOutputParser,
    HumanReviewAssemblerService,
    PipelineQueryService,
    PipelineRuntimeCommandService,
    PipelineArtifactMaterializerService,
    PipelineWorkerService,
    PipelinesService,
    {
      provide: PipelineRepository,
      useClass: PrismaPipelineRepository
    },
    {
      provide: PipelineRuntimeRepository,
      useClass: PrismaPipelineRuntimeRepository
    },
    {
      provide: PipelineExecutionLeaseRepository,
      useClass: PrismaPipelineExecutionLeaseRepository
    },
    {
      provide: PipelineEventRepository,
      useClass: PrismaPipelineEventRepository
    },
    {
      provide: PipelineArtifactRepository,
      useClass: PrismaPipelineArtifactRepository
    },
    {
      provide: PipelineArtifactVersionRepository,
      useClass: PrismaPipelineArtifactVersionRepository
    },
    {
      provide: ArtifactContentRepository,
      useClass: DefaultArtifactContentRepository
    },
    {
      provide: ARTIFACT_STORAGE,
      useFactory: () => new FsArtifactStorage()
    }
  ],
  exports: [
    PipelinesService,
    PipelineQueryService,
    PipelineEventStreamService,
    PipelineRepository,
    PipelineRuntimeRepository,
    PipelineExecutionLeaseRepository,
    PipelineEventRepository,
    PipelineArtifactRepository,
    PipelineArtifactVersionRepository,
    ArtifactContentRepository
  ]
})
export class PipelinesModule {}
