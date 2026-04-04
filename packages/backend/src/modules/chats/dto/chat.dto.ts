import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateChatDto {
  @ApiProperty({ description: 'Project ID (scopeId)' })
  @IsString()
  @IsNotEmpty()
  scopeId!: string;

  @ApiProperty({ description: 'Runner ID to use' })
  @IsString()
  @IsNotEmpty()
  runnerId!: string;

  @ApiPropertyOptional({ description: 'Chat title' })
  @IsString()
  @IsOptional()
  title?: string | null;

  @ApiPropertyOptional({ description: 'Skill IDs to include', type: [String] })
  @IsOptional()
  skillIds?: string[];

  @ApiPropertyOptional({ description: 'Rule IDs to include', type: [String] })
  @IsOptional()
  ruleIds?: string[];

  @ApiPropertyOptional({
    description: 'MCP configs',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        resourceId: { type: 'string' },
        configOverride: { type: 'object' }
      },
      required: ['resourceId']
    }
  })
  @IsOptional()
  mcps?: Array<{
    resourceId: string;
    configOverride?: Record<string, unknown>;
  }>;

  @ApiPropertyOptional({ description: 'Runner session configuration' })
  @IsOptional()
  runnerSessionConfig?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Initial message to send after creation' })
  @IsOptional()
  initialMessage?: {
    input: Record<string, unknown>;
    runtimeConfig?: Record<string, unknown>;
  };
}

export class UpdateChatDto {
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
