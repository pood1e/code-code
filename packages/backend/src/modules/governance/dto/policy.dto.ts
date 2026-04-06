import { IsObject, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true
  })
  @IsOptional()
  @IsObject()
  sourceSelection?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true
  })
  @IsOptional()
  @IsObject()
  agentStrategy?: Record<string, unknown>;
}
