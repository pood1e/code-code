import type { LucideIcon } from 'lucide-react';
import {
  FileSearch,
  FileSymlink,
  Globe,
  Terminal,
  Wrench
} from 'lucide-react';
import type { ToolCallKind } from '@agent-workbench/shared';

import { stringifyValue } from './context';

export type ToolView = {
  icon: LucideIcon;
  label: string;
  summary: string | null;
  details: { label: string; value: string }[];
  terminalOutput: string | null;
  rawBlocks: { label: string; value: string }[];
};

export function buildToolView(
  toolKind: ToolCallKind,
  toolName: string,
  args: unknown,
  result: unknown
): ToolView {
  switch (toolKind) {
    case 'shell':
      return buildShellToolView(toolName, args, result);
    case 'file_grep':
      return buildFileGrepToolView(toolName, args, result);
    case 'web_search':
      return buildWebSearchToolView(toolName, args, result);
    case 'file_diff':
      return buildFileDiffToolView(toolName, args, result);
    case 'fallback':
      return buildFallbackToolView(toolName, args, result);
    default:
      return buildFallbackToolView(toolName, args, result);
  }
}

function buildShellToolView(
  toolName: string,
  args: unknown,
  result: unknown
): ToolView {
  const argsRecord = toRecord(args);
  const resultRecord = toRecord(result);
  const command =
    readString(argsRecord, ['command', 'cmd']) ??
    readString(resultRecord, ['command', 'cmd']) ??
    toolName;
  const exitCode =
    readNumber(resultRecord, ['exitCode', 'exit_code', 'status', 'statusCode']);
  const output =
    readString(resultRecord, ['stdout', 'output', 'text']) ??
    readString(resultRecord, ['stderr']);

  return {
    icon: Terminal,
    label: 'Shell',
    summary: buildCompactSummary(command, 42),
    details: compactToolDetails([
      { label: '命令', value: command },
      exitCode !== undefined
        ? { label: '退出码', value: String(exitCode) }
        : null
    ]),
    terminalOutput: output ?? null,
    rawBlocks: []
  };
}

function buildFileGrepToolView(
  toolName: string,
  args: unknown,
  result: unknown
): ToolView {
  const argsRecord = toRecord(args);
  const resultRecord = toRecord(result);
  const pattern =
    readString(argsRecord, ['pattern', 'query', 'search']) ?? toolName;
  const path =
    readString(argsRecord, ['path', 'cwd', 'directory']) ??
    readFirstStringArrayItem(argsRecord, ['paths', 'files']);
  const hitCount =
    readNumber(resultRecord, ['count', 'matches', 'hitCount']) ??
    getArrayLength(resultRecord, ['results', 'items', 'matches']);

  return {
    icon: FileSearch,
    label: '文件搜索',
    summary: buildCompactSummary(
      path ? `${pattern} · ${summarizePath(path)}` : pattern,
      36
    ),
    details: compactToolDetails([
      { label: '查询', value: pattern },
      path ? { label: '范围', value: path } : null,
      hitCount !== undefined ? { label: '命中', value: String(hitCount) } : null
    ]),
    terminalOutput: null,
    rawBlocks: []
  };
}

function buildWebSearchToolView(
  toolName: string,
  args: unknown,
  result: unknown
): ToolView {
  const argsRecord = toRecord(args);
  const resultRecord = toRecord(result);
  const query = readString(argsRecord, ['query', 'q', 'search']) ?? toolName;
  const resultCount =
    getArrayLength(resultRecord, ['results', 'items', 'hits']) ??
    readNumber(resultRecord, ['count']);
  const firstUrl = readFirstUrl(resultRecord);

  return {
    icon: Globe,
    label: '网页搜索',
    summary: buildCompactSummary(query, 36),
    details: compactToolDetails([
      { label: '查询', value: query },
      resultCount !== undefined
        ? { label: '结果数', value: String(resultCount) }
        : null,
      firstUrl ? { label: '首个链接', value: firstUrl } : null
    ]),
    terminalOutput: null,
    rawBlocks: []
  };
}

