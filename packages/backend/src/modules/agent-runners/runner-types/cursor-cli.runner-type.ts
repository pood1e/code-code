import { execFile } from 'child_process';
import { z } from 'zod';

import { CliRunnerTypeBase, type CliRunnerState } from '../cli/cli-runner-base';
import { CliSessionRegistry } from '../cli/cli-session-registry';
import type { CliProcessOptions } from '../cli/cli-process';
import { probeCursorCliHealth } from '../cli/health-probes';
import {
  parseCursorLine,
  createCursorParserState,
  type CursorParserState
} from '../cli/parsers/cursor-cli.parser';
import type {
  RawOutputChunk,
  RunnerSendPayload
} from '../runner-type.interface';
import type { RunnerContext } from '@agent-workbench/shared';
import { RunnerTypeProvider } from '../runner-type.decorator';

export const cursorCliRunnerConfigSchema = z.object({
  executorUser: z.string().optional(),
  env: z
    .record(z.string(), z.string())
    .optional()
    .meta({
      label: '环境变量',
      description: '以 KEY=VALUE 注入 Cursor CLI 进程'
    })
});

export const cursorCliRunnerSessionConfigSchema = z.object({});

export const cursorCliInputSchema = z.object({
  prompt: z.string().min(1).meta({ label: '提示词' })
});

export const cursorCliRuntimeConfigSchema = z.object({
  model: z
    .string()
    .optional()
    .describe('context:models')
    .meta({ label: '模型' }),
  mode: z.enum(['agent', 'ask', 'plan']).default('agent').meta({ label: '模式' }),
  force: z.boolean().default(false).meta({ label: '强制执行' }),
  approveMcps: z.boolean().optional().meta({ label: '自动批准 MCP' })
});

@RunnerTypeProvider()
export class CursorCliRunnerType extends CliRunnerTypeBase {
  readonly id = 'cursor-cli';
  readonly name = 'Cursor CLI';
  readonly materializerTarget = 'cursor' as const;
  readonly capabilities = { skill: true, rule: true, mcp: true };
  readonly runnerConfigSchema = cursorCliRunnerConfigSchema;
  readonly runnerSessionConfigSchema = cursorCliRunnerSessionConfigSchema;
  readonly inputSchema = cursorCliInputSchema;
  readonly runtimeConfigSchema = cursorCliRuntimeConfigSchema;

  constructor(cliSessionRegistry: CliSessionRegistry) {
    super(cliSessionRegistry);
  }

  async checkHealth(
    runnerConfig: unknown
  ): Promise<'online' | 'offline' | 'unknown'> {
    const config = cursorCliRunnerConfigSchema.parse(runnerConfig);
    return probeCursorCliHealth(config.executorUser, config.env);
  }

  async probeContext(runnerConfig: unknown): Promise<RunnerContext> {
    const config = cursorCliRunnerConfigSchema.parse(runnerConfig);
    const command = config.executorUser ? 'sudo' : 'agent';
    const args = config.executorUser
      ? ['-u', config.executorUser, '-i', 'agent', '--list-models']
      : ['--list-models'];

    return new Promise((resolve) => {
      execFile(
        command,
        args,
        {
          timeout: 10_000,
          env: {
            PATH: process.env.PATH,
            HOME: process.env.HOME,
            USER: process.env.USER,
            LANG: process.env.LANG,
            ...(config.env ?? {})
          }
        },
        (error, stdout) => {
          if (error) {
            resolve({});
            return;
          }

          const models: string[] = [];
          const lines = stdout.split('\n');
          for (const line of lines) {
            const match = line.match(/^([a-z0-9\-.]+)\s+-/);
            if (match) {
              models.push(match[1]);
            }
          }
          resolve({ models });
        }
      );
    });
  }

  buildCommand(
    runnerConfig: Record<string, unknown>,
    _runnerSessionConfig: Record<string, unknown>,
    cliState: CliRunnerState,
    payload: RunnerSendPayload
  ): CliProcessOptions {
    const config = cursorCliRunnerConfigSchema.parse(runnerConfig);
    const sessionConfig =
      cursorCliRunnerSessionConfigSchema.parse(_runnerSessionConfig);
    const runtimeConfig = cursorCliRuntimeConfigSchema.parse(
      payload.runtimeConfig
    );
    const input = cursorCliInputSchema.parse(payload.input);

    void sessionConfig;

    const args: string[] = [
      '-p', // non-interactive print mode
      '--output-format',
      'stream-json',
      '--stream-partial-output',
      '--trust' // required for non-interactive operation
    ];

    // Mode
    if (runtimeConfig.mode !== 'agent') {
      args.push('--mode', runtimeConfig.mode);
    }

    // Force
    if (runtimeConfig.force) {
      args.push('--force');
    }

    // Approve MCPs
    if (runtimeConfig.approveMcps) {
      args.push('--approve-mcps');
    }

    // Workspace
    const workspace = cliState.contextDir;
    if (workspace) {
      args.push('--workspace', workspace);
    }

    // Session continuation
    if (cliState.cliSessionId) {
      args.push('--resume', cliState.cliSessionId);
    }

    // Prompt separator and prompt
    args.push('--', input.prompt);

    // Cursor uses workspace as both cwd and --workspace
    const cwd = workspace ?? '.';

    if (config.executorUser) {
      return {
        command: 'sudo',
        args: ['-u', config.executorUser, '-i', 'agent', ...args],
        cwd,
        env: config.env
      };
    }

    return {
      command: 'agent',
      args,
      cwd,
      env: config.env
    };
  }

  parseLine(
    line: string,
    _messageId: string,
    parserState: Record<string, unknown>
  ): RawOutputChunk[] {
    return parseCursorLine(line, parserState as unknown as CursorParserState);
  }

  override extractSessionId(
    parserState: Record<string, unknown>
  ): string | null {
    return (parserState as unknown as CursorParserState).sessionId;
  }

  createParserState(messageId: string): Record<string, unknown> {
    return createCursorParserState(messageId) as unknown as Record<
      string,
      unknown
    >;
  }
}
