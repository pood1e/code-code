import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength
} from 'class-validator';

import type { NotificationSeverity } from '@agent-workbench/shared';

const NOTIFICATION_SEVERITIES: string[] = [
  'info',
  'success',
  'warning',
  'error'
];

export class ReceiveNotificationMessageDto {
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
  type!: string;

  @ApiProperty({ example: '会话执行完成' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiProperty({ example: 'Project Agent Workbench 的会话执行完成。' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  body!: string;

  @ApiProperty({ enum: NOTIFICATION_SEVERITIES, required: false })
  @IsIn(NOTIFICATION_SEVERITIES)
  @IsOptional()
  severity?: NotificationSeverity;

  @ApiProperty({ example: { sessionId: 'xxx', severity: 'critical' }, required: false })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;

  @ApiProperty({
    example: '2026-04-04T12:30:00.000Z',
    required: false
  })
  @IsISO8601()
  @IsOptional()
  createdAt?: string;
}
