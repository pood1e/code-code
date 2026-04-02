/**
 * Splits a continuous byte/string stream into complete lines.
 *
 * Handles partial lines by buffering until a newline is encountered.
 * Guarantees that every string returned by `feed()` is a complete line
 * (without the trailing newline character).
 */
export class LineDecoder {
  private buffer = '';

  /**
   * Feed a chunk of text into the decoder.
   * @returns An array of complete lines (may be empty if no newline yet).
   */
  feed(chunk: string): string[] {
    this.buffer += chunk;
    const parts = this.buffer.split('\n');
    // The last element is either an incomplete line or '' (if chunk ended with \n).
    this.buffer = parts.pop() ?? '';
    return parts;
  }

  /**
   * Flush any remaining buffered content as a final line.
   * Call this when the stream ends to avoid losing a trailing incomplete line.
   * @returns The remaining content, or `null` if the buffer is empty.
   */
  flush(): string | null {
    if (this.buffer.length === 0) {
      return null;
    }

    const remaining = this.buffer;
    this.buffer = '';
    return remaining;
  }
}
