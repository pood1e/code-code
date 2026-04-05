import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { HumanReviewAction } from '@agent-workbench/shared';

export class PipelineHumanReviewDecisionDto {
  @ApiProperty({ enum: HumanReviewAction })
  @IsEnum(HumanReviewAction)
  action!: HumanReviewAction;

  @ApiPropertyOptional({
    description: 'Reviewer comment for retry, edit_and_continue, skip or terminate'
  })
  @ValidateIf(
    ({ action }: PipelineHumanReviewDecisionDto) =>
      action === HumanReviewAction.Skip ||
      action === HumanReviewAction.Terminate ||
      action === HumanReviewAction.Retry ||
      action === HumanReviewAction.EditAndContinue
  )
  @IsString()
  @IsOptional()
  comment?: string;

  @ApiPropertyOptional({
    description: 'Edited structured output when action=edit_and_continue',
    type: 'object',
    additionalProperties: true
  })
  @ValidateIf(
    ({ action }: PipelineHumanReviewDecisionDto) =>
      action === HumanReviewAction.EditAndContinue
  )
  @IsObject()
  @IsNotEmpty()
  editedOutput?: Record<string, unknown>;
}

export class SubmitHumanDecisionDto {
  @ApiProperty({ type: () => PipelineHumanReviewDecisionDto })
  @ValidateNested()
  @Type(() => PipelineHumanReviewDecisionDto)
  @IsNotEmpty()
  decision!: PipelineHumanReviewDecisionDto;
}
