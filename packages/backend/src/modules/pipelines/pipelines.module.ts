import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { PipelineArtifactMaterializerService } from './pipeline-artifact-materializer.service';
import { PipelineArtifactRepository } from './pipeline-artifact.repository';
import {
  ARTIFACT_STORAGE
} from './artifact-storage/artifact-storage.interface';
import { FsArtifactStorage } from './artifact-storage/fs-artifact-storage';
import { PipelineEventBroker } from './pipeline-event-broker.service';
import { PipelineEventStreamService } from './pipeline-event-stream.service';
import { PipelineQueryService } from './pipeline-query.service';
import { PipelineRepository } from './pipeline.repository';
import { PipelineRuntimeCommandService } from './pipeline-runtime-command.service';
import { PipelineRuntimeRepository } from './pipeline-runtime.repository';
import { PipelineWorkerService } from './pipeline-worker.service';
import { PipelinesController } from './pipelines.controller';
import { PipelinesService } from './pipelines.service';
import { PrismaPipelineArtifactRepository } from './prisma-pipeline-artifact.repository';
import { PrismaPipelineRepository } from './prisma-pipeline.repository';
import { PrismaPipelineRuntimeRepository } from './prisma-pipeline-runtime.repository';

@Module({
  imports: [PrismaModule],
  controllers: [PipelinesController],
  providers: [
    PipelineEventBroker,
    PipelineEventStreamService,
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
      provide: PipelineArtifactRepository,
      useClass: PrismaPipelineArtifactRepository
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
    PipelineArtifactRepository
  ]
})
export class PipelinesModule {}
