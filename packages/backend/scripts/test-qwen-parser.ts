import * as assert from 'node:assert';
import { test } from 'node:test';
import {
  parseQwenLine,
  createQwenParserState
} from '../src/modules/agent-runners/cli/parsers/qwen-cli.parser';
import type { RawOutputChunk } from '../src/modules/agent-runners/runner-type.interface';

const sampleData = `
{"type":"system","subtype":"init","session_id":"session-123"}
{"type":"stream_event","event":{"type":"message_start","message":{"id":"msg-1","role":"assistant","content":[]}}}
{"type":"stream_event","event":{"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":"","signature":""}}}
{"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"Let me think"}}}
{"type":"stream_event","event":{"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}}
{"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello "}}}
{"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"World"}}}
{"type":"assistant","message":{"id":"msg-1","role":"assistant","content":[{"type":"text","text":"Hello World"}],"usage":{"input_tokens":10,"output_tokens":5}}}
{"type":"result","subtype":"success","is_error":false,"result":"Hello World","usage":{"input_tokens":10,"output_tokens":5}}
`
  .trim()
  .split('\n');

test('Qwen parser maps stream-json to output chunks correctly', () => {
  const state = createQwenParserState('msg-id-1');
  const allChunks: RawOutputChunk[] = [];

  for (const line of sampleData) {
    const chunks = parseQwenLine(line, state);
    allChunks.push(...chunks);
  }

  assert.strictEqual(state.sessionId, 'session-123');
  assert.strictEqual(state.reasoningBuffer, 'Let me think');
  assert.strictEqual(state.assistantBuffer, 'Hello World');

  // Verify chunks
  const thinkingChunks = allChunks.filter((c) => c.kind === 'thinking_delta');
  assert.strictEqual(thinkingChunks.length, 1);
  assert.strictEqual((thinkingChunks[0] as any).data.deltaText, 'Let me think');

  const msgChunks = allChunks.filter((c) => c.kind === 'message_delta');
  assert.strictEqual(msgChunks.length, 2);
  assert.strictEqual((msgChunks[0] as any).data.deltaText, 'Hello ');
  assert.strictEqual((msgChunks[1] as any).data.deltaText, 'World');

  const usageChunks = allChunks.filter((c) => c.kind === 'usage');
  assert.strictEqual(usageChunks.length, 2); // One from assistant, one from result
  assert.strictEqual((usageChunks[0] as any).data.inputTokens, 10);

  const resultChunks = allChunks.filter((c) => c.kind === 'message_result');
  assert.strictEqual(resultChunks.length, 1);
  assert.strictEqual((resultChunks[0] as any).data.text, 'Hello World');
});
