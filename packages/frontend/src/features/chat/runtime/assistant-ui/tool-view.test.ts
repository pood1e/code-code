import { describe, expect, it } from 'vitest';

import { buildToolView } from './tool-view';

describe('buildToolView', () => {
  it('未知 toolKind 应走 fallback，而不是依赖封闭枚举 cast', () => {
    const toolView = buildToolView(
      'custom_tool_kind',
      'my_custom_tool',
      { path: 'src/index.ts' },
      { ok: true }
    );

    expect(toolView.label).toBe('工具');
    expect(toolView.summary).toBe('my custom tool');
    expect(toolView.rawBlocks).toEqual([
      {
        label: '原始参数',
        value: '{\n  "path": "src/index.ts"\n}'
      },
      {
        label: '原始结果',
        value: '{\n  "ok": true\n}'
      }
    ]);
  });

  it('file_diff 摘要应保留最后两段路径，避免整条路径过长', () => {
    const toolView = buildToolView(
      'file_diff',
      'apply_patch',
      { path: '/workspace/packages/frontend/src/app.tsx' },
      { diff: '@@ -1 +1 @@\n-old\n+new' }
    );

    expect(toolView.label).toBe('文件修改');
    expect(toolView.summary).toBe('src/app.tsx');
    expect(toolView.details).toEqual([
      {
        label: '文件',
        value: '/workspace/packages/frontend/src/app.tsx'
      },
      {
        label: '变更',
        value: '@@ -1 +1 @@\n-old\n+new'
      }
    ]);
  });
});
