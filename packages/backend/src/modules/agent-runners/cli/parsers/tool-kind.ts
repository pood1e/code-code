import type { BuiltInToolCallKind, ToolCallKind } from '@agent-workbench/shared';

function normalizeToolName(toolName: string) {
  return toolName.trim().toLowerCase().replace(/[-\s]+/g, '_');
}

function mapToolKind(
  toolName: string,
  aliases: Record<BuiltInToolCallKind, readonly string[]>
): ToolCallKind {
  const normalizedToolName = normalizeToolName(toolName);

  for (const [toolKind, names] of Object.entries(aliases) as Array<
    [BuiltInToolCallKind, readonly string[]]
  >) {
    if (names.some((name) => normalizeToolName(name) === normalizedToolName)) {
      return toolKind;
    }
  }

  return 'fallback';
}

const commonAliases: Record<BuiltInToolCallKind, readonly string[]> = {
  shell: [
    'bash',
    'shell',
    'terminal',
    'exec',
    'exec_command',
    'run_command',
    'run_shell_command',
    'run_terminal_cmd'
  ],
  file_grep: [
    'grep',
    'rg',
    'ripgrep',
    'file_search',
    'search_files',
    'search_file_content'
  ],
  web_search: [
    'web_search',
    'search',
    'google_search',
    'bing_search',
    'tavily_search'
  ],
  file_diff: [
    'apply_patch',
    'edit_file',
    'write_file',
    'create_file',
    'delete_file',
    'replace_in_file',
    'multi_edit',
    'str_replace_editor'
  ],
  fallback: []
};

export function mapClaudeToolKind(toolName: string): ToolCallKind {
  return mapToolKind(toolName, commonAliases);
}

export function mapQwenToolKind(toolName: string): ToolCallKind {
  return mapToolKind(toolName, commonAliases);
}

export function mapCursorToolKind(toolName: string): ToolCallKind {
  return mapToolKind(toolName, commonAliases);
}
