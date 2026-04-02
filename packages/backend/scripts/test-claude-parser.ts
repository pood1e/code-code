import * as assert from 'node:assert';
import { test } from 'node:test';
import {
  parseClaudeLine,
  createClaudeParserState
} from '../src/modules/agent-runners/cli/parsers/claude-code.parser';
import type { RawOutputChunk } from '../src/modules/agent-runners/runner-type.interface';

const sampleData = `
{"type":"system","session_id":"claude-session-1"}
{"type":"content_block_start","content_block":{"type":"tool_use","id":"toolu_01A","name":"bash","input":{"command":"ls"}}}
{"type":"content_block_delta","delta":{"type":"text_delta","text":"I will "}}
{"type":"content_block_delta","delta":{"type":"text_delta","text":"check now."}}
{"type":"assistant","message":{"content":[{"type":"text","text":"I will check now."},{"type":"tool_result","tool_use_id":"toolu_01A","tool_name":"bash","content":"file.txt"}]}}
{"type":"result","is_error":false,"result":"Done","usage":{"input_tokens":10,"output_tokens":2}}
`.trim().split('\n');

test('Claude parser maps stream-json to output chunks correctly', () => {
  const state = createClaudeParserState('msg-id-3');
  const allChunks: RawOutputChunk[] = [];

  for (const line of sampleData) {
    const chunks = parseClaudeLine(line, state);
    allChunks.push(...chunks);
  }

  assert.strictEqual(state.sessionId, 'claude-session-1');
  assert.strictEqual(state.assistantBuffer, 'I will check now.');

  const tools = allChunks.filter(c => c.kind === 'tool_use');
  assert.strictEqual(tools.length, 2);
  assert.strictEqual((tools[0] as any).data.toolName, 'bash');
  assert.deepStrictEqual((tools[0] as any).data.args, { command: 'ls' });
  assert.strictEqual((tools[1] as any).data.result, 'file.txt');

  const msgs = allChunks.filter(c => c.kind === 'message_delta');
  assert.strictEqual(msgs.length, 2);
  assert.strictEqual((msgs[0] as any).data.deltaText, 'I will ');
  assert.strictEqual((msgs[1] as any).data.deltaText, 'check now.');

  const results = allChunks.filter(c => c.kind === 'message_result');
  assert.strictEqual(results.length, 1);
  assert.strictEqual((results[0] as any).data.text, 'Done');
});
