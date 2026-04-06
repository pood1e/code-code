import { z } from 'zod';

import {
  GovernanceAssessmentSource,
  GovernanceAutomationStage,
  GovernanceAutomationSubjectType,
  GovernanceAutoActionEligibility,
  GovernanceChangeActionType,
  GovernanceChangePlanStatus,
  GovernanceChangeUnitStatus,
  GovernanceClusterBasis,
  GovernanceDeliveryArtifactKind,
  GovernanceDeliveryArtifactStatus,
  GovernanceDeliveryBodyStrategy,
  GovernanceDeliveryCommitMode,
  GovernanceExecutionMode,
  GovernanceExecutionAttemptStatus,
  GovernanceFindingSource,
  GovernanceFindingStatus,
  GovernanceIssueKind,
  GovernanceIssueStatus,
  GovernanceMergeTrigger,
  GovernancePriority,
  GovernanceResolutionType,
  GovernanceReviewDecisionType,
  GovernanceReviewSubjectType,
  GovernanceSeverity,
  GovernanceVerificationCheckType,
  GovernanceVerificationResultStatus,
  GovernanceVerificationSubjectType,
  GovernanceViolationPolicy,
  RepositoryBuildStatus
} from '../types/governance';

const idSchema = z.string().trim().min(1);
const isoDateTimeSchema = z.string().datetime();
const nonEmptyStringSchema = z.string().trim().min(1);

export const governanceEvidenceRefSchema = z.object({
  kind: z.enum([
    'file',
    'line_range',
    'report',
    'test_case',
    'snapshot',
    'url',
    'message'
  ]),
  ref: nonEmptyStringSchema,
  excerpt: z.string().optional()
});

export const governanceTargetRefSchema = z.object({
  kind: z.enum([
    'repository',
    'module',
    'package',
    'service',
    'file',
    'component',
    'api',
    'screen'
  ]),
  ref: nonEmptyStringSchema
});

export const repositoryProfileSchema = z.object({
  id: idSchema,
  scopeId: idSchema,
  branch: nonEmptyStringSchema,
  snapshotAt: isoDateTimeSchema,
  modules: z.array(
    z.object({
      name: nonEmptyStringSchema,
      path: nonEmptyStringSchema,
      language: nonEmptyStringSchema,
      dependencies: z.array(nonEmptyStringSchema)
    })
  ),
  testBaseline: z.object({
    coveragePercent: z.number().min(0).max(100).optional(),
    totalTests: z.number().int().min(0),
    failingTests: z.number().int().min(0),
    lastRunAt: isoDateTimeSchema.optional()
  }),
  buildStatus: z.nativeEnum(RepositoryBuildStatus),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});

export const findingSchema = z.object({
  id: idSchema,
  scopeId: idSchema,
  source: z.nativeEnum(GovernanceFindingSource),
  sourceRef: z.string().optional(),
  title: nonEmptyStringSchema,
  summary: nonEmptyStringSchema,
  evidence: z.array(governanceEvidenceRefSchema),
  categories: z.array(nonEmptyStringSchema),
  tags: z.array(nonEmptyStringSchema),
  severityHint: z.nativeEnum(GovernanceSeverity).optional(),
  confidence: z.number().min(0).max(1).optional(),
  affectedTargets: z.array(governanceTargetRefSchema),
  metadata: z.record(z.string(), z.unknown()).optional(),
  fingerprint: z.string().optional(),
  discoveredAt: isoDateTimeSchema.optional(),
  status: z.nativeEnum(GovernanceFindingStatus),
  latestTriageAttempt: z.lazy(() => governanceExecutionAttemptSummarySchema).nullable().optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});

export const findingMergeRecordSchema = z.object({
  id: idSchema,
  targetIssueId: idSchema,
  mergedFindingIds: z.array(idSchema),
  trigger: z.nativeEnum(GovernanceMergeTrigger),
  clusterBasis: z.array(z.nativeEnum(GovernanceClusterBasis)).optional(),
  mergedBy: z.string().optional(),
  mergedAt: isoDateTimeSchema
});

export const issueSchema = z.object({
  id: idSchema,
  scopeId: idSchema,
  title: nonEmptyStringSchema,
  statement: nonEmptyStringSchema,
  kind: z.nativeEnum(GovernanceIssueKind),
  categories: z.array(nonEmptyStringSchema),
  tags: z.array(nonEmptyStringSchema),
  relatedFindingIds: z.array(idSchema),
  status: z.nativeEnum(GovernanceIssueStatus),
  affectedTargets: z.array(governanceTargetRefSchema),
  rootCause: z.string().optional(),
  impactSummary: nonEmptyStringSchema,
  isRegression: z.boolean().optional(),
  regressionOfIssueId: z.string().optional(),
  spinOffOfIssueId: z.string().optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});

