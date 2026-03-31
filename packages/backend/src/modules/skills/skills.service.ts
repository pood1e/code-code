import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { skillInputSchema } from '@agent-workbench/shared';

import { PrismaService } from '../../prisma/prisma.service';
import { SkillMutationDto } from '../../dto/resource.dto';

@Injectable()
export class SkillsService {
  constructor(private readonly prisma: PrismaService) {}

  list(name?: string) {
    return this.prisma.skill.findMany({
      where: name ? { name: { contains: name } } : undefined,
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
    const parsed = skillInputSchema.safeParse(dto);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid skill payload'
      );
    }

    return this.prisma.skill.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        content: parsed.data.content
      }
    });
  }

  async update(id: string, dto: SkillMutationDto) {
    await this.getById(id);
    const parsed = skillInputSchema.safeParse(dto);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid skill payload'
      );
    }

    return this.prisma.skill.update({
      where: { id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        content: parsed.data.content
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

    if (references.length > 0) {
      throw new ConflictException({
        message: '该资源被以下 Profile 引用，无法删除',
        referencedBy: references.map(({ profile }) => profile)
      });
    }

    await this.prisma.skill.delete({ where: { id } });
    return null;
  }
}
