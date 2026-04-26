import { useState } from "react";
import type { VendorView } from "@code-code/agent-contract/platform/provider/v1";
import type { ModelRegistryEntry } from "@code-code/agent-contract/platform/model/v1";
import { Table } from "@radix-ui/themes";
import { NoDataCallout } from "@code-code/console-web-ui";
import type { ProxyModelGroups } from "../proxy-model-groups";
import { proxyGroupKeyForDefinition } from "../proxy-model-groups";
import { ModelRow } from "./model-row";
import { ModelsTableHeader } from "./models-table-header";

type ModelsTableProps = {
  models: ModelRegistryEntry[];
  vendorsById: Record<string, VendorView>;
  proxyGroups: ProxyModelGroups;
  proxyLoading: boolean;
  proxyTruncated: boolean;
  selectedSourceIds: string[];
};

export function ModelsTable({ models, vendorsById, proxyGroups, proxyLoading, proxyTruncated, selectedSourceIds }: ModelsTableProps) {
  const [expandedKey, setExpandedKey] = useState("");
  return (
    <Table.Root>
      <ModelsTableHeader />
      <Table.Body>
        {models.length === 0 ? (
          <Table.Row>
            <Table.Cell colSpan={5}>
              <NoDataCallout>No models found.</NoDataCallout>
            </Table.Cell>
          </Table.Row>
        ) : (
          models.map((model) => (
            <ModelRow
              key={`${model.definition?.vendorId || "unknown"}:${model.definition?.modelId || "unknown"}`}
              model={model}
              vendor={vendorsById[model.definition?.vendorId || ""]}
              vendorsById={vendorsById}
              proxyRows={proxyGroups[proxyGroupKeyForDefinition(model)] || []}
              proxyLoading={proxyLoading}
              proxyTruncated={proxyTruncated}
              selectedSourceIds={selectedSourceIds}
              expanded={expandedKey === proxyGroupKeyForDefinition(model)}
              onToggle={() => {
                const key = proxyGroupKeyForDefinition(model);
                setExpandedKey((current) => current === key ? "" : key);
              }}
            />
          ))
        )}
      </Table.Body>
    </Table.Root>
  );
}
