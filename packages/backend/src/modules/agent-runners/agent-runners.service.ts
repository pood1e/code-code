import {
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { buildNameFilter } from '../../common/resource.utils';
import { parseSchemaOrThrow } from '../../common/schema.utils';
import { PrismaService } from '../../prisma/prisma.service';
import { RunnerTypeRegistry } from './runner-type.registry';
import {
  AgentRunnerQueryDto,
  CreateAgentRunnerDto,
  UpdateAgentRunnerDto
} from './dto/agent-runner.dto';

@Injectable()
export class AgentRunnersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runnerTypeRegistry: RunnerTypeRegistry
  ) {}

  list(query: AgentRunnerQueryDto) {
    return this.prisma.agentRunner.findMany({
      where: buildNameFilter(query.name),
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }

  async getById(id: string) {
    const runner = await this.prisma.agentRunner.findUnique({
      where: { id }
    });
    if (!runner) {
      throw new NotFoundException('AgentRunner not found');
    }

    return runner;
  }

  async create(dto: CreateAgentRunnerDto) {
    if (!this.runnerTypeRegistry.has(dto.type)) {
      throw new BadRequestException(`Runner type '${dto.type}' does not exist`);
    }

    const runnerType = this.runnerTypeRegistry.get(dto.type)!;
    const parsed = parseSchemaOrThrow(
      runnerType.runnerConfigSchema,
      dto.runnerConfig,
      `Invalid runnerConfig for type '${dto.type}'`
    );

    return this.prisma.agentRunner.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        type: dto.type,
        runnerConfig: parsed as object
      }
    });
  }

  async update(id: string, dto: UpdateAgentRunnerDto) {
    const existing = await this.getById(id);

    const updateData: {
      name?: string;
      description?: string | null;
      runnerConfig?: object;
    } = {};

    if (dto.name !== undefined) {
      updateData.name = dto.name;
    }

    if (dto.description !== undefined) {
      updateData.description = dto.description;
    }

    if (dto.runnerConfig !== undefined) {
      const runnerType = this.runnerTypeRegistry.get(existing.type);
      if (!runnerType) {
        throw new BadRequestException(
          `Runner type '${existing.type}' is no longer registered`
        );
      }
      const parsed = parseSchemaOrThrow(
        runnerType.runnerConfigSchema,
        dto.runnerConfig,
        `Invalid runnerConfig for type '${existing.type}'`
      );
      updateData.runnerConfig = parsed as object;
    }

    return this.prisma.agentRunner.update({
      where: { id },
      data: updateData
    });
  }

  async remove(id: string) {
    await this.getById(id);

    const sessionCount = await this.prisma.agentSession.count({
      where: { runnerId: id }
    });
    if (sessionCount > 0) {
      throw new BadRequestException(
        `Cannot delete runner: ${sessionCount} session(s) still reference it`
      );
    }

    await this.prisma.agentRunner.delete({ where: { id } });
    return null;
  }
}
