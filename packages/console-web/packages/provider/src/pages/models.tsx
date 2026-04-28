import { useMemo, useState } from "react";
import { AsyncState, GridIcon, ListIcon } from "@code-code/console-web-ui";
import { Box, Flex, Heading, IconButton, Text } from "@radix-ui/themes";
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
  const resultCount = state.models.totalCount > 0 ? state.models.totalCount : state.models.models.length;
  const hasActiveFilters = useMemo(
    () => state.vendorIds.length > 0 || state.sourceIds.length > 0 || state.availabilityFilter !== "" || state.selectedCategory !== "",
    [state.vendorIds, state.sourceIds, state.availabilityFilter, state.selectedCategory]
  );

  return (
    <Flex direction="column" gap="5">
      <Flex justify="between" align="end" gap="4" wrap="wrap">
        <Flex direction="column" gap="1">
          <Heading size="5" weight="medium">Model catalog</Heading>
          <Text color="gray" size="2">
            {state.models.isLoading
              ? "Loading…"
              : `${resultCount} model${resultCount === 1 ? "" : "s"}`}
          </Text>
        </Flex>
        <Flex align="center" gap="2" style={{ flex: "1 1 360px", maxWidth: 596, minWidth: 280 }}>
          <Box style={{ flex: 1, minWidth: 0 }}>
            <ModelSearchField value={state.modelQuery} onChange={state.handleModelQueryChange} />
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
        <CategoryChipBar
          selected={state.selectedCategory}
          onChange={state.handleCategoryChange}
        />
        <LifecycleToggle
          hideDeprecated={state.hideDeprecated}
          onChange={state.handleLifecycleToggle}
        />
      </Flex>

      <Flex align="start" gap="5" wrap="wrap">
        <Box display={{ initial: "none", sm: "block" }} style={{ flex: "0 1 280px", minWidth: 240, width: "100%" }}>
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
            vendors={state.vendors.vendors}
            vendorsLoading={state.vendors.isLoading}
          />
        </Box>

        <Box style={{ flex: "1 1 640px", minWidth: 0 }}>
          <ModelActiveFilters
            availabilityFilter={state.availabilityFilter}
            onAvailabilityClear={() => state.handleAvailabilityChange("")}
            onClearAll={state.handleClearAllFilters}
            onSourceRemove={state.handleSourceToggle}
            onVendorRemove={state.handleVendorToggle}
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
