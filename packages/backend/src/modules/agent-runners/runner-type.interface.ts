import type { ZodTypeAny } from 'zod';
import type { RunnerTypeMeta, PlatformSessionConfig } from '@agent-workbench/shared';

export interface RunnerType extends RunnerTypeMeta {
  runnerConfigSchema: ZodTypeAny;
  runnerSessionConfigSchema: ZodTypeAny;
  taskConfigSchema: ZodTypeAny;
  runtimeConfigSchema: ZodTypeAny;

  // 以下方法第二阶段只定义签名，不实现
  createSession(
    runnerConfig: unknown,
    platformSessionConfig: PlatformSessionConfig,
    sessionConfig: unknown
  ): Promise<unknown>;
  destroySession(session: unknown): Promise<void>;
  runTask(session: unknown, taskConfig: unknown): AsyncIterable<unknown>;
  cancelTask(session: unknown): Promise<void>;
  updateRuntimeConfig(session: unknown, runtimeConfig: unknown): Promise<void>;
}
