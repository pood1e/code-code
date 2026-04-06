import { z } from 'zod';

import {
  ArtifactContentType,
  HumanReviewAction,
  HumanReviewReason,
  PipelineStageType,
  StageExecutionAttemptStatus
} from '../types/pipeline';

const idSchema = z.string().trim().min(1);
const jsonObjectSchema = z.record(z.string(), z.unknown());

export const humanReviewActionSchema = z.nativeEnum(HumanReviewAction);
export const humanReviewReasonSchema = z.nativeEnum(HumanReviewReason);
export const stageExecutionAttemptStatusSchema = z.nativeEnum(
  StageExecutionAttemptStatus
);

export const artifactRefSchema = z.object({
  filePath: z.string().trim().min(1),
  summary: z.string().trim().min(1)
});

export const acceptanceCriterionSchema = z.object({
  id: idSchema,
  given: z.string().trim().min(1),
  when: z.string().trim().min(1),
  then: z.string().trim().min(1)
});

export const taskAcSpecSchema = z.object({
  taskId: idSchema,
  ac: z.array(acceptanceCriterionSchema)
});

export const prdTaskSchema = z.object({
  id: idSchema,
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  interface: z.string().trim().min(1).optional(),
  dependencies: z.array(idSchema),
  type: z.enum(['api', 'ui', 'infra', 'other']),
  estimatedAC: z.number().int().min(1)
});

export const prdSchema = z.object({
  feature: z.string().trim().min(1),
  userStories: z.array(z.string().trim().min(1)),
  systemBoundary: z.object({
    in: z.array(z.string().trim().min(1)),
    out: z.array(z.string().trim().min(1)),
    outOfScope: z.array(z.string().trim().min(1))
  }),
  ambiguities: z.array(z.string().trim().min(1)),
  tasks: z.array(prdTaskSchema)
});

export const planReportSchema = z.object({
  totalEstimateDays: z.number().nonnegative(),
  confidence: z.number().min(0).max(1),
  taskEstimates: z.array(
    z.object({
      taskId: idSchema,
      title: z.string().trim().min(1),
      estimateDays: z.number().nonnegative(),
      complexity: z.enum(['low', 'medium', 'high']),
      risks: z.array(z.string().trim().min(1))
    })
  ),
  overallRisks: z.array(z.string().trim().min(1)),
  assumptions: z.array(z.string().trim().min(1)),
  notes: z.string().optional()
});