export const governancePriorityPolicySchema = z.object({
  defaultPriority: z.nativeEnum(GovernancePriority),
  severityOverrides: z
    .object({
      critical: z.nativeEnum(GovernancePriority).optional(),
      high: z.nativeEnum(GovernancePriority).optional(),
      medium: z.nativeEnum(GovernancePriority).optional(),
      low: z.nativeEnum(GovernancePriority).optional()
    })
    .optional()
});

export const governanceAutoActionPolicySchema = z.object({
  defaultEligibility: z.nativeEnum(GovernanceAutoActionEligibility),
  severityOverrides: z
    .object({
      critical: z.nativeEnum(GovernanceAutoActionEligibility).optional(),
      high: z.nativeEnum(GovernanceAutoActionEligibility).optional(),
      medium: z.nativeEnum(GovernanceAutoActionEligibility).optional(),
      low: z.nativeEnum(GovernanceAutoActionEligibility).optional()
    })
    .optional(),
  issueKindOverrides: z
    .object({
      bug: z.nativeEnum(GovernanceAutoActionEligibility).optional(),
      risk: z.nativeEnum(GovernanceAutoActionEligibility).optional(),
      debt: z.nativeEnum(GovernanceAutoActionEligibility).optional(),
      improvement: z.nativeEnum(GovernanceAutoActionEligibility).optional(),
      gap: z.nativeEnum(GovernanceAutoActionEligibility).optional(),
      violation: z.nativeEnum(GovernanceAutoActionEligibility).optional()
    })
    .optional()
});

export const governanceDeliveryPolicySchema = z.object({
  commitMode: z.nativeEnum(GovernanceDeliveryCommitMode),
  autoCloseIssueOnApprovedDelivery: z.boolean()
});

export const governancePolicySchema = z.object({
  id: idSchema,
  scopeId: idSchema,
  priorityPolicy: governancePriorityPolicySchema,
  autoActionPolicy: governanceAutoActionPolicySchema,
  deliveryPolicy: governanceDeliveryPolicySchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});

export const issueAssessmentSchema = z.object({
  id: idSchema,
  issueId: idSchema,
  severity: z.nativeEnum(GovernanceSeverity),
  priority: z.nativeEnum(GovernancePriority),
  userImpact: z.number().int().min(0).max(10),
  systemRisk: z.number().int().min(0).max(10),
  strategicValue: z.number().int().min(0).max(10),
  fixCost: z.number().int().min(0).max(10),
  autoActionEligibility: z.nativeEnum(GovernanceAutoActionEligibility),
  rationale: z.array(nonEmptyStringSchema),
  assessedBy: z.nativeEnum(GovernanceAssessmentSource),
  assessedAt: isoDateTimeSchema,
  createdAt: isoDateTimeSchema
});

export const resolutionDecisionSchema = z.object({
  id: idSchema,
  issueId: idSchema,
  resolution: z.nativeEnum(GovernanceResolutionType),
  reason: nonEmptyStringSchema,
  deferUntil: isoDateTimeSchema.optional(),
  primaryIssueId: idSchema.optional(),
  approvedBy: z.string().optional(),
  decidedAt: isoDateTimeSchema,
  createdAt: isoDateTimeSchema
});

export const changeActionSchema = z.object({
  id: idSchema,
  type: z.nativeEnum(GovernanceChangeActionType),
  description: nonEmptyStringSchema,
  targets: z.array(governanceTargetRefSchema)
});

export const changePlanSchema = z.object({
  id: idSchema,
  issueId: idSchema,
  objective: nonEmptyStringSchema,
  strategy: nonEmptyStringSchema,
  affectedTargets: z.array(governanceTargetRefSchema),
  proposedActions: z.array(changeActionSchema),
  risks: z.array(nonEmptyStringSchema),
  rollbackPlan: z.string().optional(),
  assumptions: z.array(nonEmptyStringSchema).optional(),
  baselineCommitSha: nonEmptyStringSchema,
  status: z.nativeEnum(GovernanceChangePlanStatus),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});

