import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ProjectQueryDto {
  @ApiPropertyOptional({ example: 'agent' })
  @IsOptional()
  @IsString()
  name?: string;
}

export class CreateProjectDto {
  @ApiProperty({ example: 'Agent Workbench' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'Current monorepo workspace for the tool.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiProperty({ example: 'git@github.com:pood1e/code-code.git' })
  @IsString()
  @IsNotEmpty()
  gitUrl!: string;

  @ApiProperty({ example: '/Users/pood1e/workspace/code-code' })
  @IsString()
  @IsNotEmpty()
  workspacePath!: string;
}

export class UpdateProjectDto {
  @ApiPropertyOptional({ example: 'Agent Workbench' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'Current monorepo workspace for the tool.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({ example: '/Users/pood1e/workspace/code-code' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  workspacePath?: string;
}