function buildFileDiffToolView(
  toolName: string,
  args: unknown,
  result: unknown
): ToolView {
  const argsRecord = toRecord(args);
  const resultRecord = toRecord(result);
  const path =
    readString(argsRecord, ['path', 'filePath']) ??
    readFirstStringArrayItem(argsRecord, ['paths', 'files']);
  const diffText =
    readString(resultRecord, ['diff', 'patch']) ??
    readString(argsRecord, ['diff', 'patch']) ??
    readString(resultRecord, ['text']);
  const fileName = path ? summarizePath(path) : toolName;

  return {
    icon: FileSymlink,
    label: '文件修改',
    summary: buildCompactSummary(fileName, 28),
    details: compactToolDetails([
      path ? { label: '文件', value: path } : null,
      diffText ? { label: '变更', value: diffText } : null
    ]),
    terminalOutput: null,
    rawBlocks: []
  };
}

function buildFallbackToolView(
  toolName: string,
  args: unknown,
  result: unknown
): ToolView {
  return {
    icon: Wrench,
    label: '工具',
    summary: buildCompactSummary(humanizeToolName(toolName), 28),
    details: [],
    terminalOutput: null,
    rawBlocks: buildRawBlocks(args, result)
  };
}

function compactToolDetails(
  details: Array<{ label: string; value: string } | null>
) {
  return details.filter((detail) => detail !== null);
}

function buildRawBlocks(args: unknown, result: unknown) {
  return compactToolDetails([
    args == null ? null : { label: '原始参数', value: stringifyValue(args) },
    result == null ? null : { label: '原始结果', value: stringifyValue(result) }
  ]);
}

function toRecord(value: unknown) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(
  value: Record<string, unknown> | null,
  keys: readonly string[]
) {
  if (!value) {
    return null;
  }

  for (const key of keys) {
    const item = value[key];
    if (typeof item === 'string' && item.trim().length > 0) {
      return item;
    }
  }

  return null;
}

function readNumber(
  value: Record<string, unknown> | null,
  keys: readonly string[]
) {
  if (!value) {
    return undefined;
  }

  for (const key of keys) {
    const item = value[key];
    if (typeof item === 'number' && Number.isFinite(item)) {
      return item;
    }
  }

  return undefined;
}

function readFirstStringArrayItem(
  value: Record<string, unknown> | null,
  keys: readonly string[]
) {
  if (!value) {
    return null;
  }

  for (const key of keys) {
    const item = value[key];
    if (!Array.isArray(item)) {
      continue;
    }

    const firstString = item.find(
      (entry) => typeof entry === 'string' && entry.trim().length > 0
    );
    if (typeof firstString === 'string') {
      return firstString;
    }
  }

  return null;
}

function getArrayLength(
  value: Record<string, unknown> | null,
  keys: readonly string[]
) {
  if (!value) {
    return undefined;
  }

  for (const key of keys) {
    const item = value[key];
    if (Array.isArray(item)) {
      return item.length;
    }
  }

  return undefined;
}

function readFirstUrl(value: Record<string, unknown> | null) {
  if (!value) {
    return null;
  }

  for (const key of ['results', 'items', 'hits'] as const) {
    const item = value[key];
    if (!Array.isArray(item)) {
      continue;
    }

    for (const entry of item) {
      const record = toRecord(entry);
      const url = readString(record, ['url', 'link']);
      if (url) {
        return url;
      }
    }
  }

  return null;
}

function buildCompactSummary(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function humanizeToolName(toolName: string) {
  return toolName.replace(/[_-]+/g, ' ').trim();
}

function summarizePath(path: string) {
  const normalized = path.replace(/\\/g, '/').trim();
  const segments = normalized.split('/').filter(Boolean);

  if (segments.length <= 2) {
    return normalized;
  }

  return segments.slice(-2).join('/');
}