export const changeUnitSchema = z.object({
  id: idSchema,
  changePlanId: idSchema,
  issueId: idSchema,
  sourceActionId: idSchema,
  dependsOnUnitIds: z.array(idSchema),
  title: nonEmptyStringSchema,
  description: nonEmptyStringSchema,
  scope: z.object({
    targets: z.array(governanceTargetRefSchema),
    maxFiles: z.number().int().min(1).optional(),
    maxDiffLines: z.number().int().min(1).optional(),
    violationPolicy: z.nativeEnum(GovernanceViolationPolicy)
  }),
  executionMode: z.nativeEnum(GovernanceExecutionMode),
  maxRetries: z.number().int().min(0),
  currentAttemptNo: z.number().int().min(0),
  status: z.nativeEnum(GovernanceChangeUnitStatus),
  producedCommitIds: z.array(nonEmptyStringSchema),
  latestExecutionAttempt: z
    .lazy(() => governanceExecutionAttemptSummarySchema)
    .nullable()
    .optional(),
  latestVerificationResult: z.lazy(() => verificationResultSchema)
    .nullable()
    .optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});

export const governanceVerificationCheckSchema = z.object({
  id: idSchema,
  type: z.nativeEnum(GovernanceVerificationCheckType),
  target: z.string().optional(),
  command: z.string().optional(),
  required: z.boolean()
});

export const verificationPlanSchema = z.object({
  id: idSchema,
  subjectType: z.nativeEnum(GovernanceVerificationSubjectType),
  changeUnitId: idSchema.optional(),
  changePlanId: idSchema.optional(),
  issueId: idSchema.optional(),
  checks: z.array(governanceVerificationCheckSchema),
  passCriteria: z.array(nonEmptyStringSchema),
  createdAt: isoDateTimeSchema
});

export const governanceExecutionAttemptSummarySchema = z.object({
  id: idSchema,
  stageType: z.nativeEnum(GovernanceAutomationStage),
  subjectType: z.nativeEnum(GovernanceAutomationSubjectType),
  subjectId: idSchema,
  attemptNo: z.number().int().min(1),
  status: z.nativeEnum(GovernanceExecutionAttemptStatus),
  sessionId: idSchema.nullable().optional(),
  activeRequestMessageId: idSchema.nullable().optional(),
  failureCode: z.string().nullable().optional(),
  failureMessage: z.string().nullable().optional(),
  updatedAt: isoDateTimeSchema
});

export const governanceTriageOutputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create_issue'),
    issue: z.object({
      title: nonEmptyStringSchema,
      statement: nonEmptyStringSchema,
      kind: z.nativeEnum(GovernanceIssueKind),
      categories: z.array(nonEmptyStringSchema).min(1),
      tags: z.array(nonEmptyStringSchema).optional(),
      affectedTargets: z.array(governanceTargetRefSchema).min(1),
      rootCause: z.string().optional(),
      impactSummary: nonEmptyStringSchema,
      isRegression: z.boolean().optional(),
      regressionOfIssueId: idSchema.optional()
    }),
    assessment: z.object({
      severity: z.nativeEnum(GovernanceSeverity),
      priority: z.nativeEnum(GovernancePriority),
      userImpact: z.number().int().min(0).max(10),
      systemRisk: z.number().int().min(0).max(10),
      strategicValue: z.number().int().min(0).max(10),
      fixCost: z.number().int().min(0).max(10),
      autoActionEligibility: z.nativeEnum(GovernanceAutoActionEligibility),
      rationale: z.array(nonEmptyStringSchema).min(1)
    })
  }),
  z.object({
    action: z.literal('merge_into_issue'),
    targetIssueId: idSchema,
    clusterBasis: z.array(z.nativeEnum(GovernanceClusterBasis)).min(1),
    rationale: nonEmptyStringSchema,
    assessmentRefresh: z
      .object({
        severity: z.nativeEnum(GovernanceSeverity),
        priority: z.nativeEnum(GovernancePriority),
        userImpact: z.number().int().min(0).max(10),
        systemRisk: z.number().int().min(0).max(10),
        strategicValue: z.number().int().min(0).max(10),
        fixCost: z.number().int().min(0).max(10),
        autoActionEligibility: z.nativeEnum(
          GovernanceAutoActionEligibility
        ),
        rationale: z.array(nonEmptyStringSchema).min(1)
      })
      .optional()
  })
]);

