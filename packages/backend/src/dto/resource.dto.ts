import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength
} from 'class-validator';

export class SkillMutationDto {
  @ApiProperty({ example: 'Web Search' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'Search the public web' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiProperty({
    example: '# Web Search\n\nUse web search for recent information.'
  })
  @IsString()
  @IsNotEmpty()
  content!: string;
}

export class RuleMutationDto {
  @ApiProperty({ example: 'Cite Sources' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({
    example: 'Attach sources for claims that need verification.'
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiProperty({
    example: '## Rule\n\nAlways cite sources for verifiable claims.'
  })
  @IsString()
  @IsNotEmpty()
  content!: string;
}

export class McpContentDto {
  @ApiProperty({
    enum: ['stdio'],
    description: 'Transport type. This phase only supports stdio.'
  })
  @IsString()
  @IsIn(['stdio'])
  type!: 'stdio';

  @ApiProperty({
    example: 'npx',
    description: 'Executable command used to launch the MCP server process.'
  })
  @IsString()
  @IsNotEmpty()
  command!: string;

  @ApiProperty({
    type: [String],
    example: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
    description: 'Ordered arguments passed to the command.'
  })
  @IsArray()
  args!: string[];

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: {
      type: 'string'
    },
    example: {
      LOG_LEVEL: 'info'
    },
    description: 'Optional environment variables passed to the process.'
  })
  @IsOptional()
  @IsObject()
  env?: Record<string, string>;
}

export class McpMutationDto {
  @ApiProperty({ example: 'Filesystem MCP' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({
    example: 'Read files through the filesystem MCP server.'
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiProperty({
    type: McpContentDto,
    description:
      'MCP server configuration following the stdio protocol structure: type, command, args, env.'
  })
  @IsObject()
  content!: McpContentDto;
}

export class ResourceSearchQueryDto {
  @ApiPropertyOptional({ example: 'search' })
  @IsOptional()
  @IsString()
  name?: string;
}
