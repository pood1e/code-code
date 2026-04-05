import 'reflect-metadata';

import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

import { AppModule } from '../src/app.module';
import { ApiResponseInterceptor } from '../src/common/api-response.interceptor';
import { HttpExceptionFilter } from '../src/common/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';

let app: INestApplication;
let prisma: PrismaService;

const TEST_DB_PATH = path.join(__dirname, '..', 'prisma', 'test.db');
const TEST_DB_URL = `file:${TEST_DB_PATH}`;

type SetupTestAppOptions = {
  resetDb?: boolean;
};

type TeardownTestAppOptions = {
  preserveDb?: boolean;
};

/**
 * Bootstrap the NestJS application with an isolated SQLite test database.
 * Uses NestFactory.create (same as production) to ensure DiscoveryService works.
 */
export async function setupTestApp(
  options: SetupTestAppOptions = {}
): Promise<INestApplication> {
  const { resetDb = true } = options;

  if (resetDb) {
    for (const suffix of ['', '-journal', '-wal', '-shm']) {
      const p = `${TEST_DB_PATH}${suffix}`;
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  }

  process.env.DATABASE_URL = TEST_DB_URL;
  process.env.NOTIFICATION_AUTO_START = 'false';

  if (resetDb) {
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, DATABASE_URL: TEST_DB_URL },
      stdio: 'pipe'
    });
  }

  app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false
  });

  const reflector = app.get(Reflector);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ApiResponseInterceptor(reflector));

  await app.init();

  prisma = app.get(PrismaService);

  return app;
}

export function getApp(): INestApplication {
  return app;
}

export function getPrisma(): PrismaService {
  return prisma;
}

/**
 * Reset all database tables between test suites.
 * Deletes data in dependency order (leaves → roots).
 */
export async function resetDatabase(): Promise<void> {
  const db = getPrisma();
  await db.$transaction([
    db.pipelineEvent.deleteMany(),
    db.sessionEvent.deleteMany(),
    db.sessionMetric.deleteMany(),
    db.messageToolUse.deleteMany(),
    db.sessionMessage.deleteMany(),
    db.pipelineArtifact.deleteMany(),
    db.pipelineArtifactSeries.deleteMany(),
    db.pipelineStage.deleteMany(),
    db.pipeline.deleteMany(),
    db.chat.deleteMany(),
    db.agentSession.deleteMany(),
    db.notificationTask.deleteMany(),
    db.notificationChannel.deleteMany(),
    db.profileSkill.deleteMany(),
    db.profileMCP.deleteMany(),
    db.profileRule.deleteMany(),
    db.profile.deleteMany(),
    db.skill.deleteMany(),
    db.mCP.deleteMany(),
    db.rule.deleteMany(),
    db.agentRunner.deleteMany(),
    db.project.deleteMany()
  ]);
}

export async function teardownTestApp(
  options: TeardownTestAppOptions = {}
): Promise<void> {
  const { preserveDb = false } = options;

  if (app) {
    await app.close();
  }

  if (!preserveDb) {
    for (const suffix of ['', '-journal', '-wal', '-shm']) {
      const p = `${TEST_DB_PATH}${suffix}`;
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  }
}
