import {
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { mcpInputSchema } from '@agent-workbench/shared';

import {
  buildNameFilter,
  throwIfReferencedByProfiles
} from '../../common/resource.utils';
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

  list(name?: string) {
    return this.prisma.mCP.findMany({
      where: buildNameFilter(name),
      orderBy: { updatedAt: 'desc' }
    });
  }

  async getById(id: string) {
    const mcp = await this.prisma.mCP.findUnique({ where: { id } });
    if (!mcp) {
      throw new NotFoundException('MCP not found');
    }

    return mcp;
  }

  create(dto: McpMutationDto) {
    const parsed = parseSchemaOrThrow(mcpInputSchema, dto, 'Invalid MCP payload');

    return this.prisma.mCP.create({
      data: {
        name: parsed.name,
        description: parsed.description ?? null,
        content: toInputJson(parsed.content)
      }
    });
  }

  async update(id: string, dto: McpMutationDto) {
    await this.getById(id);
    const parsed = parseSchemaOrThrow(mcpInputSchema, dto, 'Invalid MCP payload');

    return this.prisma.mCP.update({
      where: { id },
      data: {
        name: parsed.name,
        description: parsed.description ?? null,
        content: toInputJson(parsed.content)
      }
    });
  }

  async remove(id: string) {
    await this.getById(id);

    const references = await this.prisma.profileMCP.findMany({
      where: { mcpId: id },
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

    await this.prisma.mCP.delete({ where: { id } });
    return null;
  }
}
