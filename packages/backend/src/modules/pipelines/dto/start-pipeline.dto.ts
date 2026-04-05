import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StartPipelineDto {
  @ApiProperty({ description: 'Agent Runner ID to use for this pipeline run' })
  @IsString()
  runnerId!: string;

  @ApiPropertyOptional({
    description: 'Maximum number of breakdown retry loops (1-10, default 3)',
    minimum: 1,
    maximum: 10
  })
  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  maxRetry?: number;
}
