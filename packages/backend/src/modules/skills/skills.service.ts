import { Injectable } from '@nestjs/common';
import { skillInputSchema, type SkillInput } from '@agent-workbench/shared';

import { createResourceCrudHandlers } from '../../common/resource-crud';
import { parseSchemaOrThrow } from '../../common/schema.utils';
import { PrismaService } from '../../prisma/prisma.service';
import { SkillMutationDto } from '../../dto/resource.dto';

@Injectable()
export class SkillsService {
  private readonly prisma: PrismaService;

  constructor(prisma: PrismaService) {
    this.prisma = prisma;
  }

  private createResourceCrud() {
    return createResourceCrudHandlers<
      SkillInput,
      NonNullable<Awaited<ReturnType<PrismaService['skill']['findUnique']>>>
    >({
      resourceLabel: 'Skill',
      list: (nameFilter) =>
        this.prisma.skill.findMany({
          where: nameFilter,
          orderBy: { updatedAt: 'desc' }
        }),
      findById: (id) => this.prisma.skill.findUnique({ where: { id } }),
      create: (parsed) =>
        this.prisma.skill.create({
          data: {
            name: parsed.name,
            description: parsed.description ?? null,
            content: parsed.content
          }
        }),
      update: (id, parsed) =>
        this.prisma.skill.update({
          where: { id },
          data: {
            name: parsed.name,
            description: parsed.description ?? null,
            content: parsed.content
          }
        }),
      findReferences: (id) =>
        this.prisma.profileSkill.findMany({
          where: { skillId: id },
          select: {
            profile: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }),
      remove: (id) =>
        this.prisma.skill.delete({ where: { id } }).then(() => undefined)
    });
  }

  list(name?: string) {
    return this.createResourceCrud().list(name);
  }

  getById(id: string) {
    return this.createResourceCrud().getById(id);
  }

  create(dto: SkillMutationDto) {
    const parsed = parseSchemaOrThrow(
      skillInputSchema,
      dto,
      'Invalid skill payload'
    );

    return this.createResourceCrud().create(parsed);
  }

  update(id: string, dto: SkillMutationDto) {
    const parsed = parseSchemaOrThrow(
      skillInputSchema,
      dto,
      'Invalid skill payload'
    );

    return this.createResourceCrud().update(id, parsed);
  }

  remove(id: string) {
    return this.createResourceCrud().remove(id);
  }
}
