import type { ModelRegistryEntry } from "@code-code/agent-contract/platform/model/v1";
import { Code, Flex, Text } from "@radix-ui/themes";
import { SoftBadge } from "@code-code/console-web-ui";
import {
  formatAlias,
  formatCategory,
  formatLifecycleStatus,
  lifecycleStatusColor,
} from "./model-detail-formatters";
import { formatDate } from "./model-formatters";
import { SourceBadge } from "./source-badge";
import { ModelDetailRow, ModelDetailsSection, ModelDetailText } from "./model-details-section";
import { formatSourcePricing } from "../source-pricing";

type ModelDetailsOverviewProps = {
  row: ModelRegistryEntry;
};

export function ModelDetailsOverview({ row }: ModelDetailsOverviewProps) {
  const model = row.definition;
  if (!model) return null;

  const releaseDate = formatDate(model.releaseDate);
  const trainingCutoff = formatDate(model.trainingCutoff);

  return (
    <Flex direction="column" gap="5">
      {model.description ? (
        <Text size="2" color="gray" style={{ whiteSpace: "pre-line" }}>
          {model.description}
        </Text>
      ) : null}

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
        {model.canonicalModelId ? (
          <ModelDetailRow label="Canonical ID">
            <Code size="1" variant="ghost">{model.canonicalModelId}</Code>
          </ModelDetailRow>
        ) : null}
        {model.familySlug ? (
          <ModelDetailRow label="Family">
            <ModelDetailText>{model.familySlug}</ModelDetailText>
          </ModelDetailRow>
        ) : null}
        {model.version ? (
          <ModelDetailRow label="Version">
            <ModelDetailText>{model.version}</ModelDetailText>
          </ModelDetailRow>
        ) : null}
        {model.category ? (
          <ModelDetailRow label="Category">
            <ModelDetailText>{formatCategory(model.category)}</ModelDetailText>
          </ModelDetailRow>
        ) : null}
        {model.lifecycleStatus ? (
          <ModelDetailRow label="Lifecycle">
            <SoftBadge
              color={lifecycleStatusColor(model.lifecycleStatus)}
              label={formatLifecycleStatus(model.lifecycleStatus)}
              size="1"
            />
          </ModelDetailRow>
        ) : null}
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
        {releaseDate ? (
          <ModelDetailRow label="Release Date">
            <ModelDetailText>{releaseDate}</ModelDetailText>
          </ModelDetailRow>
        ) : null}
        {trainingCutoff ? (
          <ModelDetailRow label="Training Cutoff">
            <ModelDetailText>{trainingCutoff}</ModelDetailText>
          </ModelDetailRow>
        ) : null}
        {model.licenseType ? (
          <ModelDetailRow label="License">
            <ModelDetailText>{model.licenseType}</ModelDetailText>
          </ModelDetailRow>
        ) : null}
        {model.isOpenWeights ? (
          <ModelDetailRow label="Open Weights">
            <ModelDetailText>Yes</ModelDetailText>
          </ModelDetailRow>
        ) : null}
      </ModelDetailsSection>
    </Flex>
  );
}

function AliasList({ row }: ModelDetailsOverviewProps) {
  const definition = row.definition;
  if (!definition || definition.aliases.length === 0) {
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
