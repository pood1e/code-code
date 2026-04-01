import {
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { skillInputSchema } from '@agent-workbench/shared';

import {
  buildNameFilter,
  throwIfReferencedByProfiles
} from '../../common/resource.utils';
import { parseSchemaOrThrow } from '../../common/schema.utils';
import { PrismaService } from '../../prisma/prisma.service';
import { SkillMutationDto } from '../../dto/resource.dto';

@Injectable()
export class SkillsService {
  private readonly prisma: PrismaService;

  constructor(prisma: PrismaService) {
    this.prisma = prisma;
  }

  list(name?: string) {
    return this.prisma.skill.findMany({
      where: buildNameFilter(name),
      orderBy: { updatedAt: 'desc' }
    });
  }

  async getById(id: string) {
    const skill = await this.prisma.skill.findUnique({ where: { id } });
    if (!skill) {
      throw new NotFoundException('Skill not found');
    }

    return skill;
  }

  create(dto: SkillMutationDto) {
    const parsed = parseSchemaOrThrow(
      skillInputSchema,
      dto,
      'Invalid skill payload'
    );

    return this.prisma.skill.create({
      data: {
        name: parsed.name,
        description: parsed.description ?? null,
        content: parsed.content
      }
    });
  }

  async update(id: string, dto: SkillMutationDto) {
    await this.getById(id);
    const parsed = parseSchemaOrThrow(
      skillInputSchema,
      dto,
      'Invalid skill payload'
    );

    return this.prisma.skill.update({
      where: { id },
      data: {
        name: parsed.name,
        description: parsed.description ?? null,
        content: parsed.content
      }
    });
  }

  async remove(id: string) {
    await this.getById(id);

    const references = await this.prisma.profileSkill.findMany({
      where: { skillId: id },
      select: {
        profile: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    throwIfReferencedByProfiles(references);

    await this.prisma.skill.delete({ where: { id } });
    return null;
  }
}
