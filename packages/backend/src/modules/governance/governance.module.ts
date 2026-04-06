import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SessionsModule } from '../sessions/sessions.module';
import { GovernanceAgentFanoutService } from './governance-agent-fanout.service';
import { GovernanceAutomationAttemptService } from './governance-automation-attempt.service';
import { GovernanceAutomationService } from './governance-automation.service';
import { GovernanceBaselineService } from './governance-baseline.service';
import { GovernanceController } from './governance.controller';
import { GovernanceGitService } from './governance-git.service';
import { GovernanceNotificationService } from './governance-notification.service';
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
  imports: [PrismaModule, SessionsModule, NotificationsModule],
  controllers: [GovernanceController],
  providers: [
    GovernanceQueryService,
    GovernanceService,
    GovernanceAutomationService,
    GovernanceAgentFanoutService,
    GovernanceAutomationAttemptService,
    GovernancePolicyEvaluatorService,
    GovernancePromptService,
    GovernanceOutputParserService,
    GovernanceRunnerBridgeService,
    GovernanceRunnerResolverService,
    GovernanceBaselineService,
    GovernanceGitService,
    GovernanceNotificationService,
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
