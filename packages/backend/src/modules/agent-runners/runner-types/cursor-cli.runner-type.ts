import { z } from 'zod';

import { createCliRunnerType, type CliRunnerState } from '../cli/cli-runner-base';
import type { CliProcessOptions } from '../cli/cli-process';
import { probeCursorCliHealth } from '../cli/health-probes';
import {
  parseCursorLine,
  createCursorParserState,
  type CursorParserState
} from '../cli/parsers/cursor-cli.parser';
import type { RunnerSendPayload } from '../runner-type.interface';

export const cursorCliRunnerConfigSchema = z.object({
  executorUser: z.string().optional()
});

export const cursorCliRunnerSessionConfigSchema = z.object({});

export const cursorCliInputSchema = z.object({
  prompt: z.string().min(1)
});

export const cursorCliRuntimeConfigSchema = z.object({
  mode: z.enum(['agent', 'ask', 'plan']).default('agent'),
  force: z.boolean().default(false),
  approveMcps: z.boolean().optional()
});

export const CursorCliRunnerType = createCliRunnerType({
  id: 'cursor-cli',
  name: 'Cursor CLI',
  materializerTarget: 'cursor',
  capabilities: {
    skill: true,
    rule: true,
    mcp: true
  },
  runnerConfigSchema: cursorCliRunnerConfigSchema,
  runnerSessionConfigSchema: cursorCliRunnerSessionConfigSchema,
  inputSchema: cursorCliInputSchema,
  runtimeConfigSchema: cursorCliRuntimeConfigSchema,

  async checkHealth(runnerConfig: unknown): Promise<'online' | 'offline' | 'unknown'> {
    const config = cursorCliRunnerConfigSchema.parse(runnerConfig);
    return probeCursorCliHealth(config.executorUser);
  },

  buildCommand(
    runnerConfig: Record<string, unknown>,
    _runnerSessionConfig: Record<string, unknown>,
    cliState: CliRunnerState,
    payload: RunnerSendPayload
  ): CliProcessOptions {
    const config = cursorCliRunnerConfigSchema.parse(runnerConfig);
    // const sessionConfig = cursorCliRunnerSessionConfigSchema.parse(_runnerSessionConfig);
    const runtimeConfig = cursorCliRuntimeConfigSchema.parse(payload.runtimeConfig);
    const input = cursorCliInputSchema.parse(payload.input);

    const args: string[] = [
      '-p', // non-interactive print mode
      '--output-format', 'stream-json',
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
        cwd
      };
    }

    return {
      command: 'agent',
      args,
      cwd
    };
  },

  parseLine(
    line: string,
    _messageId: string,
    parserState: Record<string, unknown>
  ): import('../runner-type.interface').RawOutputChunk[] {
    return parseCursorLine(line, parserState as unknown as CursorParserState);
  },

  extractSessionId(
    parserState: Record<string, unknown>
  ): string | null {
    return (parserState as unknown as CursorParserState).sessionId;
  },

  createParserState(messageId: string): Record<string, unknown> {
    return createCursorParserState(messageId) as unknown as Record<string, unknown>;
  }
});
