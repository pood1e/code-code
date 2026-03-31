import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { mcpInputSchema } from '@agent-workbench/shared';

import { toInputJson } from '../../common/json.utils';
import { PrismaService } from '../../prisma/prisma.service';
import { McpMutationDto } from '../../dto/resource.dto';

@Injectable()
export class McpsService {
  constructor(private readonly prisma: PrismaService) {}

  list(name?: string) {
    return this.prisma.mCP.findMany({
      where: name ? { name: { contains: name } } : undefined,
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
    const parsed = mcpInputSchema.safeParse(dto);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid MCP payload'
      );
    }

    return this.prisma.mCP.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        content: toInputJson(parsed.data.content)
      }
    });
  }

  async update(id: string, dto: McpMutationDto) {
    await this.getById(id);
    const parsed = mcpInputSchema.safeParse(dto);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid MCP payload'
      );
    }

    return this.prisma.mCP.update({
      where: { id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        content: toInputJson(parsed.data.content)
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

    if (references.length > 0) {
      throw new ConflictException({
        message: '该资源被以下 Profile 引用，无法删除',
        referencedBy: references.map(({ profile }) => profile)
      });
    }

    await this.prisma.mCP.delete({ where: { id } });
    return null;
  }
}
