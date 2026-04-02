import { z } from 'zod';

import { createCliRunnerType, type CliRunnerState } from '../cli/cli-runner-base';
import type { CliProcessOptions } from '../cli/cli-process';
import { probeClaudeCodeHealth } from '../cli/health-probes';
import {
  parseClaudeLine,
  createClaudeParserState,
  type ClaudeParserState
} from '../cli/parsers/claude-code.parser';
import type { RunnerSendPayload } from '../runner-type.interface';

export const claudeCodeRunnerConfigSchema = z.object({
  executorUser: z.string().optional()
});

export const claudeCodeRunnerSessionConfigSchema = z.object({
  maxTurns: z.number().int().positive().optional()
});

export const claudeCodeInputSchema = z.object({
  prompt: z.string().min(1)
});

export const claudeCodeRuntimeConfigSchema = z.object({
  model: z.string().default('claude-sonnet-4-5'),
  permissionMode: z
    .enum(['plan', 'auto', 'bypassPermissions'])
    .default('plan')
});

export const ClaudeCodeRunnerType = createCliRunnerType({
  id: 'claude-code',
  name: 'Claude Code',
  materializerTarget: 'claude',
  capabilities: {
    skill: true,
    rule: true,
    mcp: true
  },
  runnerConfigSchema: claudeCodeRunnerConfigSchema,
  runnerSessionConfigSchema: claudeCodeRunnerSessionConfigSchema,
  inputSchema: claudeCodeInputSchema,
  runtimeConfigSchema: claudeCodeRuntimeConfigSchema,

  async checkHealth(runnerConfig: unknown): Promise<'online' | 'offline' | 'unknown'> {
    const config = claudeCodeRunnerConfigSchema.parse(runnerConfig);
    return probeClaudeCodeHealth(config.executorUser);
  },

  buildCommand(
    runnerConfig: Record<string, unknown>,
    _runnerSessionConfig: Record<string, unknown>,
    cliState: CliRunnerState,
    payload: RunnerSendPayload
  ): CliProcessOptions {
    const config = claudeCodeRunnerConfigSchema.parse(runnerConfig);
    // const sessionConfig = claudeCodeRunnerSessionConfigSchema.parse(_runnerSessionConfig);
    const runtimeConfig = claudeCodeRuntimeConfigSchema.parse(payload.runtimeConfig);
    const input = claudeCodeInputSchema.parse(payload.input);

    const args: string[] = [
      '-p', // non-interactive print mode
      '--output-format', 'stream-json',
      '--verbose', // required for stream-json with --print
      '--include-partial-messages'
    ];

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
      ? cliState.contextDir.split('/.agent-workbench/')[0] ?? '.'
      : '.';

    if (config.executorUser) {
      return {
        command: 'sudo',
        args: ['-u', config.executorUser, '-i', 'claude', ...args],
        cwd
      };
    }

    return {
      command: 'claude',
      args,
      cwd
    };
  },

  parseLine(
    line: string,
    _messageId: string,
    parserState: Record<string, unknown>
  ): import('../runner-type.interface').RawOutputChunk[] {
    return parseClaudeLine(line, parserState as unknown as ClaudeParserState);
  },

  extractSessionId(
    parserState: Record<string, unknown>
  ): string | null {
    return (parserState as unknown as ClaudeParserState).sessionId ?? null;
  },

  createParserState(messageId: string): Record<string, unknown> {
    return createClaudeParserState(messageId) as unknown as Record<string, unknown>;
  }
});
