import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SessionWorkspaceResourceConfig,
  SessionWorkspaceResourceKind
} from '@agent-workbench/shared';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';

export class SessionQueryDto {
  @ApiProperty({ example: 'project_agent_workbench' })
  @IsString()
  @IsNotEmpty()
  scopeId!: string;
}

export class SessionMcpItemDto {
  @ApiProperty({ example: 'mcp_docs' })
  @IsString()
  @IsNotEmpty()
  resourceId!: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true
  })
  @IsOptional()
  @IsObject()
  configOverride?: Record<string, unknown>;
}

export class SendSessionMessageDto {
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: {
      model: 'sonnet',
      permissionMode: 'auto'
    }
  })
  @IsOptional()
  @IsObject()
  runtimeConfig?: Record<string, unknown>;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: {
      prompt: 'Summarize the last run'
    }
  })
  @IsObject()
  input!: Record<string, unknown>;
}

export class EditSessionMessageDto extends SendSessionMessageDto {}

export class SessionWorkspaceResourceBranchDto {
  @ApiPropertyOptional({ example: 'main' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  branch?: string;
}

export class SessionWorkspaceResourceConfigDto
  implements SessionWorkspaceResourceConfig
{
  @ApiPropertyOptional({ type: SessionWorkspaceResourceBranchDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SessionWorkspaceResourceBranchDto)
  code?: SessionWorkspaceResourceBranchDto;

  @ApiPropertyOptional({ type: SessionWorkspaceResourceBranchDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SessionWorkspaceResourceBranchDto)
  doc?: SessionWorkspaceResourceBranchDto;
}

export class CreateSessionDto {
  @ApiProperty({ example: 'project_agent_workbench' })
  @IsString()
  @IsNotEmpty()
  scopeId!: string;

  @ApiProperty({ example: 'runner_dev' })
  @IsString()
  @IsNotEmpty()
  runnerId!: string;

  @ApiPropertyOptional({
    example: 'code/packages/backend',
    description: '可选。相对 Session 目录的运行目录，例如 code 或 code/packages/backend'
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  customRunDirectory?: string;

  @ApiPropertyOptional({
    type: [String],
    enum: SessionWorkspaceResourceKind,
    example: [SessionWorkspaceResourceKind.Code, SessionWorkspaceResourceKind.Doc]
  })
  @IsArray()
  @IsEnum(SessionWorkspaceResourceKind, { each: true })
  @IsOptional()
  workspaceResources?: SessionWorkspaceResourceKind[];

  @ApiPropertyOptional({
    type: SessionWorkspaceResourceConfigDto
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SessionWorkspaceResourceConfigDto)
  workspaceResourceConfig?: SessionWorkspaceResourceConfigDto;

  @ApiProperty({ type: [String], example: ['skill_web_search'] })
  @IsArray()
  @IsString({ each: true })
  skillIds!: string[];

  @ApiProperty({ type: [String], example: ['rule_no_guessing'] })
  @IsArray()
  @IsString({ each: true })
  ruleIds!: string[];

  @ApiProperty({ type: [SessionMcpItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SessionMcpItemDto)
  mcps!: SessionMcpItemDto[];

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: {
      maxTurns: 6,
      permissionMode: 'auto'
    }
  })
  @IsObject()
  runnerSessionConfig!: Record<string, unknown>;

  @ApiPropertyOptional({
    type: SendSessionMessageDto
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SendSessionMessageDto)
  initialMessage?: SendSessionMessageDto;
}

export class SessionEventsQueryDto {
  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  afterEventId?: number;
}

export class SessionMessagesQueryDto {
  @ApiPropertyOptional({ example: 'clq9z2y...' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ example: 50, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;
}
