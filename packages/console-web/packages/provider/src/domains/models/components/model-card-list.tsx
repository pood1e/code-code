import type { ModelVersion } from "@code-code/agent-contract/model/v1";
import type { ModelRegistryEntry } from "@code-code/agent-contract/platform/model/v1";
import type { VendorView } from "@code-code/agent-contract/platform/provider/v1";
import type { CSSProperties } from "react";
import { memo, useCallback, useMemo, useState } from "react";
import { Box, Button, Card, Code, Flex, Grid, Text } from "@radix-ui/themes";
import { NoDataCallout, SoftBadge } from "@code-code/console-web-ui";
import { formatSourcePricing } from "../source-pricing";
import { vendorLookupKey } from "../vendor-index";
import { CapabilityBadge } from "./capability-icon-badge";
import { CategoryBadge } from "./category-badge";
import { formatShape } from "./model-detail-formatters";
import { formatTokenSize, getVendorLabel } from "./model-formatters";
import { LifecycleBadge } from "./lifecycle-badge";
import { ModelDetailsDialog } from "./model-details-dialog";
import { sourceOptionLabel } from "./model-table-filter-options";
import { SourceBadge } from "./source-badge";
import { VendorAvatar } from "./vendor-avatar";

type ModelCardListProps = {
  models: ModelRegistryEntry[];
  selectedSourceIds: string[];
  vendorsById: Record<string, VendorView>;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
};

export function ModelCardList({ models, selectedSourceIds, vendorsById, hasActiveFilters, onClearFilters }: ModelCardListProps) {
  const [selectedModel, setSelectedModel] = useState<ModelRegistryEntry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const openModel = useCallback((model: ModelRegistryEntry) => {
    setSelectedModel(model);
    setDialogOpen(true);
  }, []);

  if (models.length === 0) {
    return (
      <NoDataCallout>
        {hasActiveFilters
          ? "No models match your current filters."
          : "No models found."}
        {hasActiveFilters && onClearFilters ? (
          <Box mt="2">
            <Button size="1" variant="soft" color="gray" onClick={onClearFilters}>
              Clear all filters
            </Button>
          </Box>
        ) : null}
      </NoDataCallout>
    );
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
  const definition = model.definition;
  if (!definition) return null;
  const vendor = vendorsById[vendorLookupKey(definition.vendorId)];
  const vendorLabel = vendor?.displayName || getVendorLabel(definition);
  const displayName = definition.displayName || definition.modelId;
  const showSeparateModelId = definition.displayName && definition.displayName !== definition.modelId;
  const pricingSummary = formatSourcePricing(model.pricing);
  const contextWindow = formatTokenSize(definition.contextSpec?.maxContextTokens);
  const shapeSummary = formatShapeSummary(definition);
  const matchedSourceIds = useMemo(() => {
    if (selectedSourceIds.length === 0) return [];
    return Array.from(new Set(
      model.sources
        .map((source) => source.sourceId)
        .filter((sourceId): sourceId is string => Boolean(sourceId && selectedSourceIds.includes(sourceId)))
    ));
  }, [model.sources, selectedSourceIds]);

  const metadataBadges: { key: string; label: string }[] = [];
  if (contextWindow !== "Unknown") {
    metadataBadges.push({ key: "ctx", label: `Context ${contextWindow}` });
  }
  if (shapeSummary) {
    metadataBadges.push({ key: "shape", label: shapeSummary });
  }

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
            <LifecycleBadge status={definition.lifecycleStatus} />
            <CategoryBadge category={definition.category} />
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
            {definition.description ? (
              <Text as="div" color="gray" size="1" truncate style={{ marginTop: 2 }}>
                {definition.description}
              </Text>
            ) : null}
          </Box>

          {(metadataBadges.length > 0 || pricingSummary) ? (
            <Flex align="center" gap="2" wrap="wrap">
              {metadataBadges.map((badge) => (
                <SoftBadge key={badge.key} color="gray" label={badge.label} size="1" />
              ))}
              {pricingSummary ? (
                <Text color="gray" size="1" truncate style={{ maxWidth: "100%" }}>
                  {pricingSummary}
                </Text>
              ) : null}
            </Flex>
          ) : null}

          {(definition.capabilities || []).length > 0 ? (
            <Flex gap="1" wrap="wrap">
              {definition.capabilities.map((capability) => (
                <CapabilityBadge key={capability} capability={capability} />
              ))}
            </Flex>
          ) : null}
        </Flex>
      </button>
    </Card>
  );
});

function formatShapeSummary(definition: ModelVersion): string {
  if (definition.primaryShape) {
    return formatShape(definition.primaryShape);
  }
  return "";
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
