import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type MockLocalStorage = {
  getItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
};

function mockLocalStorage(overrides?: Partial<MockLocalStorage>) {
  const storage: MockLocalStorage = {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
    ...overrides
  };

  vi.stubGlobal('localStorage', storage);
  return storage;
}

async function loadUiStore({ resetState = true }: { resetState?: boolean } = {}) {
  vi.resetModules();
  const module = await import('./ui-store');
  if (resetState) {
    module.useUiStore.setState({
      sidebarCollapsed: false,
      agentRunnerSearch: '',
      resourceSearch: {
        skills: '',
        mcps: '',
        rules: ''
      }
    });
  }
  return module.useUiStore;
}

describe('ui-store', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('初始化时应读取 localStorage 中的侧栏状态', async () => {
    mockLocalStorage({
      getItem: vi.fn().mockReturnValue('true')
    });

    const useUiStore = await loadUiStore({ resetState: false });

    expect(useUiStore.getState().sidebarCollapsed).toBe(true);
  });

  it('读取 localStorage 失败时应回退为未折叠', async () => {
    mockLocalStorage({
      getItem: vi.fn(() => {
        throw new Error('blocked');
      })
    });

    vi.resetModules();
    const { useUiStore } = await import('./ui-store');

    expect(useUiStore.getState().sidebarCollapsed).toBe(false);
  });

  it('toggleSidebar 应切换状态并持久化', async () => {
    const storage = mockLocalStorage();
    const useUiStore = await loadUiStore();

    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarCollapsed).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith('sidebar-collapsed', 'true');

    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarCollapsed).toBe(false);
    expect(storage.setItem).toHaveBeenLastCalledWith(
      'sidebar-collapsed',
      'false'
    );
  });

  it('setSidebarCollapsed 应直接设置状态，并吞掉持久化错误', async () => {
    const storage = mockLocalStorage({
      setItem: vi.fn(() => {
        throw new Error('quota exceeded');
      })
    });
    const useUiStore = await loadUiStore();

    expect(() => {
      useUiStore.getState().setSidebarCollapsed(true);
    }).not.toThrow();

    expect(useUiStore.getState().sidebarCollapsed).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith('sidebar-collapsed', 'true');
  });

  it('应分别维护 AgentRunner 搜索词和按资源类型分组的搜索词', async () => {
    mockLocalStorage();
    const useUiStore = await loadUiStore();

    useUiStore.getState().setAgentRunnerSearch('qwen');
    useUiStore.getState().setResourceSearch('skills', 'skill-search');
    useUiStore.getState().setResourceSearch('mcps', 'mcp-search');

    expect(useUiStore.getState().agentRunnerSearch).toBe('qwen');
    expect(useUiStore.getState().resourceSearch).toEqual({
      skills: 'skill-search',
      mcps: 'mcp-search',
      rules: ''
    });
  });
});
