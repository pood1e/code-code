import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface
} from 'class-validator';
import {
  SessionWorkspaceResourceConfig,
  SessionWorkspaceResourceKind
} from '@agent-workbench/shared';

import {
  SendSessionMessageDto,
  SessionMcpItemDto,
  SessionWorkspaceResourceConfigDto
} from '../../sessions/dto/session.dto';

@ValidatorConstraint({ name: 'chatUpdateNotEmpty', async: false })
class ChatUpdateNotEmptyConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments) {
    const dto = args.object as UpdateChatDto;
    return dto.title !== undefined;
  }

  defaultMessage() {
    return 'At least one chat field must be provided';
  }
}

export class CreateChatDto {
  @ApiProperty({ description: 'Project ID (scopeId)' })
  @IsString()
  @IsNotEmpty()
  scopeId!: string;

  @ApiProperty({ description: 'Runner ID to use' })
  @IsString()
  @IsNotEmpty()
  runnerId!: string;

  @ApiPropertyOptional({
    description: 'Optional relative working directory inside the session directory',
    example: 'code/packages/backend'
  })
  @IsString()
  @IsOptional()
  customRunDirectory?: string;

  @ApiPropertyOptional({
    description: 'Workspace resources to initialize',
    type: [String],
    enum: SessionWorkspaceResourceKind
  })
  @IsArray()
  @IsEnum(SessionWorkspaceResourceKind, { each: true })
  @IsOptional()
  workspaceResources?: SessionWorkspaceResourceKind[];

  @ApiPropertyOptional({
    description: 'Optional per-resource workspace configuration',
    type: SessionWorkspaceResourceConfigDto
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SessionWorkspaceResourceConfigDto)
  workspaceResourceConfig?: SessionWorkspaceResourceConfig;

  @ApiPropertyOptional({ description: 'Chat title' })
  @IsString()
  @IsOptional()
  title?: string | null;

  @ApiPropertyOptional({ description: 'Skill IDs to include', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  skillIds?: string[];

  @ApiPropertyOptional({ description: 'Rule IDs to include', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  ruleIds?: string[];

  @ApiPropertyOptional({ description: 'MCP configs', type: [SessionMcpItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SessionMcpItemDto)
  @IsOptional()
  mcps?: SessionMcpItemDto[];

  @ApiPropertyOptional({ description: 'Runner session configuration' })
  @IsObject()
  @IsOptional()
  runnerSessionConfig?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Initial message to send after creation',
    type: SendSessionMessageDto
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SendSessionMessageDto)
  initialMessage?: SendSessionMessageDto;
}

export class UpdateChatDto {
  @Validate(ChatUpdateNotEmptyConstraint)
  private readonly _atLeastOneField = true;

  @ApiPropertyOptional({ description: 'Chat title' })
  @IsString()
  @IsOptional()
  title?: string | null;
}

export class ChatQueryDto {
  @ApiPropertyOptional({ description: 'Filter by project ID (scopeId)' })
  @IsString()
  @IsOptional()
  scopeId?: string;
}
