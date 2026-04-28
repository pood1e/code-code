import { create } from "@bufbuild/protobuf";
import { ModelListFilterSchema, type ModelListFilter } from "@code-code/agent-contract/platform/model/v1";

export function buildStructuredFilter(
  vendorIds: string[],
  modelQuery: string,
  sourceIds: string[] = [],
  badge = "",
  category = "",
  hideDeprecated = false,
): ModelListFilter {
  return create(ModelListFilterSchema, {
    vendorIds: vendorIds.length > 0 ? vendorIds : undefined,
    query: modelQuery.trim() || undefined,
    sourceIds: sourceIds.length > 0 ? sourceIds : undefined,
    badge: badge.trim() || undefined,
    category: category.trim() || undefined,
    lifecycleStatusExclude: hideDeprecated ? ["deprecated", "eol", "blocked"] : undefined,
  });
}

export function toggleSelected(values: string[], value: string) {
  const current = new Set(values);
  if (current.has(value)) {
    current.delete(value);
  } else {
    current.add(value);
  }
  return Array.from(current).sort();
}
