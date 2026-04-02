import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import type { PlatformSessionConfig, McpStdioContent, McpConfigOverride } from '@agent-workbench/shared';

const logger = new Logger('ContextMaterializer');

export type MaterializerTarget = 'claude' | 'cursor' | 'qwen';

export type MaterializeInput = {
  target: MaterializerTarget;
  sessionId: string;
  cwd: string;
  platformConfig: PlatformSessionConfig;
  skills: Array<{ name: string; content: string }>;
  rules: Array<{ name: string; content: string }>;
  mcps: Array<{ name: string; content: McpStdioContent; configOverride?: McpConfigOverride }>;
};

export type MaterializeResult = {
  /** The isolated context directory that was created. */
  contextDir: string;
  /** Path to the MCP config file (some CLIs need this passed via --mcp-config). */
  mcpConfigPath: string | null;
};

const CONTEXT_DIR_NAME = '.agent-workbench';

/**
 * Target-specific directory layout configuration.
 */
const TARGET_LAYOUT: Record<
  MaterializerTarget,
  {
    configDir: string;
    mcpFileName: string;
    ruleDir: string;
    ruleExt: string;
    skillDir: string;
  }
> = {
  claude: {
    configDir: '.claude',
    mcpFileName: 'mcp.json',
    ruleDir: 'rules',
    ruleExt: '.mdc',
    skillDir: 'skills'
  },
  cursor: {
    configDir: '.cursor',
    mcpFileName: '../mcp.json', // mcp.json goes in workspace root for Cursor
    ruleDir: 'rules',
    ruleExt: '.mdc',
    skillDir: 'skills'
  },
  qwen: {
    configDir: '.qwen',
    mcpFileName: 'settings.json',
    ruleDir: 'rules',
    ruleExt: '.md',
    skillDir: 'skills'
  }
};

/**
 * Materializes platform session config (MCP / Rule / Skill) into the file system
 * in a format that the target CLI can recognize.
 */
export async function materializeContext(
  input: MaterializeInput
): Promise<MaterializeResult> {
  const { target, sessionId, cwd, skills, rules, mcps } = input;
  const layout = TARGET_LAYOUT[target];
  const contextDir = path.join(cwd, CONTEXT_DIR_NAME, sessionId);

  await fs.mkdir(contextDir, { recursive: true });

  const configBase = path.join(contextDir, layout.configDir);
  await fs.mkdir(configBase, { recursive: true });

  // --- MCP ---
  let mcpConfigPath: string | null = null;
  if (mcps.length > 0) {
    mcpConfigPath = await writeMcpConfig(target, contextDir, configBase, layout, mcps);
  }

  // --- Rules ---
  if (rules.length > 0) {
    await writeRules(configBase, layout, rules);
  }

  // --- Skills ---
  if (skills.length > 0) {
    await writeSkills(configBase, layout, skills);
  }

  logger.log(
    `Materialized context for ${target} session ${sessionId} at ${contextDir}`
  );

  return { contextDir, mcpConfigPath };
}

/**
 * Clean up the isolated context directory for a session.
 * Does NOT delete the parent `.agent-workbench` directory or the user's cwd.
 */
export async function cleanupContext(contextDir: string): Promise<void> {
  try {
    await fs.rm(contextDir, { recursive: true, force: true });
    logger.log(`Cleaned up context directory: ${contextDir}`);
  } catch (error) {
    logger.warn(
      `Failed to clean up context directory ${contextDir}: ${
        error instanceof Error ? error.message : 'unknown error'
      }`
    );
  }
}

// ---- Internal helpers ----

function resolveMcpContent(
  content: McpStdioContent,
  configOverride?: McpConfigOverride
): McpStdioContent {
  if (!configOverride) {
    return content;
  }

  return {
    type: configOverride.type ?? content.type,
    command: configOverride.command ?? content.command,
    args: configOverride.args ?? content.args,
    env: configOverride.env
      ? { ...content.env, ...configOverride.env }
      : content.env
  };
}

async function writeMcpConfig(
  target: MaterializerTarget,
  contextDir: string,
  configBase: string,
  layout: (typeof TARGET_LAYOUT)[MaterializerTarget],
  mcps: MaterializeInput['mcps']
): Promise<string> {
  if (target === 'qwen') {
    // Qwen: .qwen/settings.json with mcpServers
    const mcpServers: Record<string, unknown> = {};
    for (const mcp of mcps) {
      const resolved = resolveMcpContent(mcp.content, mcp.configOverride);
      mcpServers[mcp.name] = resolved;
    }

    const filePath = path.join(configBase, layout.mcpFileName);
    await fs.writeFile(
      filePath,
      JSON.stringify({ mcpServers }, null, 2),
      'utf-8'
    );
    return filePath;
  }

  if (target === 'cursor') {
    // Cursor: mcp.json in workspace root (contextDir)
    const mcpServers: Record<string, unknown> = {};
    for (const mcp of mcps) {
      const resolved = resolveMcpContent(mcp.content, mcp.configOverride);
      mcpServers[mcp.name] = resolved;
    }

    const filePath = path.join(contextDir, 'mcp.json');
    await fs.writeFile(
      filePath,
      JSON.stringify({ mcpServers }, null, 2),
      'utf-8'
    );
    return filePath;
  }

  // Claude: .claude/mcp.json
  const mcpServers: Record<string, unknown> = {};
  for (const mcp of mcps) {
    const resolved = resolveMcpContent(mcp.content, mcp.configOverride);
    mcpServers[mcp.name] = resolved;
  }

  const filePath = path.join(configBase, layout.mcpFileName);
  await fs.writeFile(
    filePath,
    JSON.stringify({ mcpServers }, null, 2),
    'utf-8'
  );
  return filePath;
}

async function writeRules(
  configBase: string,
  layout: (typeof TARGET_LAYOUT)[MaterializerTarget],
  rules: MaterializeInput['rules']
): Promise<void> {
  const rulesDir = path.join(configBase, layout.ruleDir);
  await fs.mkdir(rulesDir, { recursive: true });

  for (const rule of rules) {
    const safeName = sanitizeFileName(rule.name);

    let content: string;
    if (layout.ruleExt === '.mdc') {
      // MDC format: add frontmatter so the rule applies every time
      content = `---\nalwaysApply: true\n---\n\n${rule.content}`;
    } else {
      content = rule.content;
    }

    await fs.writeFile(
      path.join(rulesDir, `${safeName}${layout.ruleExt}`),
      content,
      'utf-8'
    );
  }
}

async function writeSkills(
  configBase: string,
  layout: (typeof TARGET_LAYOUT)[MaterializerTarget],
  skills: MaterializeInput['skills']
): Promise<void> {
  const skillsDir = path.join(configBase, layout.skillDir);
  await fs.mkdir(skillsDir, { recursive: true });

  for (const skill of skills) {
    const safeName = sanitizeFileName(skill.name);
    const skillDir = path.join(skillsDir, safeName);
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(
      path.join(skillDir, 'SKILL.md'),
      skill.content,
      'utf-8'
    );
  }
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_\-\s]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 64) || 'unnamed';
}
