import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength
} from 'class-validator';

export class AgentRunnerQueryDto {
  @ApiPropertyOptional({ example: 'search' })
  @IsOptional()
  @IsString()
  name?: string;
}

export class CreateAgentRunnerDto {
  @ApiProperty({ example: 'Claude Code Dev' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({
    example: 'Claude Code runner for development tasks'
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiProperty({ example: 'claude-code', description: 'Runner type ID' })
  @IsString()
  @IsNotEmpty()
  type!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: { model: 'claude-sonnet-4-5' },
    description: 'L1 runner config following RunnerType.schema'
  })
  @IsObject()
  runnerConfig!: object;
}

export class UpdateAgentRunnerDto {
  @ApiPropertyOptional({ example: 'Claude Code Dev' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    example: 'Claude Code runner for development tasks'
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({
    description: 'L1 runner config following RunnerType.schema'
  })
  @IsOptional()
  @IsObject()
  runnerConfig?: object;
}
