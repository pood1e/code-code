import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  GovernanceReviewDecisionType,
  GovernanceReviewSubjectType
} from '@agent-workbench/shared';

export class CreateReviewDecisionDto {
  @ApiProperty({ enum: GovernanceReviewSubjectType })
  @IsEnum(GovernanceReviewSubjectType)
  subjectType!: GovernanceReviewSubjectType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  subjectId!: string;

  @ApiProperty({ enum: GovernanceReviewDecisionType })
  @IsEnum(GovernanceReviewDecisionType)
  decision!: GovernanceReviewDecisionType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reviewer!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  comment?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsObject()
  @IsOptional()
  assessmentOverride?: Record<string, unknown>;
}
