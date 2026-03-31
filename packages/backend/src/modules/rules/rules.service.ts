import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { ruleInputSchema } from '@agent-workbench/shared';

import { PrismaService } from '../../prisma/prisma.service';
import { RuleMutationDto } from '../../dto/resource.dto';

@Injectable()
export class RulesService {
  constructor(private readonly prisma: PrismaService) {}

  list(name?: string) {
    return this.prisma.rule.findMany({
      where: name ? { name: { contains: name } } : undefined,
      orderBy: { updatedAt: 'desc' }
    });
  }

  async getById(id: string) {
    const rule = await this.prisma.rule.findUnique({ where: { id } });
    if (!rule) {
      throw new NotFoundException('Rule not found');
    }

    return rule;
  }

  create(dto: RuleMutationDto) {
    const parsed = ruleInputSchema.safeParse(dto);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid rule payload'
      );
    }

    return this.prisma.rule.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        content: parsed.data.content
      }
    });
  }

  async update(id: string, dto: RuleMutationDto) {
    await this.getById(id);
    const parsed = ruleInputSchema.safeParse(dto);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid rule payload'
      );
    }

    return this.prisma.rule.update({
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

    const references = await this.prisma.profileRule.findMany({
      where: { ruleId: id },
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

    await this.prisma.rule.delete({ where: { id } });
    return null;
  }
}
