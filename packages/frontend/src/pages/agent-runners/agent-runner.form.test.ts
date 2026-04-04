import { describe, expect, it } from 'vitest';
import type {
  AgentRunnerDetail,
  RunnerTypeResponse
} from '@agent-workbench/shared';

import {
  buildAgentRunnerInitialValues,
  buildCreateAgentRunnerInput,
  buildUpdateAgentRunnerInput,
  getRunnerConfigDefaultSummary,
  getRunnerTypeName,
  isRunnerConfigSchemaSupported,
  parseRawRunnerConfigText,
  stringifyRunnerConfig
} from './agent-runner.form';

const timestamp = '2026-04-03T10:00:00.000Z';

function createSupportedRunnerType(): RunnerTypeResponse {
  return {
    id: 'mock',
    name: 'Mock Runner',
    capabilities: {
      skill: false,
      rule: false,
      mcp: false
    },
    runnerConfigSchema: {
      fields: [
        {
          name: 'model',
          label: 'Model',
          kind: 'string',
          required: true,
          defaultValue: 'qwen3'
        },
        {
          name: 'temperature',
          label: 'Temperature',
          kind: 'number',
          required: false,
          defaultValue: 0.7
        },
        {
          name: 'verbose',
          label: 'Verbose',
          kind: 'boolean',
          required: false,
          defaultValue: true
        }
      ]
    },
    runnerSessionConfigSchema: { fields: [] },
    inputSchema: { fields: [] },
      runtimeConfigSchema: { fields: [] }
  };
}

function createRunnerDetail(): AgentRunnerDetail {
  return {
    id: 'runner-1',
    name: 'Qwen Runner',
    description: '本地 Runner',
    type: 'mock',
    runnerConfig: {
      model: 'qwen3-coder',
      temperature: '0.9',
      verbose: 'true'
    },
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

describe('agent-runner.form', () => {
  it('应根据 detail 与 schema 构建结构化初始值', () => {
    const values = buildAgentRunnerInitialValues(
      [createSupportedRunnerType()],
      createRunnerDetail()
    );

    expect(values).toEqual({
      name: 'Qwen Runner',
      description: '本地 Runner',
      type: 'mock',
      runnerConfig: {
        model: 'qwen3-coder',
        temperature: 0.9,
        verbose: true
      }
    });
  });

  it('没有 runner types 时应回退为空草稿', () => {
    const values = buildAgentRunnerInitialValues([], createRunnerDetail());

    expect(values).toEqual({
      name: 'Qwen Runner',
      description: '本地 Runner',
      type: '',
      runnerConfig: {
        model: 'qwen3-coder',
        temperature: '0.9',
        verbose: 'true'
      }
    });
  });

  it('创建与更新 payload 应修剪 description 并区分 undefined/null', () => {
    expect(
      buildCreateAgentRunnerInput(
        {
          name: '  Runner A  ',
          description: '  desc  ',
          type: 'mock',
          runnerConfig: {}
        },
        { model: 'qwen3' }
      )
    ).toEqual({
      name: 'Runner A',
      description: 'desc',
      type: 'mock',
      runnerConfig: {
        model: 'qwen3'
      }
    });

    expect(
      buildUpdateAgentRunnerInput(
        {
          name: '  Runner B  ',
          description: '   ',
          type: 'mock',
          runnerConfig: {}
        },
        { model: 'qwen3-coder' }
      )
    ).toEqual({
      name: 'Runner B',
      description: null,
      runnerConfig: {
        model: 'qwen3-coder'
      }
    });
  });

  it('应返回 runner type 名称、schema 支持情况与默认值摘要', () => {
    const supportedRunnerType = createSupportedRunnerType();

    expect(getRunnerTypeName([supportedRunnerType], 'mock')).toBe('Mock Runner');
    expect(getRunnerTypeName([supportedRunnerType], 'unknown')).toBe('unknown');

    expect(isRunnerConfigSchemaSupported(supportedRunnerType)).toBe(true);
    expect(isRunnerConfigSchemaSupported(undefined)).toBe(false);

    expect(getRunnerConfigDefaultSummary(supportedRunnerType)).toBe(
      'Model: qwen3 · Temperature: 0.7 · Verbose: true'
    );
    expect(getRunnerConfigDefaultSummary(undefined)).toBe('');
  });

  it('应正确 stringify 与解析原始 runnerConfig JSON', () => {
    expect(stringifyRunnerConfig({ model: 'qwen3' })).toBe(
      '{\n  "model": "qwen3"\n}'
    );
    expect(stringifyRunnerConfig()).toBe('{}');

    expect(parseRawRunnerConfigText('{"model":"qwen3"}')).toEqual({
      data: {
        model: 'qwen3'
      }
    });
    expect(parseRawRunnerConfigText('[]')).toEqual({
      error: 'Runner Config 必须是 JSON 对象。'
    });
    expect(parseRawRunnerConfigText('{invalid}')).toEqual({
      error: 'Runner Config 不是有效的 JSON。'
    });
  });
});
