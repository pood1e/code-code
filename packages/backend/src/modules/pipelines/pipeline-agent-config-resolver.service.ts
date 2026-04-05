import { Injectable } from '@nestjs/common';

import {
  pipelineAgentConfigSchema,
  type PipelineAgentConfig,
  type PipelineStageType
} from '@agent-workbench/shared';

@Injectable()
export class PipelineAgentConfigResolverService {
  resolve(input: {
    stageType: PipelineStageType;
    stageState: unknown;
  }): PipelineAgentConfig {
    const stageState =
      input.stageState && typeof input.stageState === 'object'
        ? (input.stageState as Record<string, unknown>)
        : {};
    const rawAgentConfig =
      stageState.agentConfig && typeof stageState.agentConfig === 'object'
        ? stageState.agentConfig
        : {};

    return pipelineAgentConfigSchema.parse({
      workspaceResources: [],
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {},
      runtimeConfig: {},
      ...rawAgentConfig
    });
  }
}
