import { useMemo, useState } from "react";
import { AsyncState, FilterIcon, GridIcon, ListIcon } from "@code-code/console-web-ui";
import { Badge, Box, Button, Dialog, Flex, Heading, IconButton, Text } from "@radix-ui/themes";
import { CategoryChipBar } from "../domains/models/components/category-chip-bar";
import { LifecycleToggle } from "../domains/models/components/lifecycle-toggle";
import { ModelActiveFilters } from "../domains/models/components/model-active-filters";
import { ModelCardList } from "../domains/models/components/model-card-list";
import { ModelFacetSidebar } from "../domains/models/components/model-facet-sidebar";
import { ModelSearchField } from "../domains/models/components/model-search-field";
import { ModelsPagination } from "../domains/models/components/models-pagination";
import { ModelsTable } from "../domains/models/components/models-table";
import { useModelRegistryState } from "../domains/models/use-model-registry-state";

export function ModelsPage() {
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const state = useModelRegistryState();
  const loadedCount = state.models.models.length;
  const resultCount = state.models.totalCount > 0 ? state.models.totalCount : loadedCount;
  const activeFilterCount = useMemo(() => {
    let count = state.vendorIds.length + state.sourceIds.length;
    if (state.availabilityFilter !== "") count += 1;
    if (state.selectedCategory !== "") count += 1;
    if (state.modelQuery.trim() !== "") count += 1;
    return count;
  }, [state.vendorIds, state.sourceIds, state.availabilityFilter, state.selectedCategory, state.modelQuery]);
  const hasActiveFilters = activeFilterCount > 0;
  const resultSummary = state.models.isLoading
    ? "Loading model registry..."
    : state.models.totalCount > 0
      ? `Showing ${loadedCount} of ${resultCount} models`
      : `${resultCount} model${resultCount === 1 ? "" : "s"}`;

  return (
    <Flex direction="column" gap="5">
      <Flex justify="between" align="end" gap="4" wrap="wrap">
        <Flex direction="column" gap="1">
          <Heading size="5" weight="medium">Model catalog</Heading>
          <Text color="gray" size="2">{resultSummary}</Text>
        </Flex>
        <Flex align="center" gap="2" wrap="wrap" style={{ flex: "1 1 420px", maxWidth: 720, minWidth: 280 }}>
          <Box style={{ flex: 1, minWidth: 0 }}>
            <ModelSearchField value={state.modelQuery} onChange={state.handleModelQueryChange} />
          </Box>
          <Box display={{ initial: "block", sm: "none" }}>
            <MobileFiltersDialog activeFilterCount={activeFilterCount} state={state} />
          </Box>
          <Flex gap="1" style={{ flexShrink: 0 }}>
            <IconButton
              variant={viewMode === "grid" ? "soft" : "ghost"}
              color="gray"
              size="2"
              aria-label="Grid view"
              onClick={() => setViewMode("grid")}
            >
              <GridIcon />
            </IconButton>
            <IconButton
              variant={viewMode === "table" ? "soft" : "ghost"}
              color="gray"
              size="2"
              aria-label="Table view"
              onClick={() => setViewMode("table")}
            >
              <ListIcon />
            </IconButton>
          </Flex>
        </Flex>
      </Flex>

      <Flex align="center" justify="between" gap="3" wrap="wrap">
        <Box style={{ flex: "1 1 520px", minWidth: 0 }}>
          <CategoryChipBar
            selected={state.selectedCategory}
            onChange={state.handleCategoryChange}
          />
        </Box>
        <LifecycleToggle
          hideDeprecated={state.hideDeprecated}
          onChange={state.handleLifecycleToggle}
        />
      </Flex>

      <Flex align="start" gap="5" wrap="wrap">
        <Box display={{ initial: "none", sm: "block" }} style={{ flex: "0 0 280px", minWidth: 240 }}>
          <ModelFacetControls state={state} />
        </Box>

        <Box style={{ flex: "1 1 640px", minWidth: 0 }}>
          <ModelActiveFilters
            availabilityFilter={state.availabilityFilter}
            onAvailabilityClear={() => state.handleAvailabilityChange("")}
            onCategoryClear={() => state.handleCategoryChange("")}
            onClearAll={state.handleClearAllFilters}
            onModelQueryClear={state.handleModelQueryClear}
            onSourceRemove={state.handleSourceToggle}
            onVendorRemove={state.handleVendorToggle}
            modelQuery={state.modelQuery}
            selectedCategory={state.selectedCategory}
            sourceIds={state.sourceIds}
            vendorIds={state.vendorIds}
            vendorsById={state.vendorsById}
          />
          <AsyncState
            loading={state.models.isLoading}
            error={state.models.error}
            errorTitle="Failed to load models from the API."
            onRetry={() => void state.models.mutate()}
          >
            {viewMode === "grid" ? (
              <ModelCardList
                models={state.models.models}
                selectedSourceIds={state.sourceIds}
                vendorsById={state.vendorsById}
                hasActiveFilters={hasActiveFilters}
                onClearFilters={state.handleClearAllFilters}
              />
            ) : (
              <ModelsTable
                models={state.models.models}
                selectedSourceIds={state.sourceIds}
                vendorsById={state.vendorsById}
                hasActiveFilters={hasActiveFilters}
                onClearFilters={state.handleClearAllFilters}
              />
            )}
            <ModelsPagination
              page={state.pageIndex + 1}
              totalPages={state.totalPages}
              hasPreviousPage={state.pageIndex > 0}
              hasNextPage={state.models.nextPageToken !== ""}
              onPrevious={() => state.setPageIndex((current) => Math.max(current - 1, 0))}
              onNext={state.handleNextPage}
            />
          </AsyncState>
        </Box>
      </Flex>
    </Flex>
  );
}

type ModelRegistryState = ReturnType<typeof useModelRegistryState>;

function MobileFiltersDialog({
  activeFilterCount,
  state,
}: {
  activeFilterCount: number;
  state: ModelRegistryState;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger>
        <Button color="gray" size="2" variant={activeFilterCount > 0 ? "soft" : "outline"}>
          <FilterIcon />
          Filters
          {activeFilterCount > 0 ? (
            <Badge color="teal" size="1" variant="solid">{activeFilterCount}</Badge>
          ) : null}
        </Button>
      </Dialog.Trigger>
      <Dialog.Content maxWidth="420px">
        <Dialog.Title>Filters</Dialog.Title>
        <Dialog.Description color="gray" size="2">
          Narrow models by vendor, service, and availability.
        </Dialog.Description>
        <Box mt="4">
          <ModelFacetControls state={state} sticky={false} />
        </Box>
      </Dialog.Content>
    </Dialog.Root>
  );
}

function ModelFacetControls({
  state,
  sticky,
}: {
  state: ModelRegistryState;
  sticky?: boolean;
}) {
  return (
    <ModelFacetSidebar
      availabilityFilter={state.availabilityFilter}
      onAvailabilityChange={state.handleAvailabilityChange}
      onSourceClear={state.handleSourceClear}
      onSourceToggle={state.handleSourceToggle}
      onVendorClear={state.handleVendorClear}
      onVendorSetOnly={state.handleVendorSetOnly}
      onVendorToggle={state.handleVendorToggle}
      selectedSourceIds={state.sourceIds}
      selectedVendorIds={state.vendorIds}
      sticky={sticky}
      vendors={state.vendors.vendors}
      vendorsLoading={state.vendors.isLoading}
    />
  );
}