export const stageExecutionAttemptSummarySchema = z.object({
  id: idSchema,
  stageId: idSchema,
  attemptNo: z.number().int().min(1),
  status: stageExecutionAttemptStatusSchema,
  sessionId: idSchema.nullable(),
  activeRequestMessageId: idSchema.nullable(),
  reviewReason: humanReviewReasonSchema.nullable(),
  failureCode: z.string().nullable(),
  failureMessage: z.string().nullable(),
  startedAt: z.string().datetime().nullable(),
  finishedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const pipelineHumanReviewArtifactSummarySchema = z.object({
  artifactId: idSchema,
  artifactKey: z
    .enum(['prd', 'ac_spec', 'plan_report'])
    .nullable(),
  name: z.string().trim().min(1),
  contentType: z.enum([
    'application/json',
    'text/markdown',
    'text/typescript',
    'text/plain'
  ] as [ArtifactContentType, ...ArtifactContentType[]]),
  attempt: z.number().int().min(1).nullable(),
  version: z.number().int().min(1).nullable()
});

export const pipelineHumanReviewPayloadSchema = z.object({
  reason: humanReviewReasonSchema,
  sourceStageKey: z.enum(['breakdown', 'spec', 'estimate']).nullable(),
  sourceAttemptId: idSchema.nullable(),
  sourceSessionId: idSchema.nullable(),
  summary: z.string().trim().min(1),
  candidateOutput: z.unknown().nullable(),
  suggestedActions: z.array(humanReviewActionSchema),
  reviewerComment: z.string().nullable(),
  attempts: z.array(stageExecutionAttemptSummarySchema),
  artifacts: z.array(pipelineHumanReviewArtifactSummarySchema)
});

export const retryBudgetSchema = z.object({
  breakdown: z.object({
    remaining: z.number().int().min(0),
    agentFailureCount: z.number().int().min(0),
    evaluationRejectCount: z.number().int().min(0)
  }),
  spec: z.object({
    remaining: z.number().int().min(0)
  }),
  estimate: z.object({
    remaining: z.number().int().min(0)
  })
});

export const pipelineConfigSchema = z.object({
  maxRetry: z.number().int().min(1).max(10).default(3),
  requireHumanReviewOnSuccess: z.boolean().default(true)
});

export const pipelineRuntimeStateSchema = z.object({
  currentStageKey: z.enum([
    'breakdown',
    'evaluation',
    'spec',
    'estimate',
    'human_review',
    'complete'
  ]),
  config: pipelineConfigSchema,
  retryBudget: retryBudgetSchema,
  artifacts: z.object({
    prd: z.union([prdSchema, artifactRefSchema]).nullable(),
    acSpec: z.union([z.array(taskAcSpecSchema), artifactRefSchema]).nullable(),
    planReport: planReportSchema.nullable()
  }),
  feedback: z.object({
    breakdownRejectionHistory: z.array(z.string()),
    humanReview: z
      .object({
        reason: humanReviewReasonSchema,
        sourceStageKey: z.enum(['breakdown', 'spec', 'estimate']).nullable(),
        sourceAttemptId: idSchema.nullable(),
        summary: z.string().trim().min(1),
        candidateOutput: z.unknown().optional(),
        suggestedActions: z.array(humanReviewActionSchema),
        reviewerAction: humanReviewActionSchema.nullable().optional(),
        reviewerComment: z.string().nullable().optional()
      })
      .nullable()
  }),
  lastError: z
    .object({
      stageKey: z.string().nullable(),
      attemptId: z.string().nullable(),
      code: z.string().nullable(),
      message: z.string().nullable(),
      at: z.string().datetime().nullable()
    })
    .nullable()
});

export const pipelineAgentConfigSchema = z.object({
  workspaceResources: z.array(z.enum(['code', 'doc'])).default(['code', 'doc']),
  skillIds: z.array(idSchema).default([]),
  ruleIds: z.array(idSchema).default([]),
  mcps: z
    .array(
      z.object({
        resourceId: idSchema,
        configOverride: jsonObjectSchema.optional()
      })
    )
    .default([]),
  runnerSessionConfig: jsonObjectSchema.default({}),
  runtimeConfig: jsonObjectSchema.optional()
});

export const submitHumanDecisionInputSchema = z.object({
  decision: z.discriminatedUnion('action', [
    z.object({
      action: z.literal(HumanReviewAction.Retry),
      comment: z.string().trim().min(1).optional()
    }),
    z.object({
      action: z.literal(HumanReviewAction.EditAndContinue),
      comment: z.string().trim().min(1).optional(),
      editedOutput: z.unknown()
    }),
    z.object({
      action: z.literal(HumanReviewAction.Skip),
      comment: z.string().trim().min(1)
    }),
    z.object({
      action: z.literal(HumanReviewAction.Terminate),
      comment: z.string().trim().min(1)
    })
  ])
});

export const createPipelineInputSchema = z.object({
  scopeId: idSchema,
  name: z.string().min(1, 'name must not be empty'),
  description: z.string().nullable().optional(),
  featureRequest: z.string().nullable().optional()
});

export const updatePipelineInputSchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    featureRequest: z.string().nullable().optional()
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    'At least one pipeline field must be provided'
  );

export const createPipelineArtifactInputSchema = z.object({
  stageId: z.string().nullable().optional(),
  name: z.string().min(1),
  contentType: z.enum([
    'application/json',
    'text/markdown',
    'text/typescript',
    'text/plain'
  ] as [ArtifactContentType, ...ArtifactContentType[]]),
  content: z.string(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional()
});

export const pipelineStageTypeValues = Object.values(PipelineStageType) as [
  PipelineStageType,
  ...PipelineStageType[]
];

export const startPipelineInputSchema = z.object({
  runnerId: idSchema,
  config: pipelineConfigSchema.partial().optional()
});
