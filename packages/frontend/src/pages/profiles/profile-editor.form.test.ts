import { describe, expect, it } from 'vitest';

import {
  buildMcpEditorState,
  buildProfilePayload,
  buildSaveProfileInput,
  filterAvailableResources,
  formatOverrideEditorValue,
  parseOverrideEditorValue,
  removeSelectedItem,
  reorderSelectedItems,
  toAvailableItems,
  toSelectedBaseItems,
  toSelectedMcpItems
} from './profile-editor.form';

describe('profile-editor.form', () => {
  it('reorderSelectedItems / removeSelectedItem 应重排 order', () => {
    const items = [
      {
        resourceId: 'skill-1',
        name: 'Skill 1',
        description: null,
        order: 0
      },
      {
        resourceId: 'skill-2',
        name: 'Skill 2',
        description: null,
        order: 1
      }
    ];

    expect(reorderSelectedItems(items, 'skill-2', 'skill-1')).toEqual([
      {
        resourceId: 'skill-2',
        name: 'Skill 2',
        description: null,
        order: 0
      },
      {
        resourceId: 'skill-1',
        name: 'Skill 1',
        description: null,
        order: 1
      }
    ]);

    expect(removeSelectedItem(items, 'skill-1')).toEqual([
      {
        resourceId: 'skill-2',
        name: 'Skill 2',
        description: null,
        order: 0
      }
    ]);
  });

  it('parseOverrideEditorValue / formatOverrideEditorValue 应校验并格式化 MCP override', () => {
    expect(parseOverrideEditorValue('')).toEqual({
      override: undefined,
      error: null
    });

    expect(parseOverrideEditorValue('{')).toEqual({
      override: undefined,
      error: 'Override must be valid JSON.'
    });

    expect(
      parseOverrideEditorValue('{"type":"stdio","command":"node"}')
    ).toEqual({
      override: {
        type: 'stdio',
        command: 'node'
      },
      error: null
    });

    expect(
      formatOverrideEditorValue({
        type: 'stdio',
        command: 'node'
      })
    ).toBe('{\n  "type": "stdio",\n  "command": "node"\n}');
  });

  it('filterAvailableResources / toAvailableItems / toSelectedBaseItems / toSelectedMcpItems 应正确映射列表', () => {
    expect(
      filterAvailableResources(
        [
          { id: 'skill-1', name: 'Alpha' },
          { id: 'skill-2', name: 'Beta' }
        ],
        new Set(['skill-1']),
        'be'
      )
    ).toEqual([{ id: 'skill-2', name: 'Beta' }]);

    expect(
      toAvailableItems(
        [
          {
            id: 'skill-1',
            name: 'Alpha',
            description: null
          }
        ],
        (item) => item.name.toUpperCase()
      )
    ).toEqual([
      {
        id: 'skill-1',
        name: 'Alpha',
        description: null,
        meta: 'ALPHA'
      }
    ]);

    expect(
      toSelectedBaseItems([
        {
          id: 'skill-1',
          name: 'Alpha',
          description: null,
          order: 3
        }
      ])
    ).toEqual([
      {
        resourceId: 'skill-1',
        name: 'Alpha',
        description: null,
        order: 0
      }
    ]);

    expect(
      buildMcpEditorState(
        toSelectedMcpItems([
          {
            id: 'mcp-1',
            name: 'MCP A',
            description: null,
            content: {
              type: 'stdio',
              command: 'node',
              args: []
            },
            configOverride: {
              command: 'pnpm'
            },
            resolved: {
              type: 'stdio',
              command: 'pnpm',
              args: []
            },
            order: 5
          }
        ])
      )
    ).toEqual({
      'mcp-1': {
        value: '{\n  "command": "pnpm"\n}',
        error: null
      }
    });
  });

  it('buildProfilePayload / buildSaveProfileInput 应归一化描述并保留资源顺序', () => {
    expect(
      buildProfilePayload({
        name: ' Profile A ',
        description: '  '
      })
    ).toEqual({
      name: 'Profile A',
      description: null
    });

    expect(
      buildSaveProfileInput(
        {
          name: 'Profile A',
          description: 'Demo'
        },
        [
          {
            resourceId: 'skill-2',
            name: 'Skill 2',
            description: null,
            order: 10
          }
        ],
        [
          {
            resourceId: 'mcp-1',
            name: 'MCP 1',
            description: null,
            command: 'node',
            configOverride: {},
            order: 5
          }
        ],
        [
          {
            resourceId: 'rule-1',
            name: 'Rule 1',
            description: null,
            order: 99
          }
        ]
      )
    ).toEqual({
      name: 'Profile A',
      description: 'Demo',
      skills: [{ resourceId: 'skill-2', order: 0 }],
      mcps: [
        {
          resourceId: 'mcp-1',
          order: 0,
          configOverride: undefined
        }
      ],
      rules: [{ resourceId: 'rule-1', order: 0 }]
    });
  });
});
