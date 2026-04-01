import { Injectable } from '@nestjs/common';
import { mcpInputSchema, type McpInput } from '@agent-workbench/shared';

import { createResourceCrudHandlers } from '../../common/resource-crud';
import { parseSchemaOrThrow } from '../../common/schema.utils';
import { toInputJson } from '../../common/json.utils';
import { PrismaService } from '../../prisma/prisma.service';
import { McpMutationDto } from '../../dto/resource.dto';

@Injectable()
export class McpsService {
  private readonly prisma: PrismaService;

  constructor(prisma: PrismaService) {
    this.prisma = prisma;
  }

  private createResourceCrud() {
    return createResourceCrudHandlers<
      McpInput,
      NonNullable<Awaited<ReturnType<PrismaService['mCP']['findUnique']>>>
    >({
      resourceLabel: 'MCP',
      list: (nameFilter) =>
        this.prisma.mCP.findMany({
          where: nameFilter,
          orderBy: { updatedAt: 'desc' }
        }),
      findById: (id) => this.prisma.mCP.findUnique({ where: { id } }),
      create: (parsed) =>
        this.prisma.mCP.create({
          data: {
            name: parsed.name,
            description: parsed.description ?? null,
            content: toInputJson(parsed.content)
          }
        }),
      update: (id, parsed) =>
        this.prisma.mCP.update({
          where: { id },
          data: {
            name: parsed.name,
            description: parsed.description ?? null,
            content: toInputJson(parsed.content)
          }
        }),
      findReferences: (id) =>
        this.prisma.profileMCP.findMany({
          where: { mcpId: id },
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
        this.prisma.mCP.delete({ where: { id } }).then(() => undefined)
    });
  }

  list(name?: string) {
    return this.createResourceCrud().list(name);
  }

  getById(id: string) {
    return this.createResourceCrud().getById(id);
  }

  create(dto: McpMutationDto) {
    const parsed = parseSchemaOrThrow(mcpInputSchema, dto, 'Invalid MCP payload');

    return this.createResourceCrud().create(parsed);
  }

  update(id: string, dto: McpMutationDto) {
    const parsed = parseSchemaOrThrow(mcpInputSchema, dto, 'Invalid MCP payload');

    return this.createResourceCrud().update(id, parsed);
  }

  remove(id: string) {
    return this.createResourceCrud().remove(id);
  }
}
