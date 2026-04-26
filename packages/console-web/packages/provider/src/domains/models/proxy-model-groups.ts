import type { ModelRegistryEntry } from "@code-code/agent-contract/platform/model/v1";

export type ProxyModelGroups = Record<string, ModelRegistryEntry[]>;

export function groupProxyModels(directRows: ModelRegistryEntry[], proxyRows: ModelRegistryEntry[]) {
  const allowed = new Set(directRows.map(proxyGroupKeyForDefinition));
  const groups: ProxyModelGroups = {};
  for (const row of proxyRows) {
    const sourceRef = row.sourceRef;
    if (!sourceRef) {
      continue;
    }
    const key = proxyGroupKey(sourceRef.vendorId, sourceRef.modelId);
    if (!allowed.has(key)) {
      continue;
    }
    groups[key] = [...(groups[key] || []), row];
  }
  return groups;
}

export function proxyGroupKeyForDefinition(row: ModelRegistryEntry) {
  const definition = row.definition;
  return proxyGroupKey(definition?.vendorId || "", definition?.modelId || "");
}

export function proxyGroupKey(vendorId: string, modelId: string) {
  return `${vendorId}\u0000${modelId}`;
}
