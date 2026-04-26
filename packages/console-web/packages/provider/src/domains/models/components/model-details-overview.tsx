import type { ModelDefinition } from "@code-code/agent-contract/model/v1";
import type { ModelRegistryEntry } from "@code-code/agent-contract/platform/model/v1";
import { Code, Flex, Text } from "@radix-ui/themes";
import { formatAlias } from "./model-detail-formatters";
import { SourceBadge } from "./source-badge";
import { ModelDetailRow, ModelDetailsSection, ModelDetailText } from "./model-details-section";
import { formatSourcePricing } from "../source-pricing";

type ModelDetailsOverviewProps = {
  row: ModelRegistryEntry;
};

export function ModelDetailsOverview({ row }: ModelDetailsOverviewProps) {
  const model = row.definition as ModelDefinition;

  return (
    <ModelDetailsSection title="Identity">
      <ModelDetailRow label="Display name">
        <ModelDetailText>{model.displayName}</ModelDetailText>
      </ModelDetailRow>
      <ModelDetailRow label="Model ID">
        <Code size="1" variant="ghost">{model.modelId}</Code>
      </ModelDetailRow>
      <ModelDetailRow label="Vendor ID">
        <ModelDetailText>{model.vendorId}</ModelDetailText>
      </ModelDetailRow>
      <ModelDetailRow label="Source Ref">
        <SourceRefRow row={row} />
      </ModelDetailRow>
      <ModelDetailRow label="Tags">
        <SourceBadge badges={row.badges} />
      </ModelDetailRow>
      <ModelDetailRow label="Pricing">
        <ModelDetailText>{formatSourcePricing(row.pricing) || "Not set"}</ModelDetailText>
      </ModelDetailRow>
      <ModelDetailRow label="Aliases">
        <AliasList row={row} />
      </ModelDetailRow>
    </ModelDetailsSection>
  );
}

function AliasList({ row }: ModelDetailsOverviewProps) {
  const definition = row.definition as ModelDefinition;
  if (definition.aliases.length === 0) {
    return <Text size="2" color="gray">Not set</Text>;
  }
  return (
    <Flex gap="1" wrap="wrap">
      {definition.aliases.map((alias) => (
        <Code key={`${alias.kind}:${alias.value}`} size="1" variant="ghost">
          {formatAlias(alias)}
        </Code>
      ))}
    </Flex>
  );
}

function SourceRefRow({ row }: ModelDetailsOverviewProps) {
  if (!row.sourceRef?.vendorId || !row.sourceRef?.modelId) {
    return <Text size="2" color="gray">Not set</Text>;
  }
  return (
    <Code size="1" variant="ghost">{`${row.sourceRef.vendorId}/${row.sourceRef.modelId}`}</Code>
  );
}
