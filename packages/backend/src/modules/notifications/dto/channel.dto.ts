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
  Validate,
  ValidateNested,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
  type ValidationArguments
} from 'class-validator';

import { FieldMatchOperator } from '@agent-workbench/shared';

// Explicit string array avoids `Object.values()` being called before the enum module resolves
const FIELD_MATCH_OPERATORS: string[] = [
  'In', 'NotIn', 'Exists', 'DoesNotExist', 'Prefix', 'Suffix'
];

@ValidatorConstraint({ name: 'fieldMatcherValues', async: false })
class FieldMatcherValuesConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments) {
    const matcher = args.object as FieldMatcherDto;
    const valueCount = matcher.values?.length ?? 0;

    switch (matcher.operator) {
      case FieldMatchOperator.In:
      case FieldMatchOperator.NotIn:
        return valueCount > 0;
      case FieldMatchOperator.Prefix:
      case FieldMatchOperator.Suffix:
        return valueCount === 1;
      case FieldMatchOperator.Exists:
      case FieldMatchOperator.DoesNotExist:
        return valueCount === 0;
      default:
        return false;
    }
  }

  defaultMessage() {
    return 'values must match the operator requirements';
  }
}

@ValidatorConstraint({ name: 'notificationChannelUpdateNotEmpty', async: false })
class NotificationChannelUpdateNotEmptyConstraint
  implements ValidatorConstraintInterface
{
  validate(_value: unknown, args: ValidationArguments) {
    const dto = args.object as UpdateNotificationChannelDto;
    return (
      dto.name !== undefined ||
      dto.capabilityId !== undefined ||
      dto.config !== undefined ||
      dto.filter !== undefined ||
      dto.enabled !== undefined
    );
  }

  defaultMessage() {
    return 'At least one field must be provided for update';
  }
}

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
  @Validate(FieldMatcherValuesConstraint)
  values?: string[];
}

export class ChannelFilterDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  messageTypes!: string[];

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
  capabilityId!: string;

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
  @Validate(NotificationChannelUpdateNotEmptyConstraint)
  private readonly _atLeastOneField = true;

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
  capabilityId?: string;

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
