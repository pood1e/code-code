import { ConflictException, NotFoundException } from '@nestjs/common';

import type { PrismaService } from '../prisma/prisma.service';

export type ResourceIdType = 'skill' | 'mcp' | 'rule';

export type ReferencedProfile = {
  profile: {
    id: string;
    name: string;
  };
};

export function buildNameFilter(name?: string) {
  const normalizedName = name?.trim();

  return normalizedName
    ? {
        name: {
          contains: normalizedName
        }
      }
    : undefined;
}

export function throwIfReferencedByProfiles(
  references: ReferencedProfile[],
  message = '该资源被以下 Profile 引用，无法删除'
) {
  if (references.length === 0) {
    return;
  }

  throw new ConflictException({
    message,
    referencedBy: references.map(({ profile }) => profile)
  });
}

/**
 * Verify that all given resource IDs exist in the database.
 * Throws `NotFoundException` listing any missing IDs.
 */
export async function assertResourceIdsExist(
  prisma: PrismaService,
  type: ResourceIdType,
  ids: string[]
) {
  if (ids.length === 0) {
    return;
  }

  const uniqueIds = Array.from(new Set(ids));
  const existing =
    type === 'skill'
      ? await prisma.skill.findMany({
          where: { id: { in: uniqueIds } },
          select: { id: true }
        })
      : type === 'mcp'
        ? await prisma.mCP.findMany({
            where: { id: { in: uniqueIds } },
            select: { id: true }
          })
        : await prisma.rule.findMany({
            where: { id: { in: uniqueIds } },
            select: { id: true }
          });
  const existingIds = new Set(existing.map((item) => item.id));
  const missingIds = uniqueIds.filter((id) => !existingIds.has(id));

  if (missingIds.length > 0) {
    throw new NotFoundException(
      `Referenced ${type} resources not found: ${missingIds.join(', ')}`
    );
  }
}
