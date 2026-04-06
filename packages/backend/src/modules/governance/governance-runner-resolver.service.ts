import { Injectable } from '@nestjs/common';
import {
  GovernanceAutomationStage,
  type GovernanceStageAgentStrategy,
  resolveGovernanceAgentStrategyForStage
} from '@agent-workbench/shared';

import { GovernanceRepository } from './governance.repository';

@Injectable()
export class GovernanceRunnerResolverService {
  constructor(
    private readonly governanceRepository: GovernanceRepository
  ) {}

  async resolveStageAgentStrategy(input: {
    scopeId: string;
    stageType: GovernanceAutomationStage;
  }): Promise<GovernanceStageAgentStrategy | null> {
    const policy =
      await this.governanceRepository.getOrCreateGovernancePolicy(input.scopeId);
    const configuredStrategy = resolveGovernanceAgentStrategyForStage(
      policy.agentStrategy,
      input.stageType
    );
    if (!configuredStrategy) {
      return null;
    }

    const existingRunnerIds = (
      await Promise.all(
        configuredStrategy.runnerIds.map(async (runnerId) =>
          (await this.governanceRepository.agentRunnerExists(runnerId))
            ? runnerId
            : null
        )
      )
    ).filter((runnerId): runnerId is string => runnerId !== null);
    if (existingRunnerIds.length === 0) {
      return null;
    }

    return {
      runnerIds: existingRunnerIds,
      fanoutCount: Math.max(
        1,
        Math.min(configuredStrategy.fanoutCount, existingRunnerIds.length)
      ),
      mergeStrategy: configuredStrategy.mergeStrategy
    };
  }
}
