import type { VendorView } from "@code-code/agent-contract/platform/provider/v1";
import type { ModelRegistryEntry } from "@code-code/agent-contract/platform/model/v1";
import { Code, Flex, Table, Text } from "@radix-ui/themes";
import { SoftBadge } from "@code-code/console-web-ui";
import { SourceBadge } from "./source-badge";
import { CapabilityBadge } from "./capability-icon-badge";
import { CategoryBadge } from "./category-badge";
import { EMPTY_VALUE } from "./model-detail-formatters";
import { LifecycleBadge } from "./lifecycle-badge";
import { ModelDetailsDialog } from "./model-details-dialog";
import { formatTokenSize, getVendorLabel } from "./model-formatters";
import { VendorAvatar } from "./vendor-avatar";
import { formatSourcePricing } from "../source-pricing";
import { sourceOptionLabel } from "./model-table-filter-options";
import type { ModelVersion } from "@code-code/agent-contract/model/v1";

type ModelRowProps = {
  model: ModelRegistryEntry;
  vendor?: VendorView;
  vendorsById: Record<string, VendorView>;
  selectedSourceIds: string[];
};

export function ModelRow({
  model,
  vendor,
  vendorsById,
  selectedSourceIds,
}: ModelRowProps) {
  const definition = model.definition;
  if (!definition) return null;
  const displayName = definition.displayName || definition.modelId;
  const vendorLabel = vendor?.displayName || getVendorLabel(definition);
  const showSeparateModelId = definition.displayName && definition.displayName !== definition.modelId;
  const pricingSummary = formatSourcePricing(model.pricing);
  const matchedSourceIds = selectedSourceIds.length === 0
    ? []
    : Array.from(new Set(
        model.sources
          .map((source) => source.sourceId)
          .filter((sourceId): sourceId is string => Boolean(sourceId && selectedSourceIds.includes(sourceId)))
      ));

  const contextLabel = formatContextLabel(definition);

  return (
    <Table.Row align="center">
      <Table.RowHeaderCell>
        <Flex direction="column" gap="1">
          <Text weight="medium">{displayName}</Text>
          <Flex align="center" gap="2" wrap="wrap">
            <VendorAvatar displayName={vendorLabel} iconUrl={vendor?.iconUrl} size="1" />
            {showSeparateModelId ? (
              <Code size="1" variant="ghost" color="gray">{definition.modelId}</Code>
            ) : (
              <Text color="gray" size="1">{definition.modelId}</Text>
            )}
            <SourceBadge badges={model.badges} />
            <LifecycleBadge status={definition.lifecycleStatus} />
            <CategoryBadge category={definition.category} />
            {matchedSourceIds.map((sourceId) => (
              <SoftBadge key={sourceId} size="1" color="gray" label={sourceOptionLabel(sourceId)} />
            ))}
          </Flex>
        </Flex>
      </Table.RowHeaderCell>
      <Table.Cell>
        <Flex gap="1" wrap="wrap">
          {definition.capabilities.map((capability) => (
            <CapabilityBadge key={capability} capability={capability} />
          ))}
        </Flex>
      </Table.Cell>
      <Table.Cell>
        <Text size="2">{contextLabel}</Text>
      </Table.Cell>
      <Table.Cell>
        {!pricingSummary ? (
          <Text size="2" color="gray">{EMPTY_VALUE}</Text>
        ) : (
          <Text size="1">{pricingSummary}</Text>
        )}
      </Table.Cell>
      <Table.Cell justify="end">
        <ModelDetailsDialog row={model} vendorsById={vendorsById} />
      </Table.Cell>
    </Table.Row>
  );
}

function formatContextLabel(definition: ModelVersion): string {
  const context = formatTokenSize(definition.contextSpec?.maxContextTokens);
  const output = definition.contextSpec?.maxOutputTokens
    ? formatTokenSize(definition.contextSpec.maxOutputTokens)
    : "";
  if (context === "Unknown") return context;
  if (output && output !== "Unknown") return `${context} (out ${output})`;
  return context;
}
