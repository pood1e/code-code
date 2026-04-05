import { describe, expect, it } from 'vitest';

import type { CliRunnerState } from '../src/modules/agent-runners/cli/cli-runner-base';
import { CliSessionRegistry } from '../src/modules/agent-runners/cli/cli-session-registry';
import {
  ClaudeCodeRunnerType,
  resolveClaudeCodeRuntimeConfig
} from '../src/modules/agent-runners/runner-types/claude-code.runner-type';

describe('ClaudeCodeRunnerType buildCommand', () => {
  const runnerType = new ClaudeCodeRunnerType(new CliSessionRegistry());

  it('未显式指定模型时不应传递 --model', () => {
    const cliState: CliRunnerState = {
      contextDir: '/tmp/claude-session',
      mcpConfigPath: null,
      cliSessionId: null
    };

    const command = runnerType.buildCommand({}, {}, cliState, {
      messageId: 'message_1',
      input: { prompt: 'hello' },
      runtimeConfig: { permissionMode: 'plan' }
    });

    expect(command.command).toBe('claude');
    expect(command.args).toEqual([
      '-p',
      '--output-format',
      'stream-json',
      '--verbose',
      '--include-partial-messages',
      '--permission-mode',
      'plan',
      '--',
      'hello'
    ]);
    expect(command.args).not.toContain('--model');
  });

  it('显式指定模型时应传递 --model', () => {
    const cliState: CliRunnerState = {
      contextDir: '/tmp/claude-session',
      mcpConfigPath: null,
      cliSessionId: null
    };

    const command = runnerType.buildCommand({}, {}, cliState, {
      messageId: 'message_2',
      input: { prompt: 'hello' },
      runtimeConfig: { permissionMode: 'auto', model: 'sonnet' }
    });

    expect(command.command).toBe('claude');
    expect(command.args).toEqual([
      '-p',
      '--output-format',
      'stream-json',
      '--verbose',
      '--include-partial-messages',
      '--permission-mode',
      'auto',
      '--model',
      'sonnet',
      '--',
      'hello'
    ]);
  });

  it('runner 默认模型与权限模式应补到 runtimeConfig', () => {
    expect(
      resolveClaudeCodeRuntimeConfig(
        {
          defaultRuntimeModel: 'sonnet',
          defaultRuntimePermissionMode: 'auto'
        },
        {}
      )
    ).toEqual({
      model: 'sonnet',
      permissionMode: 'auto'
    });
  });

  it('禁止覆盖时应拦截 runtime model 覆盖', () => {
    expect(() =>
      resolveClaudeCodeRuntimeConfig(
        {
          defaultRuntimeModel: 'sonnet',
          allowRuntimeModelOverride: false
        },
        {
          model: 'opus'
        }
      )
    ).toThrow('This runner does not allow overriding the runtime model');
  });
});
