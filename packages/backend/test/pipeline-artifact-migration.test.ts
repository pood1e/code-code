import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { afterEach, describe, expect, it } from 'vitest';

const migrationPath = path.join(
  __dirname,
  '..',
  'prisma',
  'migrations',
  '20260405113000_harden_pipeline_runtime_invariants',
  'migration.sql'
);

describe('Pipeline artifact migration', () => {
  const cleanupPaths = new Set<string>();

  afterEach(() => {
    for (const filePath of cleanupPaths) {
      fs.rmSync(filePath, { force: true });
    }
    cleanupPaths.clear();
  });

  it('应保守回填已知 artifact 历史，并保留未知 artifact 为未版本化', () => {
    const dbPath = path.join(
      os.tmpdir(),
      `pipeline-artifact-migration-${Date.now()}-${Math.random()}.sqlite`
    );
    cleanupPaths.add(dbPath);

    const db = new DatabaseSync(dbPath);

    try {
      db.exec(`
        PRAGMA foreign_keys=ON;

        CREATE TABLE "Pipeline" (
          "id" TEXT NOT NULL PRIMARY KEY
        );

        CREATE TABLE "PipelineStage" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "pipelineId" TEXT NOT NULL,
          CONSTRAINT "PipelineStage_pipelineId_fkey"
            FOREIGN KEY ("pipelineId") REFERENCES "Pipeline" ("id")
            ON DELETE CASCADE ON UPDATE CASCADE
        );

        CREATE TABLE "PipelineArtifact" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "pipelineId" TEXT NOT NULL,
          "stageId" TEXT,
          "artifactKey" TEXT NOT NULL,
          "attempt" INTEGER NOT NULL,
          "version" INTEGER NOT NULL,
          "name" TEXT NOT NULL,
          "contentType" TEXT NOT NULL,
          "storageRef" TEXT NOT NULL,
          "metadata" JSON,
          "createdAt" DATETIME NOT NULL,
          CONSTRAINT "PipelineArtifact_pipelineId_fkey"
            FOREIGN KEY ("pipelineId") REFERENCES "Pipeline" ("id")
            ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "PipelineArtifact_stageId_fkey"
            FOREIGN KEY ("stageId") REFERENCES "PipelineStage" ("id")
            ON DELETE SET NULL ON UPDATE CASCADE
        );

        CREATE INDEX "idx_pipeline_artifact_pipeline_id"
        ON "PipelineArtifact"("pipelineId");

        CREATE INDEX "idx_pipeline_artifact_stage_id"
        ON "PipelineArtifact"("stageId");

        CREATE UNIQUE INDEX "uq_pipeline_artifact_version"
        ON "PipelineArtifact"("pipelineId", "artifactKey", "version");

        INSERT INTO "Pipeline" ("id") VALUES ('pipeline-1');
        INSERT INTO "PipelineStage" ("id", "pipelineId") VALUES ('stage-1', 'pipeline-1');

        INSERT INTO "PipelineArtifact" (
          "id", "pipelineId", "stageId", "artifactKey", "attempt", "version",
          "name", "contentType", "storageRef", "metadata", "createdAt"
        ) VALUES
          ('artifact-1', 'pipeline-1', 'stage-1', 'prd', 1, 1, 'prd.json', 'application/json', 'ref-1', NULL, '2026-04-01T00:00:00.000Z'),
          ('artifact-2', 'pipeline-1', 'stage-1', 'prd', 2, 2, 'prd.json', 'application/json', 'ref-2', NULL, '2026-04-02T00:00:00.000Z'),
          ('artifact-3', 'pipeline-1', 'stage-1', 'ac_spec', 1, 1, 'ac-spec.json', 'application/json', 'ref-3', NULL, '2026-04-03T00:00:00.000Z'),
          ('artifact-4', 'pipeline-1', 'stage-1', 'prd', 3, 3, 'custom-notes.txt', 'text/plain', 'ref-4', '{"source":"manual"}', '2026-04-04T00:00:00.000Z');
      `);

      db.exec(fs.readFileSync(migrationPath, 'utf8'));

      const artifacts = db
        .prepare(`
          SELECT
            "id",
            "name",
            "artifactKey",
            "attempt",
            "version"
          FROM "PipelineArtifact"
          ORDER BY "createdAt" ASC, "id" ASC
        `)
        .all() as Array<{
        id: string;
        name: string;
        artifactKey: string | null;
        attempt: number | null;
        version: number | null;
      }>;

      expect(artifacts).toEqual([
        {
          id: 'artifact-1',
          name: 'prd.json',
          artifactKey: 'prd',
          attempt: 1,
          version: 1
        },
        {
          id: 'artifact-2',
          name: 'prd.json',
          artifactKey: 'prd',
          attempt: 2,
          version: 2
        },
        {
          id: 'artifact-3',
          name: 'ac-spec.json',
          artifactKey: 'ac_spec',
          attempt: 1,
          version: 1
        },
        {
          id: 'artifact-4',
          name: 'custom-notes.txt',
          artifactKey: null,
          attempt: null,
          version: null
        }
      ]);

      const series = db
        .prepare(`
          SELECT "artifactKey", "nextVersion"
          FROM "PipelineArtifactSeries"
          ORDER BY "artifactKey" ASC
        `)
        .all() as Array<{
        artifactKey: string;
        nextVersion: number;
      }>;

      expect(series).toEqual([
        { artifactKey: 'ac_spec', nextVersion: 2 },
        { artifactKey: 'prd', nextVersion: 3 }
      ]);
    } finally {
      db.close();
    }
  });
});
