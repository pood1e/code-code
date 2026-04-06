import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

import {
  GovernanceChangeUnitStatus,
  GovernanceDeliveryArtifactStatus,
  GovernanceIssueStatus
} from '@agent-workbench/shared';

export class GovernanceIssueQueryDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  scopeId?: string;

  @ApiPropertyOptional({ enum: GovernanceIssueStatus })
  @IsEnum(GovernanceIssueStatus)
  @IsOptional()
  status?: GovernanceIssueStatus;
}

export class GovernanceChangeUnitQueryDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  scopeId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  issueId?: string;

  @ApiPropertyOptional({ enum: GovernanceChangeUnitStatus })
  @IsEnum(GovernanceChangeUnitStatus)
  @IsOptional()
  status?: GovernanceChangeUnitStatus;
}

export class GovernanceDeliveryArtifactQueryDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  scopeId?: string;

  @ApiPropertyOptional({ enum: GovernanceDeliveryArtifactStatus })
  @IsEnum(GovernanceDeliveryArtifactStatus)
  @IsOptional()
  status?: GovernanceDeliveryArtifactStatus;
}
