import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsObject, IsString, MaxLength } from 'class-validator';

export class ReceiveEventDto {
  @ApiProperty({ example: 'project_abc123' })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value
  )
  scopeId!: string;

  @ApiProperty({ example: 'session.completed' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  eventType!: string;

  @ApiProperty({ example: { sessionId: 'xxx', severity: 'critical' } })
  @IsObject()
  payload!: Record<string, unknown>;
}
