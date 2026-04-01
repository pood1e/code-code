import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface
} from 'class-validator';
import { Type } from 'class-transformer';

@ValidatorConstraint({ name: 'isStringRecord', async: false })
class IsStringRecordConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    if (value === undefined) {
      return true;
    }

    if (!value || Array.isArray(value) || typeof value !== 'object') {
      return false;
    }

    return Object.values(value).every((item) => typeof item === 'string');
  }

  defaultMessage() {
    return 'Value must be a string map';
  }
}

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
  @IsString({ each: true })
  @Matches(/\S/, {
    each: true,
    message: 'Each argument must contain at least one non-whitespace character'
  })
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
  @Validate(IsStringRecordConstraint)
  env?: Record<string, string>;
}

export class McpConfigOverrideDto {
  @ApiPropertyOptional({
    enum: ['stdio'],
    description: 'Transport override. This phase only supports stdio.'
  })
  @IsOptional()
  @IsString()
  @IsIn(['stdio'])
  type?: 'stdio';

  @ApiPropertyOptional({
    example: 'npx',
    description: 'Override command used to launch the MCP server process.'
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  command?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['-y', '@modelcontextprotocol/server-filesystem', './docs'],
    description: 'Override arguments passed to the command.'
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Matches(/\S/, {
    each: true,
    message: 'Each argument must contain at least one non-whitespace character'
  })
  args?: string[];

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: {
      type: 'string'
    },
    example: {
      LOG_LEVEL: 'debug'
    },
    description: 'Override environment variables passed to the process.'
  })
  @IsOptional()
  @IsObject()
  @Validate(IsStringRecordConstraint)
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
  @ValidateNested()
  @Type(() => McpContentDto)
  content!: McpContentDto;
}

export class ResourceSearchQueryDto {
  @ApiPropertyOptional({ example: 'search' })
  @IsOptional()
  @IsString()
  name?: string;
}
