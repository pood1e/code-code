import { Injectable } from '@nestjs/common';
import { ZodError, type ZodType } from 'zod';

import {
  governanceDiscoveryOutputSchema,
  governancePlanningOutputSchema,
  governanceTriageOutputSchema,
  type GovernanceAutomationStage,
  type GovernanceDiscoveryOutput,
  type GovernancePlanningOutput,
  type GovernanceTriageOutput
} from '@agent-workbench/shared';

@Injectable()
export class GovernanceOutputParserService {
  parse(stageType: GovernanceAutomationStage, outputText: string) {
    const payload = JSON.parse(extractGovernanceOutputJson(outputText)) as unknown;
    return this.validate(stageType, payload);
  }

  validate(stageType: GovernanceAutomationStage, value: unknown) {
    switch (stageType) {
      case 'discovery':
        return parseWithSchema(governanceDiscoveryOutputSchema, value, stageType);
      case 'triage':
        return parseWithSchema(governanceTriageOutputSchema, value, stageType);
      case 'planning':
        return parseWithSchema(governancePlanningOutputSchema, value, stageType);
      default:
        return value;
    }
  }
}

function extractGovernanceOutputJson(outputText: string) {
  const blockPattern = /```([^\n`]*)\n([\s\S]*?)```/g;
  const matches = Array.from(outputText.matchAll(blockPattern));

  const taggedMatch = matches.find((match) =>
    match[1]?.toLowerCase().includes('governance-output')
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

  throw new Error('Missing ```json governance-output``` block');
}

function parseWithSchema<
  T extends
    | GovernanceDiscoveryOutput
    | GovernanceTriageOutput
    | GovernancePlanningOutput
>(
  schema: ZodType<T>,
  value: unknown,
  stageType: GovernanceAutomationStage
) {
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
