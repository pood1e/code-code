import { describe, expect, it } from 'vitest';

import type { CliRunnerState } from '../src/modules/agent-runners/cli/cli-runner-base';
import { CliSessionRegistry } from '../src/modules/agent-runners/cli/cli-session-registry';
import { QwenCliRunnerType } from '../src/modules/agent-runners/runner-types/qwen-cli.runner-type';

describe('QwenCliRunnerType buildCommand', () => {
  const runnerType = new QwenCliRunnerType(new CliSessionRegistry());

  it('首轮发送不应携带 --resume / --continue / --session-id', () => {
    const cliState: CliRunnerState = {
      contextDir: '/tmp/qwen-session',
      mcpConfigPath: null,
      cliSessionId: null
    };

    const command = runnerType.buildCommand({}, {}, cliState, {
      messageId: 'message_1',
      input: { prompt: 'hello' },
      runtimeConfig: { approvalMode: 'plan' }
    });

    expect(command.command).toBe('qwen');
    expect(command.args).toEqual([
      '-o',
      'stream-json',
      '--include-partial-messages',
      '--approval-mode',
      'plan',
      'hello'
    ]);
  });

  it('续聊时应只使用 --resume <sessionId>，不能与 --session-id / --continue 混用', () => {
    const cliState: CliRunnerState = {
      contextDir: '/tmp/qwen-session',
      mcpConfigPath: null,
      cliSessionId: 'qwen-session-123'
    };

    const command = runnerType.buildCommand({}, {}, cliState, {
      messageId: 'message_2',
      input: { prompt: 'continue please' },
      runtimeConfig: { approvalMode: 'default' }
    });

    expect(command.command).toBe('qwen');
    expect(command.args).toEqual([
      '-o',
      'stream-json',
      '--include-partial-messages',
      '--approval-mode',
      'default',
      '--resume',
      'qwen-session-123',
      'continue please'
    ]);
    expect(command.args).not.toContain('--session-id');
    expect(command.args).not.toContain('--continue');
  });
});
