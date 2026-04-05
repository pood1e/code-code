import { Injectable } from '@nestjs/common';
import type { PipelineArtifactKey } from '@agent-workbench/shared';

import { PrismaService } from '../../prisma/prisma.service';
import { PipelineArtifactVersionRepository } from './pipeline-artifact-version.repository';

@Injectable()
export class PrismaPipelineArtifactVersionRepository extends PipelineArtifactVersionRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async reserveNextVersion(
    pipelineId: string,
    artifactKey: PipelineArtifactKey
  ): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ version: number | bigint }>>`
      INSERT INTO "PipelineArtifactSeries" (
        "pipelineId",
        "artifactKey",
        "nextVersion",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${pipelineId},
        ${artifactKey},
        2,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("pipelineId", "artifactKey")
      DO UPDATE SET
        "nextVersion" = "PipelineArtifactSeries"."nextVersion" + 1,
        "updatedAt" = CURRENT_TIMESTAMP
      RETURNING "nextVersion" - 1 AS "version"
    `;

    const rawVersion = rows.at(0)?.version;
    const version =
      typeof rawVersion === 'bigint' ? Number(rawVersion) : rawVersion;

    if (!version || !Number.isSafeInteger(version) || version < 1) {
      throw new Error(
        `Failed to allocate artifact version for ${pipelineId}/${artifactKey}`
      );
    }

    return version;
  }
}
