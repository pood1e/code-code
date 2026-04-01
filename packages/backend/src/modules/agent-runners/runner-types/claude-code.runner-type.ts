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

  async createSession(
    _runnerConfig: unknown,
    _platformSessionConfig: PlatformSessionConfig,
    _sessionConfig: unknown
  ): Promise<unknown> {
    throw new Error('Not implemented');
  },

  async destroySession(_session: unknown): Promise<void> {
    throw new Error('Not implemented');
  },

  async *runTask(
    _session: unknown,
    _taskConfig: unknown
  ): AsyncIterable<unknown> {
    throw new Error('Not implemented');
  },

  async cancelTask(_session: unknown): Promise<void> {
    throw new Error('Not implemented');
  },

  async updateRuntimeConfig(
    _session: unknown,
    _runtimeConfig: unknown
  ): Promise<void> {
    throw new Error('Not implemented');
  }
};
