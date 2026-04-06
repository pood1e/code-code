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
  repoGitUrl!: string;

  @ApiProperty({
    example: '/Users/pood1e/workspace/agent-workbench',
    description: '会话与流程工作目录的根路径，不是仓库代码目录'
  })
  @IsString()
  @IsNotEmpty()
  workspaceRootPath!: string;

  @ApiPropertyOptional({
    example: 'git@github.com:pood1e/code-code-docs.git',
    description: '可选，仅支持 SSH Git 地址'
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  docGitUrl?: string | null;
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

  @ApiPropertyOptional({ example: 'git@github.com:pood1e/code-code.git' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  repoGitUrl?: string;

  @ApiPropertyOptional({
    example: '/Users/pood1e/workspace/agent-workbench',
    description: '会话与流程工作目录的根路径，不是仓库代码目录'
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  workspaceRootPath?: string;

  @ApiPropertyOptional({
    example: 'git@github.com:pood1e/code-code-docs.git',
    description: '可选，仅支持 SSH Git 地址'
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  docGitUrl?: string | null;
}
