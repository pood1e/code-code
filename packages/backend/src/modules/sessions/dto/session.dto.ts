import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
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
      model: 'claude-sonnet-4-5',
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

export class CreateSessionDto {
  @ApiProperty({ example: 'project_agent_workbench' })
  @IsString()
  @IsNotEmpty()
  scopeId!: string;

  @ApiProperty({ example: 'runner_dev' })
  @IsString()
  @IsNotEmpty()
  runnerId!: string;

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
