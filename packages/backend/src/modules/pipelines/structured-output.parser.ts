import { Injectable } from '@nestjs/common';
import { ZodError, type ZodType } from 'zod';

import {
  artifactRefSchema,
  planReportSchema,
  prdSchema,
  taskAcSpecSchema,
  type PipelineStageType
} from '@agent-workbench/shared';

@Injectable()
export class StructuredOutputParser {
  parse(stageType: PipelineStageType, outputText: string): unknown {
    const jsonPayload = extractPipelineOutputJson(outputText);
    const parsedJson = JSON.parse(jsonPayload) as unknown;
    return this.validateValue(stageType, parsedJson);
  }

  validateValue(stageType: PipelineStageType, value: unknown): unknown {
    switch (stageType) {
      case 'breakdown':
        return parseWithSchema(
          prdSchema.or(artifactRefSchema),
          value,
          stageType
        );
      case 'spec':
        return parseWithSchema(
          taskAcSpecSchema.array().or(artifactRefSchema),
          value,
          stageType
        );
      case 'estimate':
        return parseWithSchema(planReportSchema, value, stageType);
      default:
        return value;
    }
  }
}

function extractPipelineOutputJson(outputText: string): string {
  const blockPattern = /```([^\n`]*)\n([\s\S]*?)```/g;
  const matches = Array.from(outputText.matchAll(blockPattern));

  const taggedMatch = matches.find((match) =>
    match[1]?.toLowerCase().includes('pipeline-output')
  );
  if (taggedMatch?.[2]) {
    return taggedMatch[2].trim();
  }

  const jsonMatch = [...matches]
    .reverse()
    .find((match) => match[1]?.toLowerCase().includes('json'));
  if (jsonMatch?.[2]) {
    return jsonMatch[2].trim();
  }

  throw new Error('Missing ```json pipeline-output``` block');
}

function parseWithSchema<T>(
  schema: ZodType<T>,
  value: unknown,
  stageType: PipelineStageType
): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(
        `${stageType} output schema validation failed: ${
          error.issues[0]?.message ?? 'invalid output'
        }`
      );
    }

    throw error;
  }
}
