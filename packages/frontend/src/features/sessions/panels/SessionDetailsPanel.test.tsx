import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SessionStatus, type AgentRunnerDetail, type ResourceByKind, type RunnerTypeResponse, type SessionDetail } from '@agent-workbench/shared';

import { SessionDetailsPanel } from './SessionDetailsPanel';

const timestamp = '2026-04-03T10:00:00.000Z';

function createSessionDetail(): SessionDetail {
  return {
    id: 'session-1',
    scopeId: 'project-1',
    runnerId: 'runner-1',
    runnerType: 'mock',
    status: SessionStatus.Ready,
    lastEventId: 12,
    createdAt: timestamp,
    updatedAt: timestamp,
    platformSessionConfig: {
      cwd: '/tmp/project-1',
      skillIds: ['skill-1'],
      ruleIds: ['rule-missing'],
      mcps: [
        {
          resourceId: 'mcp-1',
          configOverride: {
            command: 'node'
          }
        }
      ]
    },
    runnerSessionConfig: {
      temperature: 0.2
    },
    defaultRuntimeConfig: {
      locale: 'zh-CN'
    }
  };
}

function createRunnerDetail(): AgentRunnerDetail {
  return {
    id: 'runner-1',
    name: 'Mock Runner',
    description: 'mock runner',
    type: 'mock',
    runnerConfig: {
      endpoint: 'http://localhost:3000'
    },
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function createRunnerType(): RunnerTypeResponse {
  return {
    id: 'mock',
    name: 'Mock Runner Type',
    capabilities: {
      skill: true,
      rule: true,
      mcp: true
    },
    runnerConfigSchema: {
      fields: [
        {
          name: 'endpoint',
          label: 'Endpoint',
          kind: 'url',
          required: true
        }
      ]
    },
    runnerSessionConfigSchema: {
      fields: [
        {
          name: 'temperature',
          label: 'Temperature',
          kind: 'number',
          required: false
        }
      ]
    },
    inputSchema: {
      fields: [
        {
          name: 'prompt',
          label: 'Prompt',
          kind: 'string',
          required: true
        }
      ]
    },
      runtimeConfigSchema: {
      fields: [
        {
          name: 'locale',
          label: 'Locale',
          kind: 'string',
          required: false
        }
      ]
    }
  };
}

function createResources(): {
  skills: ResourceByKind['skills'][];
  mcps: ResourceByKind['mcps'][];
  rules: ResourceByKind['rules'][];
} {
  return {
    skills: [
      {
        id: 'skill-1',
        name: 'Review Skill',
        description: 'code review',
        content: '# Skill',
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    mcps: [
      {
        id: 'mcp-1',
        name: 'Filesystem MCP',
        description: 'fs access',
        content: {
          type: 'stdio',
          command: 'npx',
          args: ['@modelcontextprotocol/server-filesystem']
        },
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    rules: []
  };
}

describe('SessionDetailsPanel', () => {
  it('应仅展示高价值会话设置，并隐藏低价值实现细节', () => {
    render(
      <SessionDetailsPanel
        open
        onClose={() => undefined}
        session={createSessionDetail()}
        runnerDetail={createRunnerDetail()}
        runnerType={createRunnerType()}
        runners={[
          {
            id: 'runner-1',
            name: 'Mock Runner',
            description: 'mock runner',
            type: 'mock',
            createdAt: timestamp,
            updatedAt: timestamp
          }
        ]}
        resources={createResources()}
      />
    );

    expect(
      screen.getByRole('dialog', {
        name: '会话设置'
      })
    ).toBeInTheDocument();
    expect(screen.getByText('就绪')).toBeInTheDocument();
    expect(screen.getByText('Mock Runner')).toBeInTheDocument();
    expect(screen.getByText('/tmp/project-1')).toBeInTheDocument();
    expect(screen.getByText('Review Skill')).toBeInTheDocument();
    expect(screen.getByText('rule-missing')).toBeInTheDocument();
    expect(screen.getByText('Filesystem MCP · override')).toBeInTheDocument();
    expect(screen.getByText('Temperature')).toBeInTheDocument();
    expect(screen.getByText('Locale')).toBeInTheDocument();
    expect(screen.queryByText('Endpoint')).not.toBeInTheDocument();
    expect(screen.queryByText('Prompt')).not.toBeInTheDocument();
    expect(screen.queryByText('Type')).not.toBeInTheDocument();
    expect(screen.queryByText('更新时间')).not.toBeInTheDocument();
  });

  it('点击面板外部时应关闭', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <div>
        <button type="button">外部区域</button>
        <SessionDetailsPanel
          open
          onClose={onClose}
          session={createSessionDetail()}
          runnerDetail={createRunnerDetail()}
          runnerType={createRunnerType()}
          runners={[
            {
              id: 'runner-1',
              name: 'Mock Runner',
              description: 'mock runner',
              type: 'mock',
              createdAt: timestamp,
              updatedAt: timestamp
            }
          ]}
          resources={createResources()}
        />
      </div>
    );

    await user.click(screen.getByRole('button', { name: '外部区域' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('按 Escape 时应关闭', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <SessionDetailsPanel
        open
        onClose={onClose}
        session={createSessionDetail()}
        runnerDetail={createRunnerDetail()}
        runnerType={createRunnerType()}
        runners={[
          {
            id: 'runner-1',
            name: 'Mock Runner',
            description: 'mock runner',
            type: 'mock',
            createdAt: timestamp,
            updatedAt: timestamp
          }
        ]}
        resources={createResources()}
      />
    );

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('关闭时不应渲染弹出层', () => {
    render(
      <SessionDetailsPanel
        open={false}
        onClose={() => undefined}
        session={createSessionDetail()}
        runnerDetail={createRunnerDetail()}
        runnerType={createRunnerType()}
        runners={[
          {
            id: 'runner-1',
            name: 'Mock Runner',
            description: 'mock runner',
            type: 'mock',
            createdAt: timestamp,
            updatedAt: timestamp
          }
        ]}
        resources={createResources()}
      />
    );

    expect(
      screen.queryByRole('dialog', {
        name: '会话设置'
      })
    ).not.toBeInTheDocument();
  });
});
