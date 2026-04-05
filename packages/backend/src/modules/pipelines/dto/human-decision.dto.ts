import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { HumanDecisionAction } from '@agent-workbench/shared';

export class HumanDecisionDto {
  @ApiProperty({ enum: HumanDecisionAction })
  @IsEnum(HumanDecisionAction)
  action!: HumanDecisionAction;

  @ApiPropertyOptional({ description: 'Optional feedback or modification instructions' })
  @IsString()
  @IsOptional()
  feedback?: string;
}

export class SubmitHumanDecisionDto {
  @ApiProperty({ type: () => HumanDecisionDto })
  @ValidateNested()
  @Type(() => HumanDecisionDto)
  @IsNotEmpty()
  decision!: HumanDecisionDto;
}
