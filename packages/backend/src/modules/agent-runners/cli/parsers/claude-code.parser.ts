import type { RawOutputChunk } from '../../runner-type.interface';
import { mapClaudeToolKind } from './tool-kind';

/**
 * Parser state maintained across lines for a single Claude Code run.
 */
export type ClaudeParserState = {
  messageId: string;
  sessionId: string | null;
  assistantBuffer: string;
  reasoningBuffer: string;
};

export function createClaudeParserState(messageId: string): ClaudeParserState {
  return {
    messageId,
    sessionId: null,
    assistantBuffer: '',
    reasoningBuffer: ''
  };
}

/**
 * Parse a single line of Claude Code stream-json output into RawOutputChunks.
 *
 * Claude's stream-json output is NDJSON. Each line is a self-contained JSON object.
 * The parser maps Claude-native events to the platform's RawOutputChunk contract.
 *
 * Known top-level types from Claude stream-json:
 * - system (init event)
 * - assistant (partial or final message)
 * - result (completion summary with usage)
 * - content_block_start / content_block_delta / content_block_stop
 * - message_start / message_delta / message_stop
 */
export function parseClaudeLine(
  line: string,
  state: ClaudeParserState
): RawOutputChunk[] {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return [];
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    // Non-JSON line (e.g. plain text mode fallback) — skip silently
    return [];
  }

  const chunks: RawOutputChunk[] = [];
  const now = Date.now();

  // Extract session_id if present
  if (typeof parsed.session_id === 'string' && !state.sessionId) {
    state.sessionId = parsed.session_id;
  }

  const topType = parsed.type as string | undefined;

  // --- system init ---
  if (topType === 'system') {
    // Extract session metadata but don't produce output chunks.
    // session_id is already captured above.
    return [];
  }

  // --- stream_event (Claude uses Anthropic Messages API shape) ---
  if (
    topType === 'stream_event' ||
    topType === 'content_block_delta' ||
    topType === 'content_block_start'
  ) {
    return parseStreamEvent(parsed, state, now);
  }

  // --- assistant (full or partial message snapshot) ---
  if (topType === 'assistant') {
    return parseAssistantMessage(parsed, state, now);
  }

  // --- result (final summary) ---
  if (topType === 'result') {
    return parseResult(parsed, state, now);
  }

  if (
    topType === 'message_start' ||
    topType === 'message_delta' ||
    topType === 'message_stop'
  ) {
    return parseMessageLifecycle(parsed);
  }

  return chunks;
}

function parseStreamEvent(
  parsed: Record<string, unknown>,
  state: ClaudeParserState,
  now: number
): RawOutputChunk[] {
  const event = (parsed.event ?? parsed) as Record<string, unknown>;
  const eventType = event.type as string | undefined;

  if (!eventType) {
    return [];
  }

  const chunks: RawOutputChunk[] = [];

  if (eventType === 'content_block_delta') {
    const delta = event.delta as Record<string, unknown> | undefined;
    if (!delta) return [];

    const deltaType = delta.type as string | undefined;

    if (deltaType === 'thinking_delta' || deltaType === 'signature_delta') {
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
    } else if (deltaType === 'input_json_delta') {
      // Tool input streaming — we accumulate but don't emit until tool_use is complete
    }

    return chunks;
  }

  if (eventType === 'content_block_start') {
    const contentBlock = event.content_block as
      | Record<string, unknown>
      | undefined;
    if (!contentBlock) return [];

    const blockType = contentBlock.type as string | undefined;

    if (blockType === 'tool_use') {
      const toolName = (contentBlock.name ?? 'unknown') as string;
      chunks.push({
        kind: 'tool_use',
        messageId: state.messageId,
        timestampMs: now,
        data: {
          toolKind: mapClaudeToolKind(toolName),
          toolName,
          callId: contentBlock.id as string | undefined,
          args: contentBlock.input
        }
      });
    }

    return chunks;
  }

  if (eventType === 'content_block_stop') {
    // Block lifecycle — no direct output needed
    return [];
  }

  // Recursively handle nested event structures
  if (event.event && typeof event.event === 'object') {
    return parseStreamEvent(event.event as Record<string, unknown>, state, now);
  }

  return chunks;
}

function parseAssistantMessage(
  parsed: Record<string, unknown>,
  state: ClaudeParserState,
  now: number
): RawOutputChunk[] {
  const chunks: RawOutputChunk[] = [];
  const message = (parsed.message ?? parsed) as Record<string, unknown>;
  const content = message.content as Array<Record<string, unknown>> | undefined;
  const usage = message.usage as Record<string, unknown> | undefined;

  if (content && Array.isArray(content)) {
    for (const block of content) {
      if (block.type === 'text' && typeof block.text === 'string') {
        // Snapshot — compute delta from buffer
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

      if (block.type === 'tool_use') {
        const toolName = (block.name ?? 'unknown') as string;
        chunks.push({
          kind: 'tool_use',
          messageId: state.messageId,
          timestampMs: now,
          data: {
            toolKind: mapClaudeToolKind(toolName),
            toolName,
            callId: block.id as string | undefined,
            args: block.input
          }
        });
      }

      if (block.type === 'tool_result') {
        const toolName = (block.tool_name ?? 'unknown') as string;
        chunks.push({
          kind: 'tool_use',
          messageId: state.messageId,
          timestampMs: now,
          data: {
            toolKind: mapClaudeToolKind(toolName),
            toolName,
            callId: block.tool_use_id as string | undefined,
            result: block.content
          }
        });
      }
    }
  }

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

function parseResult(
  parsed: Record<string, unknown>,
  state: ClaudeParserState,
  now: number
): RawOutputChunk[] {
  const chunks: RawOutputChunk[] = [];
  const isError = parsed.is_error === true;

  if (isError) {
    const errorMessage =
      typeof parsed.error === 'string'
        ? parsed.error
        : typeof parsed.result === 'string'
          ? parsed.result
          : 'CLI execution failed';

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

  // Final result text
  const resultText =
    typeof parsed.result === 'string' ? parsed.result : state.assistantBuffer;

  chunks.push({
    kind: 'message_result',
    messageId: state.messageId,
    timestampMs: now,
    data: {
      text: resultText,
      stopReason: (parsed.stop_reason ?? 'end_turn') as string,
      durationMs:
        typeof parsed.duration_ms === 'number' ? parsed.duration_ms : undefined
    }
  });

  // Usage from result
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

function parseMessageLifecycle(
  parsed: Record<string, unknown>
): RawOutputChunk[] {
  // message_start / message_delta / message_stop are lifecycle markers.
  // For message_start, extract session_id if present.
  if (parsed.type === 'message_start') {
    const message = parsed.message as Record<string, unknown> | undefined;
    if (message?.id && typeof message.id === 'string') {
      // Could be used as CLI-side session correlation
    }
  }

  return [];
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
