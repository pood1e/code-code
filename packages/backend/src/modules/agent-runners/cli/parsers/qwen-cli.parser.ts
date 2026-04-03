import type { RawOutputChunk } from '../../runner-type.interface';

/**
 * Parser state maintained across lines for a single Qwen CLI run.
 */
export type QwenParserState = {
  messageId: string;
  sessionId: string | null;
  assistantBuffer: string;
  reasoningBuffer: string;
};

export function createQwenParserState(messageId: string): QwenParserState {
  return {
    messageId,
    sessionId: null,
    assistantBuffer: '',
    reasoningBuffer: ''
  };
}

/**
 * Parse a single line of Qwen CLI stream-json output into RawOutputChunks.
 *
 * Qwen's protocol uses a three-layer nesting:
 *   top-level type → event.type → delta.type
 *
 * Known top-level types:
 * - system (subtype: init)
 * - stream_event (wraps Anthropic-style content events)
 * - assistant (full message snapshot with usage)
 * - result (subtype: success | error)
 */
export function parseQwenLine(
  line: string,
  state: QwenParserState
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

  // --- system.init ---
  if (topType === 'system') {
    // Extract session metadata; no output chunks produced
    return [];
  }

  // --- stream_event ---
  if (topType === 'stream_event') {
    return parseStreamEvent(parsed, state, now);
  }

  // --- assistant (full snapshot) ---
  if (topType === 'assistant') {
    return parseAssistantSnapshot(parsed, state, now);
  }

  // --- result ---
  if (topType === 'result') {
    return parseResult(parsed, state, now);
  }

  return [];
}

function parseStreamEvent(
  parsed: Record<string, unknown>,
  state: QwenParserState,
  now: number
): RawOutputChunk[] {
  const event = parsed.event as Record<string, unknown> | undefined;
  if (!event) {
    return [];
  }

  const eventType = event.type as string | undefined;
  const chunks: RawOutputChunk[] = [];

  if (eventType === 'content_block_delta') {
    const delta = event.delta as Record<string, unknown> | undefined;
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

  if (eventType === 'content_block_start') {
    const contentBlock = event.content_block as
      | Record<string, unknown>
      | undefined;
    if (!contentBlock) return [];

    if (contentBlock.type === 'tool_use') {
      chunks.push({
        kind: 'tool_use',
        messageId: state.messageId,
        timestampMs: now,
        data: {
          toolName: (contentBlock.name ?? 'unknown') as string,
          callId: contentBlock.id as string | undefined,
          args: contentBlock.input
        }
      });
    }

    return chunks;
  }

  // content_block_stop, message_start, message_stop — lifecycle, no output
  return [];
}

function parseAssistantSnapshot(
  parsed: Record<string, unknown>,
  state: QwenParserState,
  now: number
): RawOutputChunk[] {
  const chunks: RawOutputChunk[] = [];
  const message = parsed.message as Record<string, unknown> | undefined;

  if (message) {
    const content = message.content as
      | Array<Record<string, unknown>>
      | undefined;
    if (content && Array.isArray(content)) {
      for (const block of content) {
        if (block.type === 'text' && typeof block.text === 'string') {
          // Full snapshot — compute delta
          const fullText = block.text;
          if (fullText.length > state.assistantBuffer.length) {
            const delta = fullText.slice(state.assistantBuffer.length);
            state.assistantBuffer = fullText;
            chunks.push({
              kind: 'message_delta',
              messageId: state.messageId,
              timestampMs: now,
              data: {
                deltaText: delta,
                accumulatedText: fullText
              }
            });
          }
        }

        if (block.type === 'tool_result') {
          chunks.push({
            kind: 'tool_use',
            messageId: state.messageId,
            timestampMs: now,
            data: {
              toolName: (block.tool_name ?? 'unknown') as string,
              callId: block.tool_use_id as string | undefined,
              result: block.content
            }
          });
        }
      }
    }

    const usage = message.usage as Record<string, unknown> | undefined;
    if (usage) {
      chunks.push({
        kind: 'usage',
        messageId: state.messageId,
        timestampMs: now,
        data: mapUsage(usage)
      });
    }
  }

  return chunks;
}

function parseResult(
  parsed: Record<string, unknown>,
  state: QwenParserState,
  now: number
): RawOutputChunk[] {
  const chunks: RawOutputChunk[] = [];
  const isError = parsed.is_error === true;

  if (isError) {
    const errorMessage =
      typeof parsed.result === 'string'
        ? parsed.result
        : 'Qwen CLI execution failed';

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

  // Final result
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

  // Usage
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
