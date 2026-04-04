import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

import type { ArtifactStorage } from './artifact-storage.interface';

const FS_SCHEME = 'fs://';

/**
 * File-system backed artifact storage.
 *
 * Storage ref format: "fs:///absolute/path/to/file"
 *
 * All artifacts are placed under:
 *   <baseDir>/<pipelineId>/<name>
 *
 * baseDir defaults to the process working directory joined with ".agent-workbench/artifacts".
 * Override via constructor injection for testing.
 */
@Injectable()
export class FsArtifactStorage implements ArtifactStorage {
  private readonly baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir =
      baseDir ??
      path.join(process.cwd(), '.agent-workbench', 'artifacts');
  }

  async write(
    pipelineId: string,
    name: string,
    content: string | Buffer,
    _contentType: string
  ): Promise<string> {
    const dir = path.join(this.baseDir, pipelineId);
    await fs.mkdir(dir, { recursive: true });

    const filePath = path.join(dir, name);
    await fs.writeFile(filePath, content);

    return `${FS_SCHEME}${filePath}`;
  }

  async read(ref: string): Promise<Buffer> {
    const filePath = this.resolveRef(ref);
    return fs.readFile(filePath);
  }

  async delete(ref: string): Promise<void> {
    const filePath = this.resolveRef(ref);
    await fs.rm(filePath, { force: true });
  }

  async exists(ref: string): Promise<boolean> {
    const filePath = this.resolveRef(ref);
    return fs
      .access(filePath)
      .then(() => true)
      .catch(() => false);
  }

  private resolveRef(ref: string): string {
    if (!ref.startsWith(FS_SCHEME)) {
      throw new Error(`Unsupported artifact storage ref: ${ref}`);
    }
    return ref.slice(FS_SCHEME.length);
  }
}
