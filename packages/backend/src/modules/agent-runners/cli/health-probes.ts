import { execFile } from 'child_process';
import { Logger } from '@nestjs/common';

const logger = new Logger('CliHealthProbe');

type HealthStatus = 'online' | 'offline' | 'unknown';

const PROBE_TIMEOUT_MS = 10_000;

/**
 * Helper to optionally wrap commands in sudo if an executorUser is provided.
 */
function wrapCommand(
  executorUser: string | undefined,
  baseCommand: string,
  baseArgs: string[]
): { command: string; args: string[] } {
  if (executorUser) {
    return {
      command: 'sudo',
      args: ['-u', executorUser, '-i', baseCommand, ...baseArgs]
    };
  }
  return {
    command: baseCommand,
    args: baseArgs
  };
}

/**
 * Check Claude Code CLI health by running \`claude auth status --json\`.
 */
export async function probeClaudeCodeHealth(
  executorUser?: string
): Promise<HealthStatus> {
  try {
    const { command, args } = wrapCommand(executorUser, 'claude', [
      'auth',
      'status',
      '--json'
    ]);
    const output = await runProbeCommand(command, args);

    const parsed = JSON.parse(output) as Record<string, unknown>;
    if (parsed.loggedIn === true) {
      return 'online';
    }

    return 'offline';
  } catch (error) {
    logger.warn(
      `Claude Code health check failed: ${
        error instanceof Error ? error.message : 'unknown error'
      }`
    );
    return 'unknown';
  }
}

/**
 * Check Cursor CLI health by running \`agent about\`.
 * Cursor returns plain text, not JSON.
 */
export async function probeCursorCliHealth(
  executorUser?: string
): Promise<HealthStatus> {
  try {
    const { command, args } = wrapCommand(executorUser, 'agent', ['about']);
    const output = await runProbeCommand(command, args);

    // Check for login status in the text output
    if (output.includes('Not logged in')) {
      return 'offline';
    }

    // If output contains typical "about" information, CLI is available
    if (output.includes('CLI Version') || output.includes('Cursor')) {
      return 'online';
    }

    return 'unknown';
  } catch (error) {
    logger.warn(
      `Cursor CLI health check failed: ${
        error instanceof Error ? error.message : 'unknown error'
      }`
    );
    return 'unknown';
  }
}

/**
 * Check Qwen CLI health by running \`qwen auth status\`.
 * Qwen returns plain text with status markers.
 */
export async function probeQwenCliHealth(
  executorUser?: string
): Promise<HealthStatus> {
  try {
    const { command, args } = wrapCommand(executorUser, 'qwen', [
      'auth',
      'status'
    ]);
    const output = await runProbeCommand(command, args);

    // Look for the success marker
    if (output.includes('✓ Authentication Method:') || output.includes('Authentication Method:')) {
      return 'online';
    }

    // If the command succeeds but no auth marker, likely not logged in
    return 'offline';
  } catch (error) {
    logger.warn(
      `Qwen CLI health check failed: ${
        error instanceof Error ? error.message : 'unknown error'
      }`
    );
    return 'unknown';
  }
}

function runProbeCommand(
  command: string,
  args: string[]
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        timeout: PROBE_TIMEOUT_MS,
        env: buildProbeEnv()
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(
            new Error(
              `Probe command failed: ${error.message}${
                stderr ? ` — stderr: ${stderr.trim()}` : ''
              }`
            )
          );
          return;
        }

        resolve(stdout);
      }
    );
  });
}

function buildProbeEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  const keys = ['PATH', 'HOME', 'SHELL', 'USER', 'LANG', 'TERM'];
  for (const key of keys) {
    if (process.env[key]) {
      env[key] = process.env[key];
    }
  }
  return env;
}
