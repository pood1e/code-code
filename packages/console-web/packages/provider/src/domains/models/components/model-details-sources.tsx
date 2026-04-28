import type { VendorView } from "@code-code/agent-contract/platform/provider/v1";
import type { ModelRegistryEntry, RegistryModelSource } from "@code-code/agent-contract/platform/model/v1";
import { Code, Flex, Separator, Text } from "@radix-ui/themes";
import { SoftBadge } from "@code-code/console-web-ui";
import { formatPricingDetail, formatPriceType, formatSourcePricing } from "../source-pricing";
import { SourceBadge } from "./source-badge";
import { VendorAvatar } from "./vendor-avatar";
import { vendorLookupKey } from "../vendor-index";

type ModelDetailsSourcesProps = {
  row: ModelRegistryEntry;
  vendorsById: Record<string, VendorView>;
};

export function ModelDetailsSources({ row, vendorsById }: ModelDetailsSourcesProps) {
  if (row.sources.length === 0) {
    return null;
  }
  return (
    <Flex direction="column" gap="2">
      <Text size="2" weight="medium">Sources</Text>
      <Flex direction="column" gap="3">
        {row.sources.map((source, index) => (
          <SourceItem
            key={`${source.sourceId}:${source.sourceModelId || source.definition?.vendorId || ""}:${source.definition?.modelId || ""}`}
            source={source}
            separated={index > 0}
            vendorsById={vendorsById}
          />
        ))}
      </Flex>
    </Flex>
  );
}

type SourceItemProps = {
  source: RegistryModelSource;
  separated: boolean;
  vendorsById: Record<string, VendorView>;
};

function SourceItem({ source, separated, vendorsById }: SourceItemProps) {
  const pricingSummary = formatSourcePricing(source.pricing);
  const pricingLines = formatPricingDetail(source.pricing);
  const priceTypeLabel = source.pricing?.priceType ? formatPriceType(source.pricing.priceType) : "";
  const definition = source.definition;
  const vendor = definition?.vendorId ? vendorsById[vendorLookupKey(definition.vendorId)] : undefined;
  const vendorLabel = vendor?.displayName || definition?.vendorId || "Unknown vendor";
  const definitionRef = definition?.vendorId && definition?.modelId
    ? `${definition.vendorId}/${definition.modelId}`
    : "";
  const sourceModelId = source.sourceModelId || definitionRef;

  return (
    <Flex direction="column" gap="2">
      {separated ? <Separator size="4" /> : null}
      <Flex align="center" gap="2" wrap="wrap">
        <VendorAvatar displayName={vendorLabel} iconUrl={vendor?.iconUrl} size="1" />
        <Text size="2">{vendorLabel}</Text>
        <SoftBadge size="1" color="gray" label={source.sourceId} />
        <SoftBadge
          size="1"
          color={source.isDirect ? "green" : "blue"}
          label={source.isDirect ? "Direct" : "Proxy"}
        />
        <SourceBadge badges={source.badges} />
        {priceTypeLabel ? (
          <SoftBadge size="1" color="gray" label={priceTypeLabel} />
        ) : null}
      </Flex>
      {sourceModelId ? (
        <Code size="1" variant="ghost">{sourceModelId}</Code>
      ) : (
        <Text size="2" color="gray">Missing source model id</Text>
      )}
      {definition?.displayName && definition.displayName !== sourceModelId && definition.displayName !== vendorLabel ? (
        <Text size="2">{definition.displayName}</Text>
      ) : null}
      {pricingLines.length > 0 ? (
        <Flex direction="column" gap="1">
          {pricingLines.map((line) => (
            <Text key={line.label} size="1" color="gray">
              {line.label}: {line.value}
            </Text>
          ))}
        </Flex>
      ) : (
        <Text size="1" color="gray">{pricingSummary || "No pricing"}</Text>
      )}
      {definitionRef && definitionRef !== sourceModelId ? (
        <Text size="1" color="gray">{definitionRef}</Text>
      ) : null}
    </Flex>
  );
}
