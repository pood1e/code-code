import { Injectable, type OnModuleInit } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import type { RunnerTypeResponse } from '@agent-workbench/shared';
import type { RunnerType } from './runner-type.interface';
import { RUNNER_TYPE_METADATA } from './runner-type.decorator';
import { zodToSchemaDescriptor } from './schema-descriptor.util';

@Injectable()
export class RunnerTypeRegistry implements OnModuleInit {
  private readonly runnerTypes: Map<string, RunnerType> = new Map();

  constructor(private readonly discoveryService: DiscoveryService) {}

  onModuleInit(): void {
    const providers = this.discoveryService.getProviders();

    for (const wrapper of providers) {
      const instance = wrapper.instance;
      if (!instance || !wrapper.metatype) continue;

      const isRunnerType = Reflect.getMetadata(
        RUNNER_TYPE_METADATA,
        wrapper.metatype
      );
      if (!isRunnerType) continue;

      const runnerType = instance as RunnerType;
      if (
        typeof runnerType.id === 'string' &&
        typeof runnerType.name === 'string'
      ) {
        this.register(runnerType);
      }
    }
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
      runnerConfigSchema: zodToSchemaDescriptor(runnerType.runnerConfigSchema),
      runnerSessionConfigSchema: zodToSchemaDescriptor(
        runnerType.runnerSessionConfigSchema
      ),
      inputSchema: zodToSchemaDescriptor(runnerType.inputSchema),
      taskConfigSchema: zodToSchemaDescriptor(runnerType.inputSchema),
      runtimeConfigSchema: zodToSchemaDescriptor(runnerType.runtimeConfigSchema)
    }));
  }

  has(id: string): boolean {
    return this.runnerTypes.has(id);
  }
}
