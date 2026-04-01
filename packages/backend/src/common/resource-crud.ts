import { NotFoundException } from '@nestjs/common';

import { buildNameFilter, throwIfReferencedByProfiles } from './resource.utils';

type ResourceCrudConfig<TParsed, TRecord> = {
  resourceLabel: string;
  list: (nameFilter: ReturnType<typeof buildNameFilter>) => Promise<TRecord[]>;
  findById: (id: string) => Promise<TRecord | null>;
  create: (parsed: TParsed) => Promise<TRecord>;
  update: (id: string, parsed: TParsed) => Promise<TRecord>;
  findReferences: (id: string) => Promise<
    Array<{
      profile: {
        id: string;
        name: string;
      };
    }>
  >;
  remove: (id: string) => Promise<void>;
};

export function createResourceCrudHandlers<TParsed, TRecord>(
  config: ResourceCrudConfig<TParsed, TRecord>
) {
  async function getById(id: string) {
    const resource = await config.findById(id);

    if (!resource) {
      throw new NotFoundException(`${config.resourceLabel} not found`);
    }

    return resource;
  }

  return {
    list(name?: string) {
      return config.list(buildNameFilter(name));
    },
    getById,
    create(parsed: TParsed) {
      return config.create(parsed);
    },
    async update(id: string, parsed: TParsed) {
      await getById(id);
      return config.update(id, parsed);
    },
    async remove(id: string) {
      await getById(id);

      const references = await config.findReferences(id);
      throwIfReferencedByProfiles(references);

      await config.remove(id);
      return null;
    }
  };
}
