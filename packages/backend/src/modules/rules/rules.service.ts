import {
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { ruleInputSchema } from '@agent-workbench/shared';

import {
  buildNameFilter,
  throwIfReferencedByProfiles
} from '../../common/resource.utils';
import { parseSchemaOrThrow } from '../../common/schema.utils';
import { PrismaService } from '../../prisma/prisma.service';
import { RuleMutationDto } from '../../dto/resource.dto';

@Injectable()
export class RulesService {
  private readonly prisma: PrismaService;

  constructor(prisma: PrismaService) {
    this.prisma = prisma;
  }

  list(name?: string) {
    return this.prisma.rule.findMany({
      where: buildNameFilter(name),
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
    const parsed = parseSchemaOrThrow(
      ruleInputSchema,
      dto,
      'Invalid rule payload'
    );

    return this.prisma.rule.create({
      data: {
        name: parsed.name,
        description: parsed.description ?? null,
        content: parsed.content
      }
    });
  }

  async update(id: string, dto: RuleMutationDto) {
    await this.getById(id);
    const parsed = parseSchemaOrThrow(
      ruleInputSchema,
      dto,
      'Invalid rule payload'
    );

    return this.prisma.rule.update({
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

    throwIfReferencedByProfiles(references);

    await this.prisma.rule.delete({ where: { id } });
    return null;
  }
}
