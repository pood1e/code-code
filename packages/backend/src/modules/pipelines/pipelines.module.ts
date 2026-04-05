import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import {
  ARTIFACT_STORAGE
} from './artifact-storage/artifact-storage.interface';
import { FsArtifactStorage } from './artifact-storage/fs-artifact-storage';
import { PipelineEventStore } from './pipeline-event.store';
import { PipelineQueryService } from './pipeline-query.service';
import { PipelineRuntimeCommandService } from './pipeline-runtime-command.service';
import { PipelineWorkerService } from './pipeline-worker.service';
import { PipelinesController } from './pipelines.controller';
import { PipelinesService } from './pipelines.service';

@Module({
  imports: [PrismaModule],
  controllers: [PipelinesController],
  providers: [
    PipelineEventStore,
    PipelineQueryService,
    PipelineRuntimeCommandService,
    PipelineWorkerService,
    PipelinesService,
    {
      provide: ARTIFACT_STORAGE,
      useFactory: () => new FsArtifactStorage()
    }
  ],
  exports: [PipelinesService, PipelineQueryService, PipelineEventStore]
})
export class PipelinesModule {}
