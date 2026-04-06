import { Injectable } from '@nestjs/common';
import {
  GovernanceAutomationStage,
  resolveGovernanceRunnerIdForStage
} from '@agent-workbench/shared';

import { GovernanceRepository } from './governance.repository';

@Injectable()
export class GovernanceRunnerResolverService {
  constructor(
    private readonly governanceRepository: GovernanceRepository
  ) {}

  async resolveRunnerId(input: {
    scopeId: string;
    stageType: GovernanceAutomationStage;
  }) {
    const policy =
      await this.governanceRepository.getOrCreateGovernancePolicy(input.scopeId);
    const configuredRunnerId = resolveGovernanceRunnerIdForStage(
      policy.runnerSelection,
      input.stageType
    );
    if (!configuredRunnerId) {
      return null;
    }

    const runnerExists =
      await this.governanceRepository.agentRunnerExists(configuredRunnerId);
    return runnerExists ? configuredRunnerId : null;
  }
}
