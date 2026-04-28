import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_MODEL_PAGE_SIZE, useModels, useVendors } from "./api";
import { buildStructuredFilter, toggleSelected } from "./model-filter";
import { SOURCE_BADGE_FREE } from "./source-badges";
import { buildVendorIndex } from "./vendor-index";

const FIRST_PAGE_TOKENS = [""];
const SEARCH_DEBOUNCE_MS = 300;
export type ModelAvailabilityFilter = "" | typeof SOURCE_BADGE_FREE;

export function useModelRegistryState() {
  const [vendorIds, setVendorIds] = useState<string[]>([]);
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [availabilityFilter, setAvailabilityFilter] = useState<ModelAvailabilityFilter>("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [hideDeprecated, setHideDeprecated] = useState(true);
  const [modelQuery, setModelQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageTokens, setPageTokens] = useState(FIRST_PAGE_TOKENS);

  useEffect(() => () => {
    if (debounceTimer.current !== undefined) {
      clearTimeout(debounceTimer.current);
    }
  }, []);

  const vendors = useVendors();
  const models = useModels({
    structuredFilter: buildStructuredFilter(vendorIds, debouncedQuery, sourceIds, availabilityFilter, selectedCategory, hideDeprecated),
    pageSize: DEFAULT_MODEL_PAGE_SIZE,
    pageToken: pageTokens[pageIndex]
  });
  const totalPages = useMemo(
    () => estimateTotalPages(models.totalCount, models.nextPageToken, pageIndex),
    [models.totalCount, models.nextPageToken, pageIndex]
  );

  const resetPagination = useCallback(() => {
    setPageIndex(0);
    setPageTokens(FIRST_PAGE_TOKENS);
  }, []);
  const handleNextPage = useCallback(() => {
    if (!models.nextPageToken) {
      return;
    }
    setPageTokens((current) => [...current.slice(0, pageIndex + 1), models.nextPageToken]);
    setPageIndex((current) => current + 1);
  }, [models.nextPageToken, pageIndex]);
  const handleModelQueryChange = useCallback(
    (value: string) => {
      setModelQuery(value);
      if (debounceTimer.current !== undefined) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        setDebouncedQuery(value);
        resetPagination();
      }, SEARCH_DEBOUNCE_MS);
    },
    [resetPagination]
  );
  const handleModelQueryClear = useCallback(() => {
    if (debounceTimer.current !== undefined) {
      clearTimeout(debounceTimer.current);
    }
    setModelQuery("");
    setDebouncedQuery("");
    resetPagination();
  }, [resetPagination]);
  const handleVendorToggle = useCallback((value: string) => {
    setVendorIds((current) => toggleSelected(current, value));
    resetPagination();
  }, [resetPagination]);
  const handleVendorClear = useCallback(() => {
    setVendorIds([]);
    resetPagination();
  }, [resetPagination]);
  const handleVendorSetOnly = useCallback((value: string) => {
    setVendorIds([value]);
    resetPagination();
  }, [resetPagination]);
  const handleSourceToggle = useCallback((value: string) => {
    setSourceIds((current) => toggleSelected(current, value));
    resetPagination();
  }, [resetPagination]);
  const handleSourceClear = useCallback(() => {
    setSourceIds([]);
    resetPagination();
  }, [resetPagination]);
  const handleAvailabilityChange = useCallback((value: ModelAvailabilityFilter) => {
    setAvailabilityFilter(value);
    resetPagination();
  }, [resetPagination]);
  const handleCategoryChange = useCallback((value: string) => {
    setSelectedCategory(value);
    resetPagination();
  }, [resetPagination]);
  const handleLifecycleToggle = useCallback((value: boolean) => {
    setHideDeprecated(value);
    resetPagination();
  }, [resetPagination]);
  const handleClearAllFilters = useCallback(() => {
    setVendorIds([]);
    setSourceIds([]);
    setAvailabilityFilter("");
    setSelectedCategory("");
    setModelQuery("");
    setDebouncedQuery("");
    if (debounceTimer.current !== undefined) {
      clearTimeout(debounceTimer.current);
    }
    resetPagination();
  }, [resetPagination]);
  const vendorsById = useMemo(() => buildVendorIndex(vendors.vendors), [vendors.vendors]);
  return {
    availabilityFilter,
    handleAvailabilityChange,
    handleCategoryChange,
    handleLifecycleToggle,
    handleModelQueryClear,
    handleModelQueryChange,
    handleNextPage,
    handleSourceClear,
    handleSourceToggle,
    handleClearAllFilters,
    handleVendorClear,
    handleVendorSetOnly,
    handleVendorToggle,
    hideDeprecated,
    modelQuery,
    models,
    pageIndex,
    selectedCategory,
    sourceIds,
    totalPages,
    setPageIndex,
    vendorIds,
    vendorsById,
    vendors
  };
}

function estimateTotalPages(totalCount: number, nextPageToken: string, pageIndex: number) {
  if (totalCount > 0) {
    return Math.max(1, Math.ceil(totalCount / DEFAULT_MODEL_PAGE_SIZE));
  }
  if (nextPageToken) {
    return pageIndex + 2;
  }
  return 0;
}
