import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested
} from 'class-validator';

import { FieldMatchOperator } from '@agent-workbench/shared';

// Explicit string array avoids `Object.values()` being called before the enum module resolves
const FIELD_MATCH_OPERATORS: string[] = [
  'In', 'NotIn', 'Exists', 'DoesNotExist', 'Prefix', 'Suffix'
];

export class FieldMatcherDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  field!: string;

  @IsIn(FIELD_MATCH_OPERATORS)
  operator!: FieldMatchOperator;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  values?: string[];
}

export class ChannelFilterDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  eventTypes!: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldMatcherDto)
  @IsOptional()
  conditions?: FieldMatcherDto[];
}

export class CreateNotificationChannelDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value
  )
  scopeId!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(200)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value
  )
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value
  )
  channelType!: string;

  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;

  @ValidateNested()
  @Type(() => ChannelFilterDto)
  filter!: ChannelFilterDto;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}

export class UpdateNotificationChannelDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value
  )
  name?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value
  )
  channelType?: string;

  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;

  @ValidateNested()
  @Type(() => ChannelFilterDto)
  @IsOptional()
  filter?: ChannelFilterDto;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}
