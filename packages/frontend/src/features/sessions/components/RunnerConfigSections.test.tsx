import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SchemaDescriptor } from '@agent-workbench/shared';

import {
  ReadonlyRunnerConfigSection,
  RunnerSchemaSection
} from './RunnerConfigSections';

function createSchema(fields: SchemaDescriptor['fields']): SchemaDescriptor {
  return { fields };
}

describe('RunnerConfigSections', () => {
  it('ReadonlyRunnerConfigSection 应按 schema 展示配置值', () => {
    render(
      <ReadonlyRunnerConfigSection
        title="会话配置"
        schema={createSchema([
          {
            name: 'model',
            label: '模型',
            kind: 'string',
            required: true,
            description: '当前使用的模型'
          },
          {
            name: 'sandbox',
            label: '沙箱',
            kind: 'boolean',
            required: false
          }
        ])}
        values={{
          model: 'qwen-max',
          sandbox: true
        }}
      />
    );

    expect(screen.getByText('会话配置')).toBeInTheDocument();
    expect(screen.getByText('模型')).toBeInTheDocument();
    expect(screen.getByText('当前使用的模型')).toBeInTheDocument();
    expect(screen.getByText('qwen-max')).toBeInTheDocument();
    expect(screen.getByText('启用')).toBeInTheDocument();
  });

  it('RunnerSchemaSection 应展示字段类型、必填和默认值', () => {
    render(
      <RunnerSchemaSection
        title="Runner Schema"
        schema={createSchema([
          {
            name: 'maxTurns',
            label: '最大轮次',
            kind: 'integer',
            required: true,
            description: '限制单次会话轮次',
            defaultValue: 10
          }
        ])}
      />
    );

    expect(screen.getByText('Runner Schema')).toBeInTheDocument();
    expect(screen.getByText('最大轮次')).toBeInTheDocument();
    expect(screen.getByText('限制单次会话轮次')).toBeInTheDocument();
    expect(screen.getByText('integer')).toBeInTheDocument();
    expect(screen.getByText('required')).toBeInTheDocument();
    expect(screen.getByText('默认值: 10')).toBeInTheDocument();
  });

  it('RunnerSchemaSection 在 schema 缺失时应展示空态文案', () => {
    render(
      <RunnerSchemaSection
        title="输入 Schema"
        schema={undefined}
        emptyLabel="当前未提供输入 schema"
      />
    );

    expect(screen.getByText('当前未提供输入 schema')).toBeInTheDocument();
  });
});
