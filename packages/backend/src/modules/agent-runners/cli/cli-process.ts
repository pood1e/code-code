import { spawn, type ChildProcess } from 'child_process';
import { Logger } from '@nestjs/common';
import { LineDecoder } from './line-decoder';

const logger = new Logger('CliProcess');

/** Minimal environment variables to inherit from the current process. */
const INHERITED_ENV_KEYS = ['PATH', 'HOME', 'SHELL', 'USER', 'LANG', 'TERM'];

export type CliProcessOptions = {
  command: string;
  args: string[];
  cwd: string;
  /** Extra environment variables to set. Merged on top of the inherited base set. */
  env?: Record<string, string>;
  /** Timeout in ms before escalating SIGTERM to SIGKILL. Default: 5000. */
  killTimeoutMs?: number;
};

export type CliProcessResult = {
  exitCode: number | null;
  signal: string | null;
};

/**
 * Manages a single CLI child process with line-oriented stdout consumption.
 *
 * Usage:
 *   1. Call `start()` to spawn the process.
 *   2. Register `onLine(cb)` before or after start — buffered lines will replay.
 *   3. Optionally write to stdin via `writeStdin()`.
 *   4. Call `kill()` to terminate, or await `waitForExit()`.
 */
export class CliProcess {
  private process: ChildProcess | null = null;
  private readonly lineDecoder = new LineDecoder();
  private lineCallback: ((line: string) => void) | null = null;
  private exitResolve: ((result: CliProcessResult) => void) | null = null;
  private exitPromise: Promise<CliProcessResult>;
  private killed = false;
  private stderrChunks: string[] = [];

  constructor(private readonly options: CliProcessOptions) {
    this.exitPromise = new Promise((resolve) => {
      this.exitResolve = resolve;
    });
  }

  start(): void {
    if (this.process) {
      throw new Error('CliProcess already started');
    }

    const baseEnv: Record<string, string> = {};
    for (const key of INHERITED_ENV_KEYS) {
      if (process.env[key]) {
        baseEnv[key] = process.env[key] as string;
      }
    }

    const mergedEnv = { ...baseEnv, ...this.options.env };

    logger.debug(
      `Spawning: ${this.options.command} ${this.options.args.join(' ')} (cwd: ${this.options.cwd})`
    );

    this.process = spawn(this.options.command, this.options.args, {
      cwd: this.options.cwd,
      env: mergedEnv,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.process.stdout?.setEncoding('utf-8');
    this.process.stderr?.setEncoding('utf-8');

    this.process.stdout?.on('data', (chunk: string) => {
      const lines = this.lineDecoder.feed(chunk);
      for (const line of lines) {
        this.lineCallback?.(line);
      }
    });

    this.process.stderr?.on('data', (chunk: string) => {
      this.stderrChunks.push(chunk);
    });

    this.process.on('close', (code, signal) => {
      // Flush any remaining buffered content
      const remaining = this.lineDecoder.flush();
      if (remaining) {
        this.lineCallback?.(remaining);
      }

      if (this.stderrChunks.length > 0) {
        const stderrText = this.stderrChunks.join('').trim();
        if (stderrText.length > 0) {
          logger.warn(`CLI stderr [${this.options.command}]: ${stderrText}`);
        }
      }

      this.exitResolve?.({
        exitCode: code,
        signal: signal ?? null
      });
    });

    this.process.on('error', (error) => {
      logger.error(
        `CLI process error [${this.options.command}]: ${error.message}`
      );
      this.exitResolve?.({
        exitCode: null,
        signal: null
      });
    });
  }

  /**
   * Register a callback for each complete line from stdout.
   * Only one callback is supported; calling again replaces the previous one.
   */
  onLine(callback: (line: string) => void): void {
    this.lineCallback = callback;
  }

  /**
   * Write data to the process's stdin.
   */
  writeStdin(data: string): void {
    if (!this.process?.stdin?.writable) {
      throw new Error('Process stdin is not writable');
    }

    this.process.stdin.write(data);
  }

  /**
   * Gracefully terminate the process (SIGTERM), escalating to SIGKILL after timeout.
   */
  kill(): void {
    if (this.killed || !this.process) {
      return;
    }

    this.killed = true;
    const killTimeout = this.options.killTimeoutMs ?? 5_000;

    this.process.kill('SIGTERM');

    const forceKillTimer = setTimeout(() => {
      if (this.process && !this.process.killed) {
        logger.warn(
          `Force-killing CLI process [${this.options.command}] after ${killTimeout}ms`
        );
        this.process.kill('SIGKILL');
      }
    }, killTimeout);

    void this.exitPromise.then(() => {
      clearTimeout(forceKillTimer);
    });
  }

  /**
   * Wait for the process to exit. Resolves with exit code and signal.
   */
  waitForExit(): Promise<CliProcessResult> {
    return this.exitPromise;
  }

  /**
   * Returns collected stderr output so far.
   */
  getStderr(): string {
    return this.stderrChunks.join('');
  }

  get isRunning(): boolean {
    return this.process !== null && !this.killed && this.process.exitCode === null;
  }
}
