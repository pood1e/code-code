import { z } from 'zod';

import { createCliRunnerType, type CliRunnerState } from '../cli/cli-runner-base';
import type { CliProcessOptions } from '../cli/cli-process';
import { probeQwenCliHealth } from '../cli/health-probes';
import {
  parseQwenLine,
  createQwenParserState,
  type QwenParserState
} from '../cli/parsers/qwen-cli.parser';
import type { RunnerSendPayload } from '../runner-type.interface';

export const qwenCliRunnerConfigSchema = z.object({
  executorUser: z.string().optional()
});

export const qwenCliRunnerSessionConfigSchema = z.object({});

export const qwenCliInputSchema = z.object({
  prompt: z.string().min(1)
});

export const qwenCliRuntimeConfigSchema = z.object({
  approvalMode: z
    .enum(['plan', 'default', 'auto-edit', 'yolo'])
    .default('plan')
});

export const QwenCliRunnerType = createCliRunnerType({
  id: 'qwen-cli',
  name: 'Qwen CLI',
  materializerTarget: 'qwen',
  capabilities: {
    skill: true,
    rule: true,
    mcp: true
  },
  runnerConfigSchema: qwenCliRunnerConfigSchema,
  runnerSessionConfigSchema: qwenCliRunnerSessionConfigSchema,
  inputSchema: qwenCliInputSchema,
  runtimeConfigSchema: qwenCliRuntimeConfigSchema,

  async checkHealth(runnerConfig: unknown): Promise<'online' | 'offline' | 'unknown'> {
    const config = qwenCliRunnerConfigSchema.parse(runnerConfig);
    return probeQwenCliHealth(config.executorUser);
  },

  buildCommand(
    runnerConfig: Record<string, unknown>,
    _runnerSessionConfig: Record<string, unknown>,
    cliState: CliRunnerState,
    payload: RunnerSendPayload
  ): CliProcessOptions {
    const config = qwenCliRunnerConfigSchema.parse(runnerConfig);
    const sessionConfig = qwenCliRunnerSessionConfigSchema.parse(_runnerSessionConfig);
    const runtimeConfig = qwenCliRuntimeConfigSchema.parse(payload.runtimeConfig);
    const input = qwenCliInputSchema.parse(payload.input);

    void sessionConfig;

    const args: string[] = [
      '-o', 'stream-json',
      '--include-partial-messages'
    ];

    // Approval mode
    args.push('--approval-mode', runtimeConfig.approvalMode);


    // Session continuation
    if (cliState.cliSessionId) {
      args.push('--session-id', cliState.cliSessionId);
      args.push('--continue');
    }

    // Prompt (positional for Qwen, since -p is deprecated)
    args.push(input.prompt);

    // Qwen CLI runs directly inside the context dir as cwd
    const cwd = cliState.contextDir ?? '.';

    if (config.executorUser) {
      return {
        command: 'sudo',
        args: ['-u', config.executorUser, '-i', 'qwen', ...args],
        cwd
      };
    }

    return {
      command: 'qwen',
      args,
      cwd
    };
  },

  parseLine(
    line: string,
    _messageId: string,
    parserState: Record<string, unknown>
  ): import('../runner-type.interface').RawOutputChunk[] {
    return parseQwenLine(line, parserState as unknown as QwenParserState);
  },

  extractSessionId(
    parserState: Record<string, unknown>
  ): string | null {
    return (parserState as unknown as QwenParserState).sessionId;
  },

  createParserState(messageId: string): Record<string, unknown> {
    return createQwenParserState(messageId) as unknown as Record<string, unknown>;
  }
});
