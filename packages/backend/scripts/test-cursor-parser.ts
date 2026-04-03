import * as assert from 'node:assert';
import { test } from 'node:test';
import {
  parseCursorLine,
  createCursorParserState
} from '../src/modules/agent-runners/cli/parsers/cursor-cli.parser';
import type { RawOutputChunk } from '../src/modules/agent-runners/runner-type.interface';

const sampleData = `
{"type":"system","session_id":"cursor-session-abc"}
{"type":"assistant","message":{"content":[{"type":"text","text":"Hello"}]}}
{"type":"assistant","message":{"content":[{"type":"text","text":"Hello World"}]}}
{"type":"assistant","message":{"content":[{"type":"text","text":"Hello World!"}],"usage":{"input_tokens":5,"output_tokens":3}}}
{"type":"thinking","text":"Let me think"}
{"type":"thinking","text":" about this"}
{"type":"thinking_done"}
{"type":"tool_call","subtype":"started","call_id":"call-1","tool_name":"read_file","args":{"path":"foo.txt"}}
{"type":"tool_call","subtype":"completed","call_id":"call-1","tool_name":"read_file","result":"File content"}
{"type":"result","is_error":false,"result":"Hello World!","usage":{"input_tokens":5,"output_tokens":3}}
`
  .trim()
  .split('\n');

test('Cursor parser maps stream-json to output chunks correctly (diffs snapshots)', () => {
  const state = createCursorParserState('msg-id-2');
  const allChunks: RawOutputChunk[] = [];

  for (const line of sampleData) {
    const chunks = parseCursorLine(line, state);
    allChunks.push(...chunks);
  }

  assert.strictEqual(state.sessionId, 'cursor-session-abc');
  assert.strictEqual(state.assistantBuffer, 'Hello World!');
  // reasoning buffer should be cleared on thinking_done
  assert.strictEqual(state.reasoningBuffer, '');

  const textDeltas = allChunks.filter((c) => c.kind === 'message_delta');
  assert.strictEqual(textDeltas.length, 3);
  assert.strictEqual((textDeltas[0] as any).data.deltaText, 'Hello');
  assert.strictEqual((textDeltas[1] as any).data.deltaText, ' World');
  assert.strictEqual((textDeltas[2] as any).data.deltaText, '!');

  const thinkingDeltas = allChunks.filter((c) => c.kind === 'thinking_delta');
  assert.strictEqual(thinkingDeltas.length, 2);
  assert.strictEqual((thinkingDeltas[0] as any).data.deltaText, 'Let me think');
  assert.strictEqual((thinkingDeltas[1] as any).data.deltaText, ' about this');

  const toolCalls = allChunks.filter((c) => c.kind === 'tool_use');
  assert.strictEqual(toolCalls.length, 2);
  assert.strictEqual((toolCalls[0] as any).data.callId, 'call-1');
  assert.deepStrictEqual((toolCalls[0] as any).data.args, { path: 'foo.txt' });
  assert.strictEqual((toolCalls[1] as any).data.result, 'File content');
});
