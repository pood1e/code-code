import { z } from 'zod';

import { CliRunnerTypeBase, type CliRunnerState } from '../cli/cli-runner-base';
import { CliSessionRegistry } from '../cli/cli-session-registry';
import type { CliProcessOptions } from '../cli/cli-process';
import { probeClaudeCodeHealth } from '../cli/health-probes';
import {
  parseClaudeLine,
  createClaudeParserState,
  type ClaudeParserState
} from '../cli/parsers/claude-code.parser';
import type {
  RawOutputChunk,
  RunnerSendPayload
} from '../runner-type.interface';
import { RunnerTypeProvider } from '../runner-type.decorator';

export const claudeCodeRunnerConfigSchema = z.object({
  executorUser: z.string().optional(),
  env: z
    .record(z.string(), z.string())
    .optional()
    .meta({
      label: '环境变量',
      description: '以 KEY=VALUE 注入 Claude CLI 进程'
    })
});

export const claudeCodeRunnerSessionConfigSchema = z.object({
  maxTurns: z.number().int().positive().optional().meta({ label: '最大轮数' })
});

export const claudeCodeInputSchema = z.object({
  prompt: z.string().min(1).meta({ label: '提示词' })
});

export const claudeCodeRuntimeConfigSchema = z.object({
  model: z.string().default('claude-sonnet-4-5').meta({ label: '模型' }),
  permissionMode: z
    .enum(['plan', 'auto', 'bypassPermissions'])
    .default('plan')
    .meta({ label: '权限模式' })
});

@RunnerTypeProvider()
export class ClaudeCodeRunnerType extends CliRunnerTypeBase {
  readonly id = 'claude-code';
  readonly name = 'Claude Code';
  readonly materializerTarget = 'claude' as const;
  readonly capabilities = { skill: true, rule: true, mcp: true };
  readonly runnerConfigSchema = claudeCodeRunnerConfigSchema;
  readonly runnerSessionConfigSchema = claudeCodeRunnerSessionConfigSchema;
  readonly inputSchema = claudeCodeInputSchema;
  readonly runtimeConfigSchema = claudeCodeRuntimeConfigSchema;

  constructor(cliSessionRegistry: CliSessionRegistry) {
    super(cliSessionRegistry);
  }

  async checkHealth(
    runnerConfig: unknown
  ): Promise<'online' | 'offline' | 'unknown'> {
    const config = claudeCodeRunnerConfigSchema.parse(runnerConfig);
    return probeClaudeCodeHealth(config.executorUser, config.env);
  }

  buildCommand(
    runnerConfig: Record<string, unknown>,
    _runnerSessionConfig: Record<string, unknown>,
    cliState: CliRunnerState,
    payload: RunnerSendPayload
  ): CliProcessOptions {
    const config = claudeCodeRunnerConfigSchema.parse(runnerConfig);
    const sessionConfig =
      claudeCodeRunnerSessionConfigSchema.parse(_runnerSessionConfig);
    const runtimeConfig = claudeCodeRuntimeConfigSchema.parse(
      payload.runtimeConfig
    );
    const input = claudeCodeInputSchema.parse(payload.input);

    const args: string[] = [
      '-p', // non-interactive print mode
      '--output-format',
      'stream-json',
      '--verbose', // required for stream-json with --print
      '--include-partial-messages'
    ];

    // Note: Claude Code doesn't currently support --max-turns, so we ignore it here
    // but the sessionConfig structure is validated for future-proofing.
    void sessionConfig;

    // Permission mode
    args.push('--permission-mode', runtimeConfig.permissionMode);

    // Model
    if (runtimeConfig.model) {
      args.push('--model', runtimeConfig.model);
    }

    // Session continuation
    if (cliState.cliSessionId) {
      args.push('--resume', cliState.cliSessionId);
    }

    // MCP config
    if (cliState.mcpConfigPath) {
      args.push('--mcp-config', cliState.mcpConfigPath);
    }

    // Add context dir so Claude can see platform-injected rules/skills
    if (cliState.contextDir) {
      args.push('--add-dir', cliState.contextDir);
    }

    // Prompt separator and prompt
    args.push('--', input.prompt);

    // Determine cwd: use the original workspace cwd, not the context dir
    // Claude uses the real workspace as cwd, context dir is added via --add-dir
    const cwd = cliState.contextDir
      ? (cliState.contextDir.split('/.agent-workbench/')[0] ?? '.')
      : '.';

    if (config.executorUser) {
      return {
        command: 'sudo',
        args: ['-u', config.executorUser, '-i', 'claude', ...args],
        cwd,
        env: config.env
      };
    }

    return {
      command: 'claude',
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
    return parseClaudeLine(line, parserState as unknown as ClaudeParserState);
  }

  override extractSessionId(
    parserState: Record<string, unknown>
  ): string | null {
    return (parserState as unknown as ClaudeParserState).sessionId ?? null;
  }

  createParserState(messageId: string): Record<string, unknown> {
    return createClaudeParserState(messageId) as unknown as Record<
      string,
      unknown
    >;
  }
}
