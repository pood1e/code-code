---
name: add-runner-type
description: Register a new CLI agent runner type (e.g., a new LLM CLI tool)
---

# Add Runner Type

Register a new CLI-based agent runner in `packages/backend/src/modules/agent-runners/runner-types/`.

## Inheritance Chain

```
RunnerType interface (runner-type.interface.ts)
  └─ CliRunnerBase (cli/cli-runner-base.ts)  — process lifecycle, JSONL parsing, health probes
       └─ <your-runner>.runner-type.ts       — CLI-specific args, output parsing
```

## Steps

### 1. Create runner file

`runner-types/<name>.runner-type.ts`:

```ts
import { z } from 'zod';
import { RunnerType as RunnerTypeDecorator } from '../runner-type.decorator';
import { CliRunnerBase } from '../cli/cli-runner-base';
import type { MaterializerTarget } from '../cli/context-materializer';

const RUNNER_CONFIG_SCHEMA = z.object({
  model: z.string().default('default-model').describe('context:models'),
  baseUrl: z.string().optional().describe('url')
});

const SESSION_CONFIG_SCHEMA = z.object({
  maxTurns: z.number().int().positive().optional(),
  permissionMode: z.enum(['auto', 'manual']).default('auto')
});

const INPUT_SCHEMA = z.object({
  prompt: z.string().min(1)
});

const RUNTIME_CONFIG_SCHEMA = z.object({
  model: z.string().optional().describe('context:models')
});

@RunnerTypeDecorator()
export class MyCliRunnerType extends CliRunnerBase {
  readonly id = 'my-cli';
  readonly name = 'My CLI Agent';
  readonly capabilities = { skill: true, rule: true, mcp: true };
  readonly runnerConfigSchema = RUNNER_CONFIG_SCHEMA;
  readonly runnerSessionConfigSchema = SESSION_CONFIG_SCHEMA;
  readonly inputSchema = INPUT_SCHEMA;
  readonly runtimeConfigSchema = RUNTIME_CONFIG_SCHEMA;
  readonly materializerTarget: MaterializerTarget = 'claude';

  // Implement abstract methods: buildCreateArgs, buildSendArgs, parseOutputLine, etc.
}
```

### 2. Zod schema conventions

| Pattern                      | Purpose                                                           |
| ---------------------------- | ----------------------------------------------------------------- |
| `.describe('context:<key>')` | Field fetches options from runner context API (e.g., models list) |
| `.describe('url')`           | Renders as URL input field                                        |
| `.default(value)`            | Pre-fills form field                                              |
| `.optional()`                | Non-required field                                                |

Schemas are converted to `SchemaDescriptor` via `zodToSchemaDescriptor()`.

### 3. Context materializer target

Set `materializerTarget` if the CLI needs MCP/Rule/Skill files on disk:

| Target   | Config Dir | MCP File                    | Rule Ext | Notes                                 |
| -------- | ---------- | --------------------------- | -------- | ------------------------------------- |
| `claude` | `.claude/` | `mcp.json`                  | `.mdc`   | Frontmatter `alwaysApply: true` added |
| `cursor` | `.cursor/` | `mcp.json` (workspace root) | `.mdc`   | Frontmatter `alwaysApply: true` added |
| `qwen`   | `.qwen/`   | `settings.json`             | `.md`    | Plain markdown                        |

Add a new target in `context-materializer.ts` if the CLI format is different.

### 4. Register in module

Add to `providers` in `agent-runners.module.ts`:

```ts
import { MyCliRunnerType } from './runner-types/my-cli.runner-type';

@Module({ providers: [/* ..., */ MyCliRunnerType] })
```

The `@RunnerType()` decorator handles auto-registration with `RunnerTypeRegistry`.

### 5. Output parsing

Implement `parseOutputLine()` to convert CLI output to `RawOutputChunk`:

| Kind             | Required Data                                                |
| ---------------- | ------------------------------------------------------------ |
| `thinking_delta` | `deltaText`                                                  |
| `message_delta`  | `deltaText`                                                  |
| `message_result` | `text`, optional `stopReason`, `durationMs`                  |
| `tool_use`       | `toolName`, optional `args`, `result`, `error`, `callId`     |
| `usage`          | optional `inputTokens`, `outputTokens`, `costUsd`, `modelId` |
| `error`          | `message`, `code`, `recoverable`                             |

Create a parser in `cli/parsers/<name>-parser.ts` if the CLI has a non-standard output format.

## Verification

```bash
pnpm build                                            # type-check
pnpm dev                                              # start server
curl http://localhost:3000/api/agent-runner-types      # verify new type appears
```

## Checklist

- [ ] Runner file with Zod schemas (L1, L2b, input, L4)
- [ ] `CliRunnerBase` abstract methods implemented
- [ ] `materializerTarget` set (if applicable)
- [ ] `@RunnerType()` decorator applied
- [ ] Added to `agent-runners.module.ts` providers
- [ ] Output parser implemented
- [ ] Health check + context probe implemented