export const governancePlanningOutputSchema = z.object({
  objective: nonEmptyStringSchema,
  strategy: nonEmptyStringSchema,
  affectedTargets: z.array(governanceTargetRefSchema).min(1),
  proposedActions: z.array(changeActionSchema).min(1),
  risks: z.array(nonEmptyStringSchema),
  rollbackPlan: z.string().optional(),
  assumptions: z.array(nonEmptyStringSchema).optional(),
  changeUnits: z.array(
    z.object({
      sourceActionId: idSchema,
      dependsOnUnitIds: z.array(idSchema).optional(),
      title: nonEmptyStringSchema,
      description: nonEmptyStringSchema,
      scope: changeUnitSchema.shape.scope,
      executionMode: z.nativeEnum(GovernanceExecutionMode).optional(),
      maxRetries: z.number().int().min(0).optional()
    })
  ).min(1),
  verificationPlans: z.array(
    z.object({
      subjectType: z.nativeEnum(GovernanceVerificationSubjectType),
      checks: z.array(governanceVerificationCheckSchema).min(1),
      passCriteria: z.array(nonEmptyStringSchema).min(1),
      changeUnitIndex: z.number().int().min(0).optional()
    })
  ).min(1)
});

export const governanceDiscoveredFindingDraftSchema = z.object({
  source: z.nativeEnum(GovernanceFindingSource),
  sourceRef: z.string().optional(),
  title: nonEmptyStringSchema,
  summary: nonEmptyStringSchema,
  evidence: z.array(governanceEvidenceRefSchema).min(1),
  categories: z.array(nonEmptyStringSchema).min(1),
  tags: z.array(nonEmptyStringSchema).optional(),
  severityHint: z.nativeEnum(GovernanceSeverity).optional(),
  confidence: z.number().min(0).max(1).optional(),
  affectedTargets: z.array(governanceTargetRefSchema).min(1),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const governanceDiscoveryOutputSchema = z.object({
  findings: z.array(governanceDiscoveredFindingDraftSchema)
});

export const verificationResultSchema = z.object({
  id: idSchema,
  verificationPlanId: idSchema,
  subjectType: z.nativeEnum(GovernanceVerificationSubjectType),
  changeUnitId: idSchema.optional(),
  changePlanId: idSchema.optional(),
  executionAttemptNo: z.number().int().min(1),
  status: z.nativeEnum(GovernanceVerificationResultStatus),
  checkResults: z.array(
    z.object({
      checkId: idSchema,
      status: z.enum(['passed', 'failed', 'skipped']),
      summary: nonEmptyStringSchema,
      artifactRefs: z.array(nonEmptyStringSchema).optional()
    })
  ),
  summary: nonEmptyStringSchema,
  executedAt: isoDateTimeSchema
});

export const reviewDecisionSchema = z.object({
  id: idSchema,
  subjectType: z.nativeEnum(GovernanceReviewSubjectType),
  subjectId: idSchema,
  decision: z.nativeEnum(GovernanceReviewDecisionType),
  assessmentOverride: z
    .object({
      severity: z.nativeEnum(GovernanceSeverity).optional(),
      priority: z.nativeEnum(GovernancePriority).optional(),
      autoActionEligibility: z
        .nativeEnum(GovernanceAutoActionEligibility)
        .optional()
    })
    .optional(),
  comment: z.string().optional(),
  reviewer: nonEmptyStringSchema,
  createdAt: isoDateTimeSchema
});

export const deliveryArtifactSchema = z.object({
  id: idSchema,
  kind: z.nativeEnum(GovernanceDeliveryArtifactKind),
  title: nonEmptyStringSchema,
  body: z.string(),
  linkedIssueIds: z.array(idSchema),
  linkedChangeUnitIds: z.array(idSchema),
  linkedVerificationResultIds: z.array(idSchema),
  bodyStrategy: z.nativeEnum(GovernanceDeliveryBodyStrategy),
  externalRef: z.string().optional(),
  status: z.nativeEnum(GovernanceDeliveryArtifactStatus),
  createdAt: isoDateTimeSchema
});

export const governanceIssueSummarySchema = issueSchema.extend({
  relatedFindingCount: z.number().int().min(0),
  latestAssessment: issueAssessmentSchema.nullable(),
  latestResolutionDecision: resolutionDecisionSchema.nullable(),
  latestChangePlanStatus: z.nativeEnum(GovernanceChangePlanStatus).nullable(),
  latestPlanningAttempt: governanceExecutionAttemptSummarySchema.nullable()
});

export const governanceIssueDetailSchema = issueSchema.extend({
  latestAssessment: issueAssessmentSchema.nullable(),
  latestResolutionDecision: resolutionDecisionSchema.nullable(),
  relatedFindings: z.array(findingSchema),
  changePlan: changePlanSchema.nullable(),
  changeUnits: z.array(changeUnitSchema),
  verificationPlans: z.array(verificationPlanSchema),
  verificationResults: z.array(verificationResultSchema),
  planLevelVerificationResult: verificationResultSchema.nullable(),
  deliveryArtifact: deliveryArtifactSchema.nullable(),
  latestPlanningAttempt: governanceExecutionAttemptSummarySchema.nullable()
});

export const governanceScopeOverviewSchema = z.object({
  scopeId: idSchema,
  repositoryProfile: repositoryProfileSchema.nullable(),
  latestBaselineAttempt: governanceExecutionAttemptSummarySchema.nullable(),
  latestDiscoveryAttempt: governanceExecutionAttemptSummarySchema.nullable(),
  findingCounts: z.record(
    z.nativeEnum(GovernanceFindingStatus),
    z.number().int().min(0)
  )
});

export const createFindingInputSchema = z.object({
  scopeId: idSchema,
  source: z.nativeEnum(GovernanceFindingSource),
  sourceRef: z.string().optional(),
  title: nonEmptyStringSchema,
  summary: nonEmptyStringSchema,
  evidence: z.array(governanceEvidenceRefSchema).min(1),
  categories: z.array(nonEmptyStringSchema).min(1),
  tags: z.array(nonEmptyStringSchema).optional().default([]),
  severityHint: z.nativeEnum(GovernanceSeverity).optional(),
  confidence: z.number().min(0).max(1).optional(),
  affectedTargets: z.array(governanceTargetRefSchema).min(1),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const createResolutionDecisionInputSchema = z
  .object({
    resolution: z.nativeEnum(GovernanceResolutionType),
    reason: nonEmptyStringSchema,
    deferUntil: isoDateTimeSchema.optional(),
    primaryIssueId: idSchema.optional(),
    approvedBy: z.string().trim().min(1).optional()
  })
  .superRefine((value, ctx) => {
    if (
      value.resolution === GovernanceResolutionType.Duplicate &&
      !value.primaryIssueId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['primaryIssueId'],
        message: 'primaryIssueId is required for duplicate resolution'
      });
    }
  });

export const governanceAssessmentOverrideSchema = z
  .object({
    severity: z.nativeEnum(GovernanceSeverity).optional(),
    priority: z.nativeEnum(GovernancePriority).optional(),
    autoActionEligibility: z
      .nativeEnum(GovernanceAutoActionEligibility)
      .optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one assessment override field must be provided'
  });

export const createReviewDecisionInputSchema = z.discriminatedUnion(
  'subjectType',
  [
    z.object({
      subjectType: z.literal(GovernanceReviewSubjectType.Finding),
      subjectId: idSchema,
      decision: z.literal(GovernanceReviewDecisionType.Dismissed),
      reviewer: nonEmptyStringSchema,
      comment: z.string().trim().optional()
    }),
    z.object({
      subjectType: z.literal(GovernanceReviewSubjectType.Assessment),
      subjectId: idSchema,
      decision: z.literal(GovernanceReviewDecisionType.Approved),
      reviewer: nonEmptyStringSchema,
      comment: z.string().trim().optional(),
      assessmentOverride: governanceAssessmentOverrideSchema
    }),
    z.object({
      subjectType: z.literal(GovernanceReviewSubjectType.ChangePlan),
      subjectId: idSchema,
      decision: z.union([
        z.literal(GovernanceReviewDecisionType.Approved),
        z.literal(GovernanceReviewDecisionType.Rejected)
      ]),
      reviewer: nonEmptyStringSchema,
      comment: z.string().trim().optional()
    }),
    z.object({
      subjectType: z.literal(GovernanceReviewSubjectType.ChangeUnit),
      subjectId: idSchema,
      decision: z.union([
        z.literal(GovernanceReviewDecisionType.Approved),
        z.literal(GovernanceReviewDecisionType.Rejected),
        z.literal(GovernanceReviewDecisionType.Retry),
        z.literal(GovernanceReviewDecisionType.EditAndContinue),
        z.literal(GovernanceReviewDecisionType.Skip),
        z.literal(GovernanceReviewDecisionType.Terminate)
      ]),
      reviewer: nonEmptyStringSchema,
      comment: z.string().trim().optional()
    }),
    z.object({
      subjectType: z.literal(GovernanceReviewSubjectType.DeliveryArtifact),
      subjectId: idSchema,
      decision: z.union([
        z.literal(GovernanceReviewDecisionType.Approved),
        z.literal(GovernanceReviewDecisionType.Rejected)
      ]),
      reviewer: nonEmptyStringSchema,
      comment: z.string().trim().optional()
    })
  ]
);

export const updateGovernancePolicyInputSchema = z.object({
  priorityPolicy: governancePriorityPolicySchema,
  autoActionPolicy: governanceAutoActionPolicySchema,
  deliveryPolicy: governanceDeliveryPolicySchema
});
