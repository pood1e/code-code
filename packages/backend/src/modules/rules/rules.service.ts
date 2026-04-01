import { Injectable } from '@nestjs/common';
import { ruleInputSchema, type RuleInput } from '@agent-workbench/shared';

import { createResourceCrudHandlers } from '../../common/resource-crud';
import { parseSchemaOrThrow } from '../../common/schema.utils';
import { PrismaService } from '../../prisma/prisma.service';
import { RuleMutationDto } from '../../dto/resource.dto';

@Injectable()
export class RulesService {
  private readonly prisma: PrismaService;

  constructor(prisma: PrismaService) {
    this.prisma = prisma;
  }

  private createResourceCrud() {
    return createResourceCrudHandlers<
      RuleInput,
      NonNullable<Awaited<ReturnType<PrismaService['rule']['findUnique']>>>
    >({
      resourceLabel: 'Rule',
      list: (nameFilter) =>
        this.prisma.rule.findMany({
          where: nameFilter,
          orderBy: { updatedAt: 'desc' }
        }),
      findById: (id) => this.prisma.rule.findUnique({ where: { id } }),
      create: (parsed) =>
        this.prisma.rule.create({
          data: {
            name: parsed.name,
            description: parsed.description ?? null,
            content: parsed.content
          }
        }),
      update: (id, parsed) =>
        this.prisma.rule.update({
          where: { id },
          data: {
            name: parsed.name,
            description: parsed.description ?? null,
            content: parsed.content
          }
        }),
      findReferences: (id) =>
        this.prisma.profileRule.findMany({
          where: { ruleId: id },
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
        this.prisma.rule.delete({ where: { id } }).then(() => undefined)
    });
  }

  list(name?: string) {
    return this.createResourceCrud().list(name);
  }

  getById(id: string) {
    return this.createResourceCrud().getById(id);
  }

  create(dto: RuleMutationDto) {
    const parsed = parseSchemaOrThrow(
      ruleInputSchema,
      dto,
      'Invalid rule payload'
    );

    return this.createResourceCrud().create(parsed);
  }

  update(id: string, dto: RuleMutationDto) {
    const parsed = parseSchemaOrThrow(
      ruleInputSchema,
      dto,
      'Invalid rule payload'
    );

    return this.createResourceCrud().update(id, parsed);
  }

  remove(id: string) {
    return this.createResourceCrud().remove(id);
  }
}
