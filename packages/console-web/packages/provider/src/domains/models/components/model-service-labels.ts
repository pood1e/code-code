import type { RegistryModelSource } from "@code-code/agent-contract/platform/model/v1";
import { sourceOptionLabel } from "./model-table-filter-options";

export type ModelServiceLabelView = {
  key: string;
  label: string;
};

export function modelServiceLabelViews(
  sources: RegistryModelSource[],
  selectedSourceIds: string[] = [],
  limit = 2,
): { labels: ModelServiceLabelView[]; hiddenCount: number } {
  const sourceIds = uniqueSourceIds(sources);
  const scopedSourceIds = selectedSourceIds.length > 0
    ? sourceIds.filter((sourceId) => selectedSourceIds.includes(sourceId))
    : sourceIds;
  return {
    labels: scopedSourceIds.slice(0, limit).map((sourceId) => ({
      key: sourceId,
      label: sourceOptionLabel(sourceId),
    })),
    hiddenCount: Math.max(0, scopedSourceIds.length - limit),
  };
}

function uniqueSourceIds(sources: RegistryModelSource[]) {
  return Array.from(new Set(
    sources
      .map((source) => source.sourceId)
      .filter((sourceId): sourceId is string => Boolean(sourceId))
  ));
}
