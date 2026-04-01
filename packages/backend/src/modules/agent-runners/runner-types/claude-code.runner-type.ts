import { z } from 'zod';
import type { PlatformSessionConfig } from '@agent-workbench/shared';
import type { RunnerType } from '../runner-type.interface';

export const claudeCodeRunnerConfigSchema = z.object({
  model: z.string().default('claude-sonnet-4-5'),
  baseUrl: z.string().optional()
});

export const claudeCodeRunnerSessionConfigSchema = z.object({
  maxTurns: z.number().int().positive().optional(),
  permissionMode: z.enum(['auto', 'manual']).default('auto')
});

export const claudeCodeTaskConfigSchema = z.object({
  prompt: z.string().min(1),
  systemPrompt: z.string().optional()
});

export const claudeCodeRuntimeConfigSchema = z.object({
  model: z.string().optional()
});

export const ClaudeCodeRunnerType: RunnerType = {
  id: 'claude-code',
  name: 'Claude Code',
  capabilities: {
    skill: true,
    rule: true,
    mcp: true
  },
  runnerConfigSchema: claudeCodeRunnerConfigSchema,
  runnerSessionConfigSchema: claudeCodeRunnerSessionConfigSchema,
  taskConfigSchema: claudeCodeTaskConfigSchema,
  runtimeConfigSchema: claudeCodeRuntimeConfigSchema,

  createSession(
    runnerConfig: unknown,
    platformSessionConfig: PlatformSessionConfig,
    sessionConfig: unknown
  ): Promise<unknown> {
    void runnerConfig;
    void platformSessionConfig;
    void sessionConfig;
    return Promise.reject(new Error('Not implemented'));
  },

  destroySession(session: unknown): Promise<void> {
    void session;
    return Promise.reject(new Error('Not implemented'));
  },

  runTask(session: unknown, taskConfig: unknown): AsyncIterable<unknown> {
    void session;
    void taskConfig;

    return {
      [Symbol.asyncIterator](): AsyncIterator<unknown> {
        return {
          next() {
            return Promise.reject(new Error('Not implemented'));
          }
        };
      }
    };
  },

  cancelTask(session: unknown): Promise<void> {
    void session;
    return Promise.reject(new Error('Not implemented'));
  },

  updateRuntimeConfig(session: unknown, runtimeConfig: unknown): Promise<void> {
    void session;
    void runtimeConfig;
    return Promise.reject(new Error('Not implemented'));
  }
};
