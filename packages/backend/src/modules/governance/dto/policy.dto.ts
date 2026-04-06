import { IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateGovernancePolicyDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  priorityPolicy!: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  autoActionPolicy!: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  deliveryPolicy!: Record<string, unknown>;
}
