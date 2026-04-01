import { Injectable, Logger } from '@nestjs/common';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export type StoredDeltaChunk = {
  eventId: number;
  sessionId: string;
  messageId: string;
  seq: number;
  timestampMs: number;
  kind: 'message_delta';
  data: {
    deltaText: string;
    accumulatedText?: string;
  };
};

@Injectable()
export class FileDeltaStore {
  private readonly logger = new Logger(FileDeltaStore.name);
  private readonly basePath =
    process.env.DELTA_STORE_BASE_PATH ??
    path.join(os.homedir(), '.agent-workbench', 'deltas');

  async append(chunk: StoredDeltaChunk) {
    const filePath = this.getFilePath(chunk.sessionId, chunk.messageId);
    await mkdir(path.dirname(filePath), { recursive: true });

    const currentContent = await this.readRawFile(filePath);
    const nextContent = currentContent
      ? `${currentContent}\n${JSON.stringify(chunk)}`
      : JSON.stringify(chunk);

    await writeFile(filePath, nextContent, 'utf8');
  }

  async *readAll(sessionId: string, messageId: string, afterSeq = -1) {
    const filePath = this.getFilePath(sessionId, messageId);
    const content = await this.readRawFile(filePath);
    if (!content) {
      return;
    }

    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      try {
        const chunk = JSON.parse(trimmed) as StoredDeltaChunk;
        if (chunk.seq > afterSeq) {
          yield chunk;
        }
      } catch (error) {
        this.logger.warn(
          `Skip invalid delta chunk for ${sessionId}/${messageId}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`
        );
      }
    }
  }

  async delete(sessionId: string, messageId: string) {
    const filePath = this.getFilePath(sessionId, messageId);
    try {
      await rm(filePath);
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        return;
      }

      throw error;
    }
  }

  private getFilePath(sessionId: string, messageId: string) {
    return path.join(this.basePath, sessionId, `${messageId}.jsonl`);
  }

  private async readRawFile(filePath: string) {
    try {
      return await readFile(filePath, 'utf8');
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        return '';
      }

      throw error;
    }
  }
}
