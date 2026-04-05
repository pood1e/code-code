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
  RunnerProfileInstallInput,
  RunnerSendPayload
} from '../runner-type.interface';
import { RunnerTypeProvider } from '../runner-type.decorator';

const claudeCodePermissionModeSchema = z.enum([
  'plan',
  'auto',
  'bypassPermissions'
]);

export const claudeCodeRunnerConfigSchema = z.object({
  executorUser: z.string().optional(),
  env: z
    .record(z.string(), z.string())
    .optional()
    .meta({
      label: '环境变量',
      description: '以 KEY=VALUE 注入 Claude CLI 进程'
    }),
  defaultRuntimeModel: z
    .string()
    .optional()
    .meta({
      label: '默认运行模型',
      description: '未显式传入运行时模型时，默认传给 Claude CLI 的 --model'
    }),
  allowRuntimeModelOverride: z
    .boolean()
    .default(true)
    .meta({
      label: '允许运行时切换模型',
      description: '关闭后，会话与消息级运行参数不能覆盖模型'
    }),
  defaultRuntimePermissionMode: claudeCodePermissionModeSchema
    .optional()
    .meta({
      label: '默认权限模式',
      description: '未显式传入运行时权限模式时使用'
    }),
  allowRuntimePermissionModeOverride: z
    .boolean()
    .default(true)
    .meta({
      label: '允许运行时切换权限模式',
      description: '关闭后，会话与消息级运行参数不能覆盖权限模式'
    })
});

export const claudeCodeRunnerSessionConfigSchema = z.object({
  maxTurns: z.number().int().positive().optional().meta({ label: '最大轮数' })
});

export const claudeCodeInputSchema = z.object({
  prompt: z.string().min(1).meta({ label: '提示词' })
});

export const claudeCodeRuntimeConfigSchema = z.object({
  model: z
    .string()
    .optional()
    .meta({
      label: '模型',
      description:
        '可选。显式传递给 Claude CLI 的 --model，留空时使用环境变量或 Claude Code 默认模型'
    }),
  permissionMode: z
    .enum(['plan', 'auto', 'bypassPermissions'])
    .default('plan')
    .meta({ label: '权限模式' })
});

export function resolveClaudeCodeRuntimeConfig(
  runnerConfig: Record<string, unknown>,
  runtimeConfig: Record<string, unknown>
) {
  const parsedRunnerConfig = claudeCodeRunnerConfigSchema.parse(runnerConfig);
  const resolvedRuntimeConfig = { ...runtimeConfig };

  if (typeof resolvedRuntimeConfig.model === 'string') {
    const trimmedModel = resolvedRuntimeConfig.model.trim();
    if (!trimmedModel) {
      delete resolvedRuntimeConfig.model;
    } else {
      resolvedRuntimeConfig.model = trimmedModel;
    }
  }

  if (!parsedRunnerConfig.allowRuntimeModelOverride) {
    if (resolvedRuntimeConfig.model !== undefined) {
      const defaultModel = parsedRunnerConfig.defaultRuntimeModel?.trim();
      if (!defaultModel || resolvedRuntimeConfig.model !== defaultModel) {
        throw new Error(
          'This runner does not allow overriding the runtime model'
        );
      }
    }

    delete resolvedRuntimeConfig.model;
  }

  if (parsedRunnerConfig.defaultRuntimeModel?.trim()) {
    resolvedRuntimeConfig.model = parsedRunnerConfig.defaultRuntimeModel.trim();
  }

  if (!parsedRunnerConfig.allowRuntimePermissionModeOverride) {
    if (resolvedRuntimeConfig.permissionMode !== undefined) {
      if (
        !parsedRunnerConfig.defaultRuntimePermissionMode ||
        resolvedRuntimeConfig.permissionMode !==
          parsedRunnerConfig.defaultRuntimePermissionMode
      ) {
        throw new Error(
          'This runner does not allow overriding the runtime permission mode'
        );
      }
    }

    delete resolvedRuntimeConfig.permissionMode;
  }

  if (parsedRunnerConfig.defaultRuntimePermissionMode) {
    resolvedRuntimeConfig.permissionMode =
      parsedRunnerConfig.defaultRuntimePermissionMode;
  }

  return resolvedRuntimeConfig;
}

@RunnerTypeProvider()
export class ClaudeCodeRunnerType extends CliRunnerTypeBase {
  readonly id = 'claude-code';
  readonly name = 'Claude Code';
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

  resolveRuntimeConfig(
    runnerConfig: Record<string, unknown>,
    runtimeConfig: Record<string, unknown>
  ) {
    return resolveClaudeCodeRuntimeConfig(runnerConfig, runtimeConfig);
  }

  protected buildProfileInstallLayout(
    input: RunnerProfileInstallInput
  ) {
    return {
      profileRootDir: input.platformConfig.cwd,
      skillDir: '.claude/skills',
      ruleDir: '.claude/rules',
      ruleExtension: '.md' as const,
      mcpConfigPath: `${input.platformConfig.cwd}/.mcp.json`
    };
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

    // Prompt separator and prompt
    args.push('--', input.prompt);

    const cwd = cliState.contextDir ?? '.';

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
