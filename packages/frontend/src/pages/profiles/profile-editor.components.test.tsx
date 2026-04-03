import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { ResourceSectionCard } from './profile-editor.components';
import type { BaseSectionConfig, McpSectionConfig } from './profile-editor.form';

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => children,
  KeyboardSensor: class KeyboardSensor {},
  PointerSensor: class PointerSensor {},
  closestCenter: vi.fn(),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn((...sensors: unknown[]) => sensors)
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => children,
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false
  })),
  verticalListSortingStrategy: {}
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: () => undefined
    }
  }
}));

function createBaseSection(overrides: Partial<BaseSectionConfig> = {}): BaseSectionConfig {
  return {
    key: 'skills',
    title: 'Skills',
    emptyAvailableText: '没有可添加的 Skill',
    emptySelectedText: '还没有选中的 Skill',
    searchValue: '',
    onSearchChange: vi.fn(),
    availableItems: [
      {
        id: 'skill-1',
        name: 'Review Skill',
        description: '代码审查'
      }
    ],
    selectedItems: [
      {
        resourceId: 'skill-2',
        name: 'Build Skill',
        description: '构建能力',
        order: 0
      }
    ],
    onAdd: vi.fn(),
    onRemove: vi.fn(),
    onReorder: vi.fn(),
    ...overrides
  };
}

function createMcpSection(overrides: Partial<McpSectionConfig> = {}): McpSectionConfig {
  return {
    key: 'mcps',
    title: 'MCPs',
    emptyAvailableText: '没有可添加的 MCP',
    emptySelectedText: '还没有选中的 MCP',
    searchValue: '',
    onSearchChange: vi.fn(),
    availableItems: [
      {
        id: 'mcp-1',
        name: 'Filesystem MCP',
        description: '文件访问',
        meta: 'npx'
      }
    ],
    selectedItems: [
      {
        resourceId: 'mcp-2',
        name: 'GitHub MCP',
        description: '仓库访问',
        order: 0,
        command: 'npx'
      }
    ],
    onAdd: vi.fn(),
    onRemove: vi.fn(),
    onReorder: vi.fn(),
    ...overrides
  };
}

describe('profile-editor.components', () => {
  it('应按用户语义渲染搜索、添加、移除和已选资源明细', async () => {
    const section = createMcpSection();
    const { user } = renderWithProviders(
      <ResourceSectionCard
        section={section}
        renderMeta={(item) => item.command}
        renderDetails={(item) => <p>详情 {item.resourceId}</p>}
      />
    );

    expect(screen.getByRole('heading', { name: 'MCPs' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '可选资源搜索' })).toHaveValue('');
    expect(screen.getByRole('button', { name: '添加 Filesystem MCP' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '拖动排序 GitHub MCP' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '移除 GitHub MCP' })).toBeInTheDocument();
    expect(screen.getByText('详情 mcp-2')).toBeInTheDocument();
    expect(screen.getAllByText('npx')).toHaveLength(2);

    fireEvent.change(screen.getByRole('textbox', { name: '可选资源搜索' }), {
      target: { value: 'file' }
    });
    expect(section.onSearchChange).toHaveBeenCalledWith('file');

    await user.click(screen.getByRole('button', { name: '添加 Filesystem MCP' }));
    expect(section.onAdd).toHaveBeenCalledWith('mcp-1');

    await user.click(screen.getByRole('button', { name: '移除 GitHub MCP' }));
    expect(section.onRemove).toHaveBeenCalledWith('mcp-2');
  });

  it('可选与已选都为空时应展示对应空态', () => {
    const section = createBaseSection({
      availableItems: [],
      selectedItems: []
    });

    renderWithProviders(<ResourceSectionCard section={section} />);

    expect(screen.getByText('暂无可选资源')).toBeInTheDocument();
    expect(screen.getByText('没有可添加的 Skill')).toBeInTheDocument();
    expect(screen.getByText('暂无已选资源')).toBeInTheDocument();
    expect(screen.getByText('还没有选中的 Skill')).toBeInTheDocument();
  });

  it('无描述资源应回退为暂无描述', () => {
    const section = createBaseSection({
      availableItems: [
        {
          id: 'skill-1',
          name: 'Review Skill',
          description: null
        }
      ],
      selectedItems: [
        {
          resourceId: 'skill-2',
          name: 'Build Skill',
          description: null,
          order: 0
        }
      ]
    });

    renderWithProviders(<ResourceSectionCard section={section} />);

    expect(screen.getAllByText('暂无描述')).toHaveLength(2);
  });
});
