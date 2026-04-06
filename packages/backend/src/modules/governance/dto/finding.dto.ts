import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  GovernanceFindingSource,
  GovernanceFindingStatus,
  GovernanceSeverity
} from '@agent-workbench/shared';

export class CreateFindingDto {
  @ApiProperty({ description: 'Project ID (scopeId)' })
  @IsString()
  @IsNotEmpty()
  scopeId!: string;

  @ApiProperty({ enum: GovernanceFindingSource })
  @IsEnum(GovernanceFindingSource)
  source!: GovernanceFindingSource;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sourceRef?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  summary!: string;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  @IsArray()
  evidence!: unknown[];

  @ApiProperty({ type: [String] })
  @IsArray()
  categories!: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ enum: GovernanceSeverity })
  @IsEnum(GovernanceSeverity)
  @IsOptional()
  severityHint?: GovernanceSeverity;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  confidence?: number;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  @IsArray()
  affectedTargets!: unknown[];

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class GovernanceFindingQueryDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  scopeId?: string;

  @ApiPropertyOptional({ enum: GovernanceFindingStatus })
  @IsEnum(GovernanceFindingStatus)
  @IsOptional()
  status?: GovernanceFindingStatus;
}
