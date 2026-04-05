import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { PipelineStatus } from '@agent-workbench/shared';

export class CreatePipelineDto {
  @ApiProperty({ description: 'Project ID (scopeId)' })
  @IsString()
  @IsNotEmpty()
  scopeId!: string;

  @ApiProperty({ description: 'Pipeline name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ description: 'Pipeline description' })
  @IsString()
  @IsOptional()
  description?: string | null;

  @ApiPropertyOptional({ description: 'Feature request / input prompt' })
  @IsString()
  @IsOptional()
  featureRequest?: string | null;
}

export class UpdatePipelineDto {
  @ApiPropertyOptional({ description: 'Pipeline name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Pipeline description' })
  @IsString()
  @IsOptional()
  description?: string | null;

  @ApiPropertyOptional({ description: 'Feature request / input prompt' })
  @IsString()
  @IsOptional()
  featureRequest?: string | null;
}

export class PipelineQueryDto {
  @ApiPropertyOptional({ description: 'Filter by project ID (scopeId)' })
  @IsString()
  @IsOptional()
  scopeId?: string;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: PipelineStatus
  })
  @IsEnum(PipelineStatus)
  @IsOptional()
  status?: PipelineStatus;
}
