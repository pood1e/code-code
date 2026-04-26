import type { ModelDefinition } from "@code-code/agent-contract/model/v1";
import type { ModelRegistryEntry } from "@code-code/agent-contract/platform/model/v1";
import type { VendorView } from "@code-code/agent-contract/platform/provider/v1";
import type { CSSProperties } from "react";
import { memo, useCallback, useMemo, useState } from "react";
import { Box, Card, Code, Flex, Grid, Text } from "@radix-ui/themes";
import { NoDataCallout, SoftBadge } from "@code-code/console-web-ui";
import { formatSourcePricing } from "../source-pricing";
import { vendorLookupKey } from "../vendor-index";
import { CapabilityBadge } from "./capability-icon-badge";
import { EMPTY_VALUE, formatModality, formatShape } from "./model-detail-formatters";
import { formatTokenSize, getVendorLabel } from "./model-formatters";
import { ModelDetailsDialog } from "./model-details-dialog";
import { sourceOptionLabel } from "./model-table-filter-options";
import { SourceBadge } from "./source-badge";
import { VendorAvatar } from "./vendor-avatar";

type ModelCardListProps = {
  models: ModelRegistryEntry[];
  selectedSourceIds: string[];
  vendorsById: Record<string, VendorView>;
};

export function ModelCardList({ models, selectedSourceIds, vendorsById }: ModelCardListProps) {
  const [selectedModel, setSelectedModel] = useState<ModelRegistryEntry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const openModel = useCallback((model: ModelRegistryEntry) => {
    setSelectedModel(model);
    setDialogOpen(true);
  }, []);

  if (models.length === 0) {
    return <NoDataCallout>No models found.</NoDataCallout>;
  }

  return (
    <>
      <Grid columns={{ initial: "1", xs: "2", sm: "3" }} gap="3">
        {models.map((model) => (
          <ModelCard
            key={modelRowKey(model)}
            model={model}
            onOpen={openModel}
            selectedSourceIds={selectedSourceIds}
            vendorsById={vendorsById}
          />
        ))}
      </Grid>
      {selectedModel !== null && (
        <ModelDetailsDialog
          row={selectedModel}
          vendorsById={vendorsById}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      )}
    </>
  );
}

type ModelCardProps = {
  model: ModelRegistryEntry;
  onOpen: (model: ModelRegistryEntry) => void;
  selectedSourceIds: string[];
  vendorsById: Record<string, VendorView>;
};

const ModelCard = memo(function ModelCard({ model, onOpen, selectedSourceIds, vendorsById }: ModelCardProps) {
  const definition = model.definition as ModelDefinition;
  const vendor = vendorsById[vendorLookupKey(definition.vendorId)];
  const vendorLabel = vendor?.displayName || getVendorLabel(definition);
  const displayName = definition.displayName || definition.modelId;
  const showSeparateModelId = definition.displayName && definition.displayName !== definition.modelId;
  const pricingSummary = formatSourcePricing(model.pricing);
  const contextWindow = formatTokenSize(definition.contextWindowTokens);
  const matchedSourceIds = useMemo(() => {
    if (selectedSourceIds.length === 0) return [];
    return Array.from(new Set(
      model.sources
        .map((source) => source.sourceId)
        .filter((sourceId): sourceId is string => Boolean(sourceId && selectedSourceIds.includes(sourceId)))
    ));
  }, [model.sources, selectedSourceIds]);

  return (
    <Card asChild size="2" variant="surface">
      <button
        type="button"
        style={cardButtonStyle}
        aria-label={`Open details for ${displayName}`}
        onClick={() => onOpen(model)}
      >
        <Flex direction="column" gap="2">
          <Flex align="center" gap="1" style={{ minWidth: 0 }}>
            <VendorAvatar displayName={vendorLabel} iconUrl={vendor?.iconUrl} size="1" />
            <Text color="gray" size="1" truncate>{vendorLabel}</Text>
            <SourceBadge badges={model.badges} />
            {matchedSourceIds.map((sourceId) => (
              <SoftBadge key={sourceId} size="1" color="gray" label={sourceOptionLabel(sourceId)} />
            ))}
          </Flex>

          <Box style={{ minWidth: 0 }}>
            <Text as="div" size="2" weight="medium" truncate>{displayName}</Text>
            {showSeparateModelId ? (
              <Code size="1" variant="ghost" color="gray">{definition.modelId}</Code>
            ) : (
              <Text as="div" color="gray" size="1" truncate>{definition.modelId}</Text>
            )}
          </Box>

          <Flex align="center" gap="2" wrap="wrap">
            <SoftBadge color="gray" label={`Context ${contextWindow}`} size="1" />
            {pricingSummary ? (
              <SoftBadge color="gray" label={pricingSummary} size="1" />
            ) : null}
            <SoftBadge color="gray" label={formatShapeSummary(definition)} size="1" />
          </Flex>

          <Flex gap="1" wrap="wrap">
            {(definition.capabilities || []).map((capability) => (
              <CapabilityBadge key={capability} capability={capability} />
            ))}
            {(definition.capabilities || []).length === 0 ? (
              <Text color="gray" size="1">{formatModalitySummary(definition)}</Text>
            ) : null}
          </Flex>
        </Flex>
      </button>
    </Card>
  );
});

function formatShapeSummary(definition: ModelDefinition) {
  if (definition.primaryShape) {
    return formatShape(definition.primaryShape);
  }
  return EMPTY_VALUE;
}

function formatModalitySummary(definition: ModelDefinition) {
  const values = [...(definition.inputModalities || []), ...(definition.outputModalities || [])]
    .filter(Boolean)
    .map(formatModality);
  const unique = Array.from(new Set(values));
  return unique.length > 0 ? unique.join(" / ") : EMPTY_VALUE;
}

function modelRowKey(row: ModelRegistryEntry) {
  const definition = row.definition;
  return `${definition?.vendorId || "unknown"}:${definition?.modelId || "unknown"}`;
}

const cardButtonStyle: CSSProperties = {
  appearance: "none",
  border: 0,
  color: "inherit",
  cursor: "pointer",
  font: "inherit",
  height: "100%",
  textAlign: "left",
  width: "100%",
};
