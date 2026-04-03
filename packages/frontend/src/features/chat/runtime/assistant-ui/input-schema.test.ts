import { describe, expect, it } from 'vitest';

import { parseRunnerConfigSchema } from '@/lib/runner-config-schema';

import {
  buildStructuredMessagePayload,
  getAdditionalInputFields,
  getPrimaryInputField,
  omitPrimaryFieldValue
} from './input-schema';

describe('input-schema', () => {
  const inputSchema = parseRunnerConfigSchema({
    fields: [
      {
        name: 'prompt',
        label: 'Prompt',
        kind: 'string',
        required: true
      },
      {
        name: 'branch',
        label: 'Branch',
        kind: 'string',
        required: false
      }
    ]
  });

  const runtimeSchema = parseRunnerConfigSchema({
    fields: [
      {
        name: 'maxTurns',
        label: 'Max Turns',
        kind: 'integer',
        required: true
      }
    ]
  });

  if (!inputSchema.supported || !runtimeSchema.supported) {
    throw new Error('schema fixtures should be supported');
  }

  it('应优先选择 prompt 作为主输入字段，并返回额外字段', () => {
    const primaryField = getPrimaryInputField(inputSchema.fields);

    expect(primaryField?.name).toBe('prompt');
    expect(getAdditionalInputFields(inputSchema, primaryField)).toEqual([
      inputSchema.fields[1]
    ]);
  });

  it('应 trim 主输入并归一化 runtimeConfig', () => {
    const payload = buildStructuredMessagePayload({
      schema: inputSchema,
      runtimeSchema,
      primaryField: inputSchema.fields[0],
      composerText: '  hello  ',
      additionalValues: {
        branch: '  main  '
      },
      runtimeValues: {
        maxTurns: '3'
      }
    });

    expect(payload).toEqual({
      input: {
        prompt: 'hello',
        branch: 'main'
      },
      runtimeConfig: {
        maxTurns: 3
      }
    });
  });

  it('主输入校验失败时应抛出字段级错误', () => {
    expect(() =>
      buildStructuredMessagePayload({
        schema: inputSchema,
        runtimeSchema,
        primaryField: inputSchema.fields[0],
        composerText: '   ',
        additionalValues: {},
        runtimeValues: {
          maxTurns: '3'
        }
      })
    ).toThrow('Prompt 为必填项');
  });

  it('runtimeConfig 校验失败时应抛出字段级错误', () => {
    expect(() =>
      buildStructuredMessagePayload({
        schema: inputSchema,
        runtimeSchema,
        primaryField: inputSchema.fields[0],
        composerText: 'hello',
        additionalValues: {},
        runtimeValues: {
          maxTurns: '1.5'
        }
      })
    ).toThrow('Max Turns 必须为整数');
  });

  it('omitPrimaryFieldValue 应从 input 中移除主输入字段', () => {
    expect(
      omitPrimaryFieldValue(
        {
          prompt: 'hello',
          branch: 'main'
        },
        'prompt'
      )
    ).toEqual({
      branch: 'main'
    });
  });
});
