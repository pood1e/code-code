import { z } from 'zod';

import { CliRunnerTypeBase, type CliRunnerState } from '../cli/cli-runner-base';
import { CliSessionRegistry } from '../cli/cli-session-registry';
import type { CliProcessOptions } from '../cli/cli-process';
import { probeQwenCliHealth } from '../cli/health-probes';
import {
  parseQwenLine,
  createQwenParserState,
  type QwenParserState
} from '../cli/parsers/qwen-cli.parser';
import type {
  RawOutputChunk,
  RunnerProfileInstallInput,
  RunnerSendPayload
} from '../runner-type.interface';
import { RunnerTypeProvider } from '../runner-type.decorator';

export const qwenCliRunnerConfigSchema = z.object({
  executorUser: z.string().optional(),
  env: z
    .record(z.string(), z.string())
    .optional()
    .meta({
      label: '环境变量',
      description: '以 KEY=VALUE 注入 Qwen CLI 进程'
    })
});

export const qwenCliRunnerSessionConfigSchema = z.object({});

export const qwenCliInputSchema = z.object({
  prompt: z.string().min(1).meta({ label: '提示词' })
});

export const qwenCliRuntimeConfigSchema = z.object({
  approvalMode: z
    .enum(['plan', 'default', 'auto-edit', 'yolo'])
    .default('default')
    .meta({ label: '审批模式' })
});

@RunnerTypeProvider()
export class QwenCliRunnerType extends CliRunnerTypeBase {
  readonly id = 'qwen-cli';
  readonly name = 'Qwen CLI';
  readonly capabilities = { skill: true, rule: true, mcp: true };
  readonly runnerConfigSchema = qwenCliRunnerConfigSchema;
  readonly runnerSessionConfigSchema = qwenCliRunnerSessionConfigSchema;
  readonly inputSchema = qwenCliInputSchema;
  readonly runtimeConfigSchema = qwenCliRuntimeConfigSchema;

  constructor(cliSessionRegistry: CliSessionRegistry) {
    super(cliSessionRegistry);
  }

  async checkHealth(
    runnerConfig: unknown
  ): Promise<'online' | 'offline' | 'unknown'> {
    const config = qwenCliRunnerConfigSchema.parse(runnerConfig);
    return probeQwenCliHealth(config.executorUser, config.env);
  }

  protected buildProfileInstallLayout(
    input: RunnerProfileInstallInput
  ) {
    return {
      profileRootDir: input.platformConfig.cwd,
      skillDir: '.qwen/skills',
      contextFileName: 'QWEN.md',
      mcpConfigPath: `${input.platformConfig.cwd}/.qwen/settings.json`
    };
  }

  buildCommand(
    runnerConfig: Record<string, unknown>,
    _runnerSessionConfig: Record<string, unknown>,
    cliState: CliRunnerState,
    payload: RunnerSendPayload
  ): CliProcessOptions {
    const config = qwenCliRunnerConfigSchema.parse(runnerConfig);
    const sessionConfig =
      qwenCliRunnerSessionConfigSchema.parse(_runnerSessionConfig);
    const runtimeConfig = qwenCliRuntimeConfigSchema.parse(
      payload.runtimeConfig
    );
    const input = qwenCliInputSchema.parse(payload.input);

    void sessionConfig;

    const args: string[] = ['-o', 'stream-json', '--include-partial-messages'];

    // Approval mode
    args.push('--approval-mode', runtimeConfig.approvalMode);

    // Session continuation
    if (cliState.cliSessionId) {
      args.push('--resume', cliState.cliSessionId);
    }

    // Prompt (positional for Qwen, since -p is deprecated)
    args.push(input.prompt);

    // Qwen CLI runs directly inside the context dir as cwd
    const cwd = cliState.contextDir ?? '.';

    if (config.executorUser) {
      return {
        command: 'sudo',
        args: ['-u', config.executorUser, '-i', 'qwen', ...args],
        cwd,
        env: config.env,
        stdinMode: 'closed'
      };
    }

    return {
      command: 'qwen',
      args,
      cwd,
      env: config.env,
      stdinMode: 'closed'
    };
  }

  parseLine(
    line: string,
    _messageId: string,
    parserState: Record<string, unknown>
  ): RawOutputChunk[] {
    return parseQwenLine(line, parserState as unknown as QwenParserState);
  }

  override extractSessionId(
    parserState: Record<string, unknown>
  ): string | null {
    return (parserState as unknown as QwenParserState).sessionId;
  }

  createParserState(messageId: string): Record<string, unknown> {
    return createQwenParserState(messageId) as unknown as Record<
      string,
      unknown
    >;
  }
}
