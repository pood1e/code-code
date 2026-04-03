import type { RawOutputChunk } from '../../runner-type.interface';

/**
 * Parser state maintained across lines for a single Cursor CLI run.
 */
export type CursorParserState = {
  messageId: string;
  sessionId: string | null;
  assistantBuffer: string;
  reasoningBuffer: string;
};

export function createCursorParserState(messageId: string): CursorParserState {
  return {
    messageId,
    sessionId: null,
    assistantBuffer: '',
    reasoningBuffer: ''
  };
}

/**
 * Parse a single line of Cursor CLI stream-json output into RawOutputChunks.
 *
 * Cursor's key characteristic: assistant output is a **snapshot** of the full text,
 * not a delta. The parser must diff against the accumulated buffer to produce deltas.
 *
 * Known top-level types:
 * - system (init with session_id, model, etc.)
 * - user (user input echo)
 * - assistant (full text snapshot at each step)
 * - thinking (reasoning text)
 * - tool_call (with subtypes: started, completed)
 * - result (final summary with text, usage, error)
 */
export function parseCursorLine(
  line: string,
  state: CursorParserState
): RawOutputChunk[] {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return [];
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return [];
  }

  const now = Date.now();

  // Extract session_id
  if (typeof parsed.session_id === 'string' && !state.sessionId) {
    state.sessionId = parsed.session_id;
  }

  const topType = parsed.type as string | undefined;

  // --- system init ---
  if (topType === 'system') {
    // No output chunks; session_id is already extracted
    return [];
  }

  // --- stream_event wrapper (some Cursor versions wrap events) ---
  if (topType === 'stream_event') {
    const event = parsed.event as Record<string, unknown> | undefined;
    if (event) {
      return parseCursorEvent(event, state, now);
    }
    return [];
  }

  return parseCursorEvent(parsed, state, now);
}

function parseCursorEvent(
  parsed: Record<string, unknown>,
  state: CursorParserState,
  now: number
): RawOutputChunk[] {
  const topType = parsed.type as string | undefined;
  const chunks: RawOutputChunk[] = [];

  // --- assistant (snapshot) ---
  if (topType === 'assistant') {
    const message = parsed.message as Record<string, unknown> | undefined;
    const content = message?.content as
      | Array<Record<string, unknown>>
      | undefined;

    if (content && Array.isArray(content)) {
      for (const block of content) {
        if (block.type === 'text' && typeof block.text === 'string') {
          const fullText = block.text;

          // Snapshot diff: only emit the new part
          if (fullText.length > state.assistantBuffer.length) {
            const deltaText = fullText.slice(state.assistantBuffer.length);
            state.assistantBuffer = fullText;
            chunks.push({
              kind: 'message_delta',
              messageId: state.messageId,
              timestampMs: now,
              data: {
                deltaText,
                accumulatedText: fullText
              }
            });
          }
        }
      }
    }

    // Check for inline usage
    const usage = (message?.usage ?? parsed.usage) as
      | Record<string, unknown>
      | undefined;
    if (usage) {
      chunks.push({
        kind: 'usage',
        messageId: state.messageId,
        timestampMs: now,
        data: mapUsage(usage)
      });
    }

    return chunks;
  }

  // --- thinking ---
  if (topType === 'thinking' || topType === 'thinking_delta') {
    const text = (parsed.thinking ?? parsed.text ?? '') as string;
    if (text) {
      state.reasoningBuffer += text;
      chunks.push({
        kind: 'thinking_delta',
        messageId: state.messageId,
        timestampMs: now,
        data: {
          deltaText: text,
          accumulatedText: state.reasoningBuffer
        }
      });
    }
    return chunks;
  }

  if (topType === 'thinking_done') {
    // Reasoning block complete — clear buffer
    state.reasoningBuffer = '';
    return [];
  }

  // --- content_block_delta (some Cursor versions use this directly) ---
  if (topType === 'content_block_delta') {
    const delta = parsed.delta as Record<string, unknown> | undefined;
    if (!delta) return [];

    const deltaType = delta.type as string | undefined;

    if (deltaType === 'thinking_delta') {
      const text = (delta.thinking ?? '') as string;
      if (text) {
        state.reasoningBuffer += text;
        chunks.push({
          kind: 'thinking_delta',
          messageId: state.messageId,
          timestampMs: now,
          data: {
            deltaText: text,
            accumulatedText: state.reasoningBuffer
          }
        });
      }
    } else if (deltaType === 'text_delta') {
      const text = (delta.text ?? '') as string;
      if (text) {
        state.assistantBuffer += text;
        chunks.push({
          kind: 'message_delta',
          messageId: state.messageId,
          timestampMs: now,
          data: {
            deltaText: text,
            accumulatedText: state.assistantBuffer
          }
        });
      }
    }
    return chunks;
  }

  // --- tool_call ---
  if (topType === 'tool_call') {
    const subtype = parsed.subtype as string | undefined;

    if (subtype === 'started' || !subtype) {
      chunks.push({
        kind: 'tool_use',
        messageId: state.messageId,
        timestampMs: now,
        data: {
          toolName: (parsed.tool_name ?? parsed.name ?? 'unknown') as string,
          callId: parsed.call_id as string | undefined,
          args: parsed.args ?? parsed.input
        }
      });
    }

    if (subtype === 'completed') {
      // Completed tool call — may embed result
      const result = parsed.result ?? parsed.output;
      const error = parsed.error;

      chunks.push({
        kind: 'tool_use',
        messageId: state.messageId,
        timestampMs: now,
        data: {
          toolName: (parsed.tool_name ?? parsed.name ?? 'unknown') as string,
          callId: parsed.call_id as string | undefined,
          result: result ?? undefined,
          error: error ?? undefined
        }
      });
    }

    return chunks;
  }

  // --- result ---
  if (topType === 'result') {
    return parseResult(parsed, state, now);
  }

  return chunks;
}

