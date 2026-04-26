import type { ModelDefinition } from "@code-code/agent-contract/model/v1";
import type { VendorView } from "@code-code/agent-contract/platform/provider/v1";
import type { ModelRegistryEntry } from "@code-code/agent-contract/platform/model/v1";
import { Button, Code, Flex, Separator, Table, Text } from "@radix-ui/themes";
import { AsyncState, SoftBadge } from "@code-code/console-web-ui";
import { SourceBadge } from "./source-badge";
import { CapabilityBadge } from "./capability-icon-badge";
import { EMPTY_VALUE } from "./model-detail-formatters";
import { ModelDetailsDialog } from "./model-details-dialog";
import { formatTokenSize, getVendorLabel } from "./model-formatters";
import { VendorAvatar } from "./vendor-avatar";
import { formatSourcePricing } from "../source-pricing";
import { sourceOptionLabel } from "./model-table-filter-options";

type ModelRowProps = {
  model: ModelRegistryEntry;
  vendor?: VendorView;
  vendorsById: Record<string, VendorView>;
  proxyRows: ModelRegistryEntry[];
  proxyLoading: boolean;
  proxyTruncated: boolean;
  expanded: boolean;
  onToggle: () => void;
  selectedSourceIds: string[];
};

export function ModelRow({
  model,
  vendor,
  vendorsById,
  proxyRows,
  proxyLoading,
  proxyTruncated,
  expanded,
  onToggle,
  selectedSourceIds,
}: ModelRowProps) {
  const definition = model.definition as ModelDefinition;
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
  const proxyCount = proxyRows.length;
  const proxyButtonLabel = proxyLoading && proxyCount === 0
    ? "Loading Proxies"
    : proxyCount === 0
      ? "No Proxies"
      : expanded
        ? `Hide Proxies (${proxyCount})`
        : `Show Proxies (${proxyCount})`;

  return (
    <>
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
          <Text size="2">{formatTokenSize(definition.contextWindowTokens)}</Text>
        </Table.Cell>
        <Table.Cell>
          {!pricingSummary ? (
            <Text size="2" color="gray">{EMPTY_VALUE}</Text>
          ) : (
            <Text size="1">{pricingSummary}</Text>
          )}
        </Table.Cell>
        <Table.Cell justify="end">
          <Flex gap="2" justify="end">
            <Button
              variant={expanded ? "solid" : "soft"}
              color="gray"
              size="1"
              onClick={onToggle}
              disabled={!proxyLoading && proxyCount === 0}
            >
              {proxyButtonLabel}
            </Button>
            <ModelDetailsDialog row={model} vendorsById={vendorsById} />
          </Flex>
        </Table.Cell>
      </Table.Row>
      {expanded ? (
        <Table.Row>
          <Table.Cell colSpan={5}>
            <RelatedProxyModels
              rows={proxyRows}
              isLoading={proxyLoading}
              isTruncated={proxyTruncated}
              vendorsById={vendorsById}
            />
          </Table.Cell>
        </Table.Row>
      ) : null}
    </>
  );
}

type RelatedProxyModelsProps = {
  rows: ModelRegistryEntry[];
  isLoading: boolean;
  isTruncated: boolean;
  vendorsById: Record<string, VendorView>;
};

function RelatedProxyModels({ rows, isLoading, isTruncated, vendorsById }: RelatedProxyModelsProps) {
  return (
    <AsyncState
      loading={isLoading}
      isEmpty={rows.length === 0}
      emptyTitle="No proxy models."
      loadingCard={false}
    >
      <Flex direction="column" gap="3" py="2">
        {rows.map((row, index) => {
          const definition = row.definition as ModelDefinition;
          const vendor = vendorsById[definition.vendorId];
          const vendorLabel = vendor?.displayName || getVendorLabel(definition);
          const pricingSummary = formatSourcePricing(row.pricing);
          const contextWindow = formatTokenSize(definition.contextWindowTokens);
          return (
            <Flex key={`${definition.vendorId}:${definition.modelId}`} direction="column" gap="2">
              {index > 0 ? <Separator size="4" /> : null}
              <Flex align="center" gap="2" wrap="wrap">
                <VendorAvatar displayName={vendorLabel} iconUrl={vendor?.iconUrl} size="1" />
                <SoftBadge size="1" color="gray" label={vendorLabel} />
                <Code size="1" variant="ghost">{definition.modelId}</Code>
                <SourceBadge badges={row.badges} />
              </Flex>
              {definition.displayName && definition.displayName !== definition.modelId ? (
                <Text size="2">{definition.displayName}</Text>
              ) : null}
              <Flex align="center" gap="3" wrap="wrap">
                <Text size="1" color="gray">{pricingSummary || EMPTY_VALUE}</Text>
                <Text size="1" color="gray">Context {contextWindow}</Text>
              </Flex>
            </Flex>
          );
        })}
        {isTruncated ? (
          <Text size="1" color="gray">Only the first proxy page is shown.</Text>
        ) : null}
      </Flex>
    </AsyncState>
  );
}
