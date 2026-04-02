import {
  Injectable,
  NotFoundException
} from '@nestjs/common';
import {
  profileInputSchema,
  saveProfileInputSchema,
  mcpConfigOverrideSchema,
  mcpContentSchema,
  type McpConfigOverrideInput,
  type McpContentInput
} from '@agent-workbench/shared';
import { Prisma } from '@prisma/client';
import { dump } from 'js-yaml';

import {
  asPlainObject,
  sanitizeJson,
  toOptionalInputJson
} from '../../common/json.utils';
import { assertResourceIdsExist } from '../../common/resource.utils';
import { parseSchemaOrThrow } from '../../common/schema.utils';
import {
  ProfileMutationDto,
  SaveProfileDto
} from '../../dto/profile.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProfilesService {
  private readonly prisma: PrismaService;

  constructor(prisma: PrismaService) {
    this.prisma = prisma;
  }

  list() {
    return this.prisma.profile.findMany({
      orderBy: { updatedAt: 'desc' }
    });
  }

  async getById(id: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { id },
      include: {
        skills: {
          include: { skill: true },
          orderBy: { order: 'asc' }
        },
        mcps: {
          include: { mcp: true },
          orderBy: { order: 'asc' }
        },
        rules: {
          include: { rule: true },
          orderBy: { order: 'asc' }
        }
      }
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return {
      id: profile.id,
      name: profile.name,
      description: profile.description,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      skills: profile.skills.map((item) =>
        this.toSkillResolvedItem(item.skill, item.order)
      ),
      mcps: profile.mcps.map((item) =>
        this.toMcpResolvedItem(item.mcp, item.order, item.configOverride)
      ),
      rules: profile.rules.map((item) =>
        this.toRuleResolvedItem(item.rule, item.order)
      )
    };
  }

  create(dto: ProfileMutationDto) {
    const parsedProfile = this.parseProfileInput(dto);

    return this.prisma.profile.create({
      data: {
        name: parsedProfile.name,
        description: parsedProfile.description ?? null
      }
    });
  }

  async update(id: string, dto: SaveProfileDto) {
    await this.ensureProfile(id);
    const parsedProfile = parseSchemaOrThrow(
      saveProfileInputSchema,
      dto,
      'Invalid profile payload'
    );
    const normalizedSkills = this.normalizeProfileItems(parsedProfile.skills);
    const normalizedMcps = this.normalizeProfileItems(parsedProfile.mcps);
    const normalizedRules = this.normalizeProfileItems(parsedProfile.rules);

    await Promise.all([
      assertResourceIdsExist(
        this.prisma,
        'skill',
        normalizedSkills.map((item) => item.resourceId)
      ),
      assertResourceIdsExist(
        this.prisma,
        'mcp',
        normalizedMcps.map((item) => item.resourceId)
      ),
      assertResourceIdsExist(
        this.prisma,
        'rule',
        normalizedRules.map((item) => item.resourceId)
      )
    ]);

    await this.prisma.$transaction(async (tx) => {
      await tx.profile.update({
        where: { id },
        data: {
          name: parsedProfile.name,
          description: parsedProfile.description ?? null,
          updatedAt: new Date()
        }
      });

      await tx.profileSkill.deleteMany({ where: { profileId: id } });
      await tx.profileMCP.deleteMany({ where: { profileId: id } });
      await tx.profileRule.deleteMany({ where: { profileId: id } });

      if (normalizedSkills.length > 0) {
        await tx.profileSkill.createMany({
          data: normalizedSkills.map((item) => ({
            profileId: id,
            skillId: item.resourceId,
            order: item.order
          }))
        });
      }

      if (normalizedMcps.length > 0) {
        await tx.profileMCP.createMany({
          data: normalizedMcps.map((item) => ({
            profileId: id,
            mcpId: item.resourceId,
            order: item.order,
            configOverride: toOptionalInputJson(item.configOverride)
          }))
        });
      }

      if (normalizedRules.length > 0) {
        await tx.profileRule.createMany({
          data: normalizedRules.map((item) => ({
            profileId: id,
            ruleId: item.resourceId,
            order: item.order
          }))
        });
      }
    });

    return this.getById(id);
  }

  async remove(id: string) {
    await this.ensureProfile(id);
    await this.prisma.profile.delete({ where: { id } });
    return null;
  }

  async render(id: string) {
    const detail = await this.getById(id);

    return {
      id: detail.id,
      name: detail.name,
      description: detail.description,
      skills: detail.skills,
      mcps: detail.mcps,
      rules: detail.rules
    };
  }

  async export(id: string, format: 'json' | 'yaml' = 'json') {
    const rendered = sanitizeJson(await this.render(id));

    if (format === 'yaml') {
      return dump(rendered, { noRefs: true });
    }

    return JSON.stringify(rendered, null, 2);
  }

  private async ensureProfile(id: string) {
    const profile = await this.prisma.profile.findUnique({ where: { id } });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }
    return profile;
  }

  private parseProfileInput(dto: ProfileMutationDto) {
    return parseSchemaOrThrow(profileInputSchema, dto, 'Invalid profile payload');
  }

  private normalizeProfileItems<
    TItem extends {
      order: number;
    }
  >(items: TItem[]) {
    return items.map((item, index) => ({
      ...item,
      order: index
    }));
  }



  private toSkillResolvedItem(
    resource: {
      id: string;
      name: string;
      description: string | null;
      content: string;
    },
    order: number
  ) {
    return {
      id: resource.id,
      name: resource.name,
      description: resource.description,
      content: resource.content,
      resolved: resource.content,
      order
    };
  }

  private toRuleResolvedItem(
    resource: {
      id: string;
      name: string;
      description: string | null;
      content: string;
    },
    order: number
  ) {
    return {
      id: resource.id,
      name: resource.name,
      description: resource.description,
      content: resource.content,
      resolved: resource.content,
      order
    };
  }

  private toMcpResolvedItem(
    resource: {
      id: string;
      name: string;
      description: string | null;
      content: Prisma.JsonValue;
    },
    order: number,
    configOverride: Prisma.JsonValue | null
  ) {
    const content = this.parseMcpContent(resource.content);
    const override = this.parseMcpOverride(configOverride);

    return {
      id: resource.id,
      name: resource.name,
      description: resource.description,
      content,
      configOverride: override,
      resolved: Object.assign({}, content, override),
      order
    };
  }

  private parseMcpContent(value: Prisma.JsonValue): McpContentInput {
    return mcpContentSchema.parse(sanitizeJson(value));
  }

  private parseMcpOverride(
    value: Prisma.JsonValue | null
  ): McpConfigOverrideInput {
    return mcpConfigOverrideSchema.parse(sanitizeJson(asPlainObject(value)));
  }
}
