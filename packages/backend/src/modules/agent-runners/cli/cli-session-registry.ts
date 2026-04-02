import { Injectable, OnModuleDestroy } from '@nestjs/common';
import type { CliSessionHandle } from './cli-runner-base';

/**
 * DI-managed registry of active CLI session handles.
 * Replaces the module-level `activeSessions` Map for proper lifecycle management.
 */
@Injectable()
export class CliSessionRegistry implements OnModuleDestroy {
  private readonly sessions = new Map<string, CliSessionHandle>();

  get(sessionId: string): CliSessionHandle | undefined {
    return this.sessions.get(`cli:${sessionId}`);
  }

  register(sessionId: string, handle: CliSessionHandle): void {
    this.sessions.set(`cli:${sessionId}`, handle);
  }

  remove(sessionId: string): void {
    this.sessions.delete(`cli:${sessionId}`);
  }

  onModuleDestroy() {
    for (const handle of this.sessions.values()) {
      handle.cancelled = true;
      handle.process?.kill();
      handle.queue.close();
    }
    this.sessions.clear();
  }
}
