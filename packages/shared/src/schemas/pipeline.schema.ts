import { z } from 'zod';
import {
  ArtifactContentType,
  HumanDecisionAction,
  PipelineStageType
} from '../types/pipeline';

export const humanDecisionSchema = z.object({
  action: z.nativeEnum(HumanDecisionAction),
  feedback: z.string().optional()
});

export const createPipelineInputSchema = z.object({
  scopeId: z.string().min(1, 'scopeId must not be empty'),
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
    (v) => Object.keys(v).length > 0,
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

export const submitHumanDecisionInputSchema = z.object({
  decision: humanDecisionSchema
});

export const pipelineStageTypeValues = Object.values(PipelineStageType) as [
  PipelineStageType,
  ...PipelineStageType[]
];
