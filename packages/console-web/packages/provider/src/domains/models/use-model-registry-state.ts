import { useCallback, useMemo, useRef, useState } from "react";
import { DEFAULT_MODEL_PAGE_SIZE, useModels, useVendors } from "./api";
import { buildDirectFilter, buildRelatedBatchFilter, toggleSelected } from "./model-filter";
import { groupProxyModels } from "./proxy-model-groups";
import { SOURCE_BADGE_FREE } from "./source-badges";
import { buildVendorIndex } from "./vendor-index";

const FIRST_PAGE_TOKENS = [""];
const SEARCH_DEBOUNCE_MS = 300;
const AGGREGATED_PROXY_PAGE_SIZE = 100;
export type ModelAvailabilityFilter = "" | typeof SOURCE_BADGE_FREE;

export function useModelRegistryState() {
  const [vendorIds, setVendorIds] = useState<string[]>([]);
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [availabilityFilter, setAvailabilityFilter] = useState<ModelAvailabilityFilter>("");
  const [modelQuery, setModelQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageTokens, setPageTokens] = useState(FIRST_PAGE_TOKENS);

  const vendors = useVendors();
  const models = useModels({
    filter: buildDirectFilter(vendorIds, debouncedQuery, sourceIds, availabilityFilter),
    pageSize: DEFAULT_MODEL_PAGE_SIZE,
    pageToken: pageTokens[pageIndex]
  });
  const relatedProxyModels = useModels({
    filter: buildRelatedBatchFilter(
      models.models.map((row) => ({
        vendorId: row.definition?.vendorId,
        modelId: row.definition?.modelId,
      }))
    ),
    pageSize: AGGREGATED_PROXY_PAGE_SIZE,
  }, models.models.length > 0);
  const proxyGroups = useMemo(
    () => groupProxyModels(models.models, relatedProxyModels.models),
    [models.models, relatedProxyModels.models]
  );
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
  const handleClearAllFilters = useCallback(() => {
    setVendorIds([]);
    setSourceIds([]);
    setAvailabilityFilter("");
    resetPagination();
  }, [resetPagination]);
  const vendorsById = useMemo(() => buildVendorIndex(vendors.vendors), [vendors.vendors]);
  return {
    availabilityFilter,
    handleAvailabilityChange,
    handleModelQueryChange,
    handleNextPage,
    handleSourceClear,
    handleSourceToggle,
    handleClearAllFilters,
    handleVendorClear,
    handleVendorSetOnly,
    handleVendorToggle,
    modelQuery,
    models,
    pageIndex,
    proxyGroups,
    proxyModels: relatedProxyModels,
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