function parseResult(
  parsed: Record<string, unknown>,
  state: CursorParserState,
  now: number
): RawOutputChunk[] {
  const chunks: RawOutputChunk[] = [];
  const isError = parsed.is_error === true;

  if (isError) {
    const errorMessage =
      typeof parsed.result === 'string'
        ? parsed.result
        : 'Cursor CLI execution failed';

    chunks.push({
      kind: 'error',
      messageId: state.messageId,
      timestampMs: now,
      data: {
        message: errorMessage,
        code: 'CLI_RESULT_ERROR',
        recoverable: false
      }
    });
    return chunks;
  }

  const resultText =
    typeof parsed.result === 'string' ? parsed.result : state.assistantBuffer;

  chunks.push({
    kind: 'message_result',
    messageId: state.messageId,
    timestampMs: now,
    data: {
      text: resultText,
      stopReason: 'end_turn',
      durationMs:
        typeof parsed.duration_ms === 'number' ? parsed.duration_ms : undefined
    }
  });

  const usage = parsed.usage as Record<string, unknown> | undefined;
  if (usage) {
    chunks.push({
      kind: 'usage',
      messageId: state.messageId,
      timestampMs: now,
      data: mapUsage(usage)
    });
  }

  return chunks;
}

function mapUsage(
  usage: Record<string, unknown>
): Extract<RawOutputChunk, { kind: 'usage' }>['data'] {
  return {
    inputTokens:
      typeof usage.input_tokens === 'number' ? usage.input_tokens : undefined,
    outputTokens:
      typeof usage.output_tokens === 'number' ? usage.output_tokens : undefined,
    cacheReadTokens:
      typeof usage.cache_read_input_tokens === 'number'
        ? usage.cache_read_input_tokens
        : undefined,
    modelId: typeof usage.model === 'string' ? usage.model : undefined
  };
}
