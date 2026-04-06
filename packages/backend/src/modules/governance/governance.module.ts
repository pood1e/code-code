import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { SessionsModule } from '../sessions/sessions.module';
import { GovernanceAutomationAttemptService } from './governance-automation-attempt.service';
import { GovernanceAutomationService } from './governance-automation.service';
import { GovernanceBaselineService } from './governance-baseline.service';
import { GovernanceController } from './governance.controller';
import { GovernanceGitService } from './governance-git.service';
import { GovernanceOutputParserService } from './governance-output-parser.service';
import { GovernancePolicyEvaluatorService } from './governance-policy-evaluator.service';
import { GovernancePromptService } from './governance-prompt.service';
import { GovernanceQueryService } from './governance-query.service';
import { GovernanceRepository } from './governance.repository';
import { GovernanceRunnerBridgeService } from './governance-runner-bridge.service';
import { GovernanceRunnerResolverService } from './governance-runner-resolver.service';
import { GovernanceService } from './governance.service';
import { GovernanceVerificationRunnerService } from './governance-verification-runner.service';
import { GovernanceWorkspaceService } from './governance-workspace.service';
import { PrismaGovernanceRepository } from './prisma-governance.repository';

@Module({
  imports: [PrismaModule, SessionsModule],
  controllers: [GovernanceController],
  providers: [
    GovernanceQueryService,
    GovernanceService,
    GovernanceAutomationService,
    GovernanceAutomationAttemptService,
    GovernancePolicyEvaluatorService,
    GovernancePromptService,
    GovernanceOutputParserService,
    GovernanceRunnerBridgeService,
    GovernanceRunnerResolverService,
    GovernanceBaselineService,
    GovernanceGitService,
    GovernanceWorkspaceService,
    GovernanceVerificationRunnerService,
    {
      provide: GovernanceRepository,
      useClass: PrismaGovernanceRepository
    }
  ],
  exports: [
    GovernanceQueryService,
    GovernanceService,
    GovernanceRepository,
    GovernanceAutomationService
  ]
})
export class GovernanceModule {}
