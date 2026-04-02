export type ReferencedProfile = {
  id: string;
  name: string;
};

function isReferencedProfile(value: unknown): value is ReferencedProfile {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'id' in value &&
      typeof value.id === 'string' &&
      'name' in value &&
      typeof value.name === 'string'
  );
}

export function getReferencedProfiles(data: unknown): ReferencedProfile[] {
  if (
    !data ||
    typeof data !== 'object' ||
    !('referencedBy' in data) ||
    !Array.isArray(data.referencedBy)
  ) {
    return [];
  }

  return data.referencedBy.filter(isReferencedProfile);
}
