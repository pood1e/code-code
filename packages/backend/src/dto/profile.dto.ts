import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested
} from 'class-validator';

export class ProfileMutationDto {
  @ApiProperty({ example: 'Default Assistant' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'Balanced default profile' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;
}

export class ProfileItemDto {
  @ApiProperty({ example: 'skill_web_search' })
  @IsString()
  @IsNotEmpty()
  resourceId!: string;

  @ApiProperty({ example: 0 })
  @IsInt()
  @Min(0)
  order!: number;
}

export class McpProfileItemDto extends ProfileItemDto {
  @ApiPropertyOptional({
    example: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', './docs'],
      env: {
        LOG_LEVEL: 'debug'
      }
    }
  })
  @IsOptional()
  @IsObject()
  configOverride?: {
    type?: 'stdio';
    command?: string;
    args?: string[];
    env?: Record<string, string>;
  };
}

export class UpdateProfileItemsDto {
  @ApiProperty({ type: [ProfileItemDto] })
  @IsArray()
  @ArrayUnique((item: ProfileItemDto) => item.resourceId)
  @ValidateNested({ each: true })
  @Type(() => ProfileItemDto)
  skills!: ProfileItemDto[];

  @ApiProperty({ type: [ProfileItemDto] })
  @IsArray()
  @ArrayUnique((item: ProfileItemDto) => item.resourceId)
  @ValidateNested({ each: true })
  @Type(() => McpProfileItemDto)
  mcps!: McpProfileItemDto[];

  @ApiProperty({ type: [ProfileItemDto] })
  @IsArray()
  @ArrayUnique((item: ProfileItemDto) => item.resourceId)
  @ValidateNested({ each: true })
  @Type(() => ProfileItemDto)
  rules!: ProfileItemDto[];
}

export class ExportProfileQueryDto {
  @ApiPropertyOptional({ enum: ['json', 'yaml'], default: 'json' })
  @IsOptional()
  @IsString()
  @IsIn(['json', 'yaml'])
  format?: 'json' | 'yaml';
}
