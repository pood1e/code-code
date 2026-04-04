import { describe, expect, it } from 'vitest';

import {
  createClaudeParserState,
  parseClaudeLine
} from '../src/modules/agent-runners/cli/parsers/claude-code.parser';
import {
  createCursorParserState,
  parseCursorLine
} from '../src/modules/agent-runners/cli/parsers/cursor-cli.parser';
import {
  createQwenParserState,
  parseQwenLine
} from '../src/modules/agent-runners/cli/parsers/qwen-cli.parser';

describe('CLI stream parsers', () => {
  it('Claude parser 应跳过非 JSON/未知事件，并解析 thinking/tool/message/result/error', () => {
    const state = createClaudeParserState('msg_claude');

    expect(parseClaudeLine('plain text', state)).toEqual([]);
    expect(
      parseClaudeLine(
        JSON.stringify({
          type: 'system',
          session_id: 'claude_session_1'
        }),
        state
      )
    ).toEqual([]);
    expect(state.sessionId).toBe('claude_session_1');
    expect(
      parseClaudeLine(
        JSON.stringify({
          type: 'message_start',
          message: { id: 'provider_message_1' }
        }),
        state
      )
    ).toEqual([]);

    const toolChunks = parseClaudeLine(
      JSON.stringify({
        type: 'content_block_start',
        content_block: {
          type: 'tool_use',
          id: 'tool_1',
          name: 'bash',
          input: { command: 'pwd' }
        }
      }),
      state
    );
    expect(toolChunks).toEqual([
      expect.objectContaining({
        kind: 'tool_use',
        messageId: 'msg_claude',
        data: {
          toolKind: 'shell',
          toolName: 'bash',
          callId: 'tool_1',
          args: { command: 'pwd' }
        }
      })
    ]);

    const thinkingChunks = parseClaudeLine(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          delta: {
            type: 'thinking_delta',
            thinking: '分析中'
          }
        }
      }),
      state
    );
    expect(thinkingChunks).toEqual([
      expect.objectContaining({
        kind: 'thinking_delta',
        messageId: 'msg_claude',
        data: {
          deltaText: '分析中',
          accumulatedText: '分析中'
        }
      })
    ]);

    const snapshotChunks = parseClaudeLine(
      JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              id: 'tool_snapshot_1',
              name: 'read_file',
              input: { path: 'AGENTS.md' }
            },
            { type: 'text', text: 'hello' },
            {
              type: 'tool_result',
              tool_use_id: 'tool_snapshot_1',
              tool_name: 'read_file',
              content: { ok: true }
            }
          ],
          usage: {
            input_tokens: 2,
            output_tokens: 3,
            cache_read_input_tokens: 1,
            model: 'claude-test'
          }
        }
      }),
      state
    );
    expect(snapshotChunks).toEqual([
      expect.objectContaining({
        kind: 'tool_use',
        messageId: 'msg_claude',
        data: {
          toolKind: 'fallback',
          toolName: 'read_file',
          callId: 'tool_snapshot_1',
          args: { path: 'AGENTS.md' }
        }
      }),
      expect.objectContaining({
        kind: 'message_delta',
        messageId: 'msg_claude',
        data: {
          deltaText: 'hello',
          accumulatedText: 'hello'
        }
      }),
      expect.objectContaining({
        kind: 'tool_use',
        messageId: 'msg_claude',
        data: {
          toolKind: 'fallback',
          toolName: 'read_file',
          callId: 'tool_snapshot_1',
          result: { ok: true }
        }
      }),
      expect.objectContaining({
        kind: 'usage',
        messageId: 'msg_claude',
        data: {
          inputTokens: 2,
          outputTokens: 3,
          cacheReadTokens: 1,
          modelId: 'claude-test'
        }
      })
    ]);

    const resultChunks = parseClaudeLine(
      JSON.stringify({
        type: 'result',
        result: 'hello done',
        stop_reason: 'end_turn',
        duration_ms: 120,
        usage: { input_tokens: 4, output_tokens: 5 }
      }),
      state
    );
    expect(resultChunks).toEqual([
      expect.objectContaining({
        kind: 'message_result',
        messageId: 'msg_claude',
        data: {
          text: 'hello done',
          stopReason: 'end_turn',
          durationMs: 120
        }
      }),
      expect.objectContaining({
        kind: 'usage',
        messageId: 'msg_claude',
        data: {
          inputTokens: 4,
          outputTokens: 5,
          cacheReadTokens: undefined,
          modelId: undefined
        }
      })
    ]);

    const errorChunks = parseClaudeLine(
      JSON.stringify({
        type: 'result',
        is_error: true,
        error: 'Claude crashed'
      }),
      state
    );
    expect(errorChunks).toEqual([
      expect.objectContaining({
        kind: 'error',
        messageId: 'msg_claude',
        data: {
          message: 'Claude crashed',
          code: 'CLI_RESULT_ERROR',
          recoverable: false
        }
      })
    ]);
  });

  it('Cursor parser 应把 assistant 快照转成 delta，并解析 thinking/tool/result/error', () => {
    const state = createCursorParserState('msg_cursor');

    expect(parseCursorLine('not-json', state)).toEqual([]);
    expect(
      parseCursorLine(
        JSON.stringify({ type: 'system', session_id: 'cursor_session_1' }),
        state
      )
    ).toEqual([]);
    expect(state.sessionId).toBe('cursor_session_1');

    const firstSnapshot = parseCursorLine(
      JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_call',
              call_id: 'cursor-tool-1',
              tool_name: 'grep',
              args: { pattern: 'session' }
            },
            { type: 'text', text: 'hel' },
            {
              type: 'tool_result',
              tool_use_id: 'cursor-tool-1',
              tool_name: 'grep',
              output: { matches: 2 }
            }
          ],
          usage: { input_tokens: 1, output_tokens: 2, model: 'cursor-test' }
        }
      }),
      state
    );
    expect(firstSnapshot).toEqual([
      expect.objectContaining({
        kind: 'tool_use',
        messageId: 'msg_cursor',
        data: {
          toolKind: 'file_grep',
          toolName: 'grep',
          callId: 'cursor-tool-1',
          args: { pattern: 'session' }
        }
      }),
      expect.objectContaining({
        kind: 'message_delta',
        messageId: 'msg_cursor',
        data: {
          deltaText: 'hel',
          accumulatedText: 'hel'
        }
      }),
      expect.objectContaining({
        kind: 'tool_use',
        messageId: 'msg_cursor',
        data: {
          toolKind: 'file_grep',
          toolName: 'grep',
          callId: 'cursor-tool-1',
          result: { matches: 2 },
          error: undefined
        }
      }),
      expect.objectContaining({
        kind: 'usage',
        messageId: 'msg_cursor',
        data: {
          inputTokens: 1,
          outputTokens: 2,
          cacheReadTokens: undefined,
          modelId: 'cursor-test'
        }
      })
    ]);

    const secondSnapshot = parseCursorLine(
      JSON.stringify({
        type: 'assistant',
        message: {
          content: [{ type: 'text', text: 'hello' }]
        }
      }),
      state
    );
    expect(secondSnapshot).toEqual([
      expect.objectContaining({
        kind: 'message_delta',
        messageId: 'msg_cursor',
        data: {
          deltaText: 'lo',
          accumulatedText: 'hello'
        }
      })
    ]);

    expect(
      parseCursorLine(
        JSON.stringify({
          type: 'stream_event',
          event: {
            type: 'thinking',
            text: '推理'
          }
        }),
        state
      )
    ).toEqual([
      expect.objectContaining({
        kind: 'thinking_delta',
        messageId: 'msg_cursor',
        data: {
          deltaText: '推理',
          accumulatedText: '推理'
        }
      })
    ]);

    expect(
      parseCursorLine(
        JSON.stringify({
          type: 'tool_call',
          subtype: 'completed',
          name: 'grep',
          call_id: 'cursor_tool_1',
          output: { ok: true }
        }),
        state
      )
    ).toEqual([
      expect.objectContaining({
        kind: 'tool_use',
        messageId: 'msg_cursor',
        data: {
          toolKind: 'file_grep',
          toolName: 'grep',
          callId: 'cursor_tool_1',
          result: { ok: true },
          error: undefined
        }
      })
    ]);

    expect(
      parseCursorLine(
        JSON.stringify({
          type: 'result',
          result: 'final text',
          duration_ms: 88
        }),
        state
      )
    ).toEqual([
      expect.objectContaining({
        kind: 'message_result',
        messageId: 'msg_cursor',
        data: {
          text: 'final text',
          stopReason: 'end_turn',
          durationMs: 88
        }
      })
    ]);

    expect(
      parseCursorLine(
        JSON.stringify({
          type: 'result',
          is_error: true,
          result: 'Cursor failed'
        }),
        state
      )
    ).toEqual([
      expect.objectContaining({
        kind: 'error',
        messageId: 'msg_cursor',
        data: {
          message: 'Cursor failed',
          code: 'CLI_RESULT_ERROR',
          recoverable: false
        }
      })
    ]);
  });

  it('Qwen parser 应解析三层嵌套 stream_event、assistant 快照、result/error，并跳过无效行', () => {
    const state = createQwenParserState('msg_qwen');

    expect(parseQwenLine('{invalid', state)).toEqual([]);
    expect(
      parseQwenLine(
        JSON.stringify({ type: 'system', session_id: 'qwen_session_1' }),
        state
      )
    ).toEqual([]);
    expect(state.sessionId).toBe('qwen_session_1');

    expect(
      parseQwenLine(
        JSON.stringify({
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            delta: {
              type: 'thinking_delta',
              thinking: '先想一下'
            }
          }
        }),
        state
      )
    ).toEqual([
      expect.objectContaining({
        kind: 'thinking_delta',
        messageId: 'msg_qwen',
        data: {
          deltaText: '先想一下',
          accumulatedText: '先想一下'
        }
      })
    ]);

    expect(
      parseQwenLine(
        JSON.stringify({
          type: 'stream_event',
          event: {
            type: 'content_block_start',
            content_block: {
              type: 'tool_use',
              id: 'qwen_tool_1',
              name: 'search',
              input: { query: 'qwen' }
            }
          }
        }),
        state
      )
    ).toEqual([
      expect.objectContaining({
        kind: 'tool_use',
        messageId: 'msg_qwen',
        data: {
          toolKind: 'web_search',
          toolName: 'search',
          callId: 'qwen_tool_1',
          args: { query: 'qwen' }
        }
      })
    ]);

    expect(
      parseQwenLine(
        JSON.stringify({
          type: 'assistant',
          message: {
            content: [
              {
                type: 'tool_use',
                id: 'qwen_tool_snapshot_1',
                name: 'search',
                input: { query: 'qwen' }
              },
              { type: 'text', text: '你好' },
              {
                type: 'tool_result',
                tool_use_id: 'qwen_tool_snapshot_1',
                tool_name: 'search',
                content: { hits: 1 }
              }
            ],
            usage: {
              input_tokens: 9,
              output_tokens: 8,
              cache_read_input_tokens: 7,
              model: 'qwen-test'
            }
          }
        }),
        state
      )
    ).toEqual([
      expect.objectContaining({
        kind: 'tool_use',
        messageId: 'msg_qwen',
        data: {
          toolKind: 'web_search',
          toolName: 'search',
          callId: 'qwen_tool_snapshot_1',
          args: { query: 'qwen' }
        }
      }),
      expect.objectContaining({
        kind: 'message_delta',
        messageId: 'msg_qwen',
        data: {
          deltaText: '你好',
          accumulatedText: '你好'
        }
      }),
      expect.objectContaining({
        kind: 'tool_use',
        messageId: 'msg_qwen',
        data: {
          toolKind: 'web_search',
          toolName: 'search',
          callId: 'qwen_tool_snapshot_1',
          result: { hits: 1 }
        }
      }),
      expect.objectContaining({
        kind: 'usage',
        messageId: 'msg_qwen',
        data: {
          inputTokens: 9,
          outputTokens: 8,
          cacheReadTokens: 7,
          modelId: 'qwen-test'
        }
      })
    ]);

    expect(
      parseQwenLine(
        JSON.stringify({
          type: 'result',
          result: '完成',
          duration_ms: 77
        }),
        state
      )
    ).toEqual([
      expect.objectContaining({
        kind: 'message_result',
        messageId: 'msg_qwen',
        data: {
          text: '完成',
          stopReason: 'end_turn',
          durationMs: 77
        }
      })
    ]);

    expect(
      parseQwenLine(
        JSON.stringify({
          type: 'result',
          is_error: true,
          result: 'Qwen failed'
        }),
        state
      )
    ).toEqual([
      expect.objectContaining({
        kind: 'error',
        messageId: 'msg_qwen',
        data: {
          message: 'Qwen failed',
          code: 'CLI_RESULT_ERROR',
          recoverable: false
        }
      })
    ]);
  });
});
