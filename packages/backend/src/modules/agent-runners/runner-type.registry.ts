import { Injectable } from '@nestjs/common';
import type { RunnerTypeResponse } from '@agent-workbench/shared';
import type { RunnerType } from './runner-type.interface';
import { convertZodSchemaToJsonSchema } from '../../utils/zod-to-json-schema';
import { ClaudeCodeRunnerType } from './runner-types/claude-code.runner-type';

@Injectable()
export class RunnerTypeRegistry {
  private readonly runnerTypes: Map<string, RunnerType> = new Map();

  constructor() {
    this.register(ClaudeCodeRunnerType);
  }

  register(runnerType: RunnerType): void {
    this.runnerTypes.set(runnerType.id, runnerType);
  }

  get(id: string): RunnerType | undefined {
    return this.runnerTypes.get(id);
  }

  getAll(): RunnerType[] {
    return Array.from(this.runnerTypes.values());
  }

  getAllResponses(): RunnerTypeResponse[] {
    return this.getAll().map((runnerType) => ({
      id: runnerType.id,
      name: runnerType.name,
      capabilities: runnerType.capabilities,
      runnerConfigSchema: convertZodSchemaToJsonSchema(
        runnerType.runnerConfigSchema
      ),
      runnerSessionConfigSchema: convertZodSchemaToJsonSchema(
        runnerType.runnerSessionConfigSchema
      ),
      inputSchema: convertZodSchemaToJsonSchema(
        runnerType.inputSchema
      ),
      // taskConfigSchema currently maps to inputSchema — will diverge when a dedicated task config schema is added
      taskConfigSchema: convertZodSchemaToJsonSchema(runnerType.inputSchema),
      runtimeConfigSchema: convertZodSchemaToJsonSchema(
        runnerType.runtimeConfigSchema
      )
    }));
  }

  has(id: string): boolean {
    return this.runnerTypes.has(id);
  }
}
