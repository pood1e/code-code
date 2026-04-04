import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import {
  ARTIFACT_STORAGE
} from './artifact-storage/artifact-storage.interface';
import { FsArtifactStorage } from './artifact-storage/fs-artifact-storage';
import { PipelineQueryService } from './pipeline-query.service';
import { PipelinesController } from './pipelines.controller';
import { PipelinesService } from './pipelines.service';

@Module({
  imports: [PrismaModule],
  controllers: [PipelinesController],
  providers: [
    PipelinesService,
    PipelineQueryService,
    {
      provide: ARTIFACT_STORAGE,
      useClass: FsArtifactStorage
    }
  ],
  exports: [PipelinesService, PipelineQueryService]
})
export class PipelinesModule {}
