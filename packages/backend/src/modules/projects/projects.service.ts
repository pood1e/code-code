import {
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import {
  createProjectInputSchema,
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

    return this.prisma.project.create({
      data: {
        name: parsed.name,
        description: parsed.description ?? null,
        gitUrl: parsed.gitUrl,
        workspacePath: parsed.workspacePath
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

    const updateData: {
      name?: string;
      description?: string | null;
      workspacePath?: string;
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
    const normalizedPath = workspacePath.trim();

    if (!path.isAbsolute(normalizedPath)) {
      throw new BadRequestException('workspacePath must be an absolute path');
    }

    let workspaceStat;

    try {
      workspaceStat = await stat(normalizedPath);
    } catch {
      throw new BadRequestException(
        'workspacePath does not exist or is not a directory'
      );
    }

    if (!workspaceStat.isDirectory()) {
      throw new BadRequestException(
        'workspacePath does not exist or is not a directory'
      );
    }
  }
}
