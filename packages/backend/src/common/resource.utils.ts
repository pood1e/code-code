import { ConflictException } from '@nestjs/common';

type ReferencedProfile = {
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
