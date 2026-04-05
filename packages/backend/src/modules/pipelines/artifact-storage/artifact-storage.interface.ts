export const ARTIFACT_STORAGE = Symbol('ARTIFACT_STORAGE');

export interface ArtifactStorage {
  /**
   * Write artifact content and return a storage reference (opaque string).
   * The ref format depends on the implementation, e.g. "fs:///abs/path/file".
   */
  write(
    pipelineId: string,
    name: string,
    content: string | Buffer,
    contentType: string
  ): Promise<string>;

  /**
   * Read artifact content by its storage reference.
   */
  read(ref: string): Promise<Buffer>;

  /**
   * Delete an artifact by its storage reference.
   */
  delete(ref: string): Promise<void>;

  /**
   * Check whether an artifact exists by its storage reference.
   */
  exists(ref: string): Promise<boolean>;
}
