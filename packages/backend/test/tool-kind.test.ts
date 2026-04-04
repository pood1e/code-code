import { describe, expect, it } from 'vitest';

import {
  mapClaudeToolKind,
  mapCursorToolKind,
  mapQwenToolKind
} from '../src/modules/agent-runners/cli/parsers/tool-kind';

describe('tool kind mapping', () => {
  it('应把常用工具映射到统一 kind', () => {
    expect(mapClaudeToolKind('bash')).toBe('shell');
    expect(mapCursorToolKind('grep')).toBe('file_grep');
    expect(mapQwenToolKind('search')).toBe('web_search');
    expect(mapQwenToolKind('apply_patch')).toBe('file_diff');
    expect(mapClaudeToolKind('read_file')).toBe('fallback');
  });
});
