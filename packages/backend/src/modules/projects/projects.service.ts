import {
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import {
  createProjectInputSchema,
  sshGitUrlSchema,
  updateProjectInputSchema
} from '@agent-workbench/shared';
import { stat } from 'node:fs/promises';
import path from 'node:path';

import { buildNameFilter } from '../../common/resource.utils';
import { parseSchemaOrThrow } from '../../common/schema.utils';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  list(name?: string) {
    return this.prisma.project.findMany({
      where: buildNameFilter(name),
      orderBy: { updatedAt: 'desc' }
    });
  }

  async getById(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id }
    });

    if (!project) {
      throw new NotFoundException(`Project not found: ${id}`);
    }

    return project;
  }

  async create(dto: CreateProjectDto) {
    const parsed = parseSchemaOrThrow(
      createProjectInputSchema,
      dto,
      'Invalid project payload'
    );

    await this.assertWorkspacePath(parsed.workspacePath);
    await this.assertDocSource(parsed.docSource);

    return this.prisma.project.create({
      data: {
        name: parsed.name,
        description: parsed.description ?? null,
        gitUrl: parsed.gitUrl,
        workspacePath: parsed.workspacePath,
        docSource: parsed.docSource ?? null
      }
    });
  }

  async update(id: string, dto: UpdateProjectDto) {
    await this.getById(id);

    const parsed = parseSchemaOrThrow(
      updateProjectInputSchema,
      dto,
      'Invalid project payload'
    );

    if (parsed.workspacePath !== undefined) {
      await this.assertWorkspacePath(parsed.workspacePath);
    }

    if (parsed.docSource !== undefined) {
      await this.assertDocSource(parsed.docSource);
    }

    const updateData: {
      name?: string;
      description?: string | null;
      workspacePath?: string;
      docSource?: string | null;
    } = {};

    if (parsed.name !== undefined) {
      updateData.name = parsed.name;
    }

    if (parsed.description !== undefined) {
      updateData.description = parsed.description ?? null;
    }

    if (parsed.workspacePath !== undefined) {
      updateData.workspacePath = parsed.workspacePath;
    }

    if (parsed.docSource !== undefined) {
      updateData.docSource = parsed.docSource ?? null;
    }

    return this.prisma.project.update({
      where: { id },
      data: updateData
    });
  }

  async remove(id: string) {
    await this.getById(id);
    await this.prisma.project.delete({ where: { id } });
    return null;
  }

  private async assertWorkspacePath(workspacePath: string) {
    await this.assertLocalDirectoryPath(
      workspacePath,
      'workspacePath must be an absolute path',
      'workspacePath does not exist or is not a directory'
    );
  }

  private async assertDocSource(docSource: string | null | undefined) {
    if (docSource === undefined || docSource === null) {
      return;
    }

    if (sshGitUrlSchema.safeParse(docSource).success) {
      return;
    }

    await this.assertLocalDirectoryPath(
      docSource,
      'docSource must be an absolute path when using a local directory',
      'docSource does not exist or is not a directory'
    );
  }

  private async assertLocalDirectoryPath(
    directoryPath: string,
    absolutePathMessage: string,
    missingDirectoryMessage: string
  ) {
    const normalizedPath = directoryPath.trim();

    if (!path.isAbsolute(normalizedPath)) {
      throw new BadRequestException(absolutePathMessage);
    }

    let directoryStat;

    try {
      directoryStat = await stat(normalizedPath);
    } catch {
      throw new BadRequestException(missingDirectoryMessage);
    }

    if (!directoryStat.isDirectory()) {
      throw new BadRequestException(missingDirectoryMessage);
    }
  }
}
