import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { GovernanceResolutionType } from '@agent-workbench/shared';

export class CreateResolutionDecisionDto {
  @ApiProperty({ enum: GovernanceResolutionType })
  @IsEnum(GovernanceResolutionType)
  resolution!: GovernanceResolutionType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  deferUntil?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  primaryIssueId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  approvedBy?: string;
}
