import type { VendorView } from "@code-code/agent-contract/platform/provider/v1";
import { Badge, Button, Flex, Text } from "@radix-ui/themes";
import { CloseIcon } from "@code-code/console-web-ui";
import type { ModelAvailabilityFilter } from "../use-model-registry-state";
import { vendorLookupKey } from "../vendor-index";
import { sourceOptionLabel } from "./model-table-filter-options";

type ModelActiveFiltersProps = {
  availabilityFilter: ModelAvailabilityFilter;
  onAvailabilityClear: () => void;
  onClearAll: () => void;
  onSourceRemove: (id: string) => void;
  onVendorRemove: (id: string) => void;
  sourceIds: string[];
  vendorIds: string[];
  vendorsById: Record<string, VendorView>;
};

export function ModelActiveFilters({
  availabilityFilter,
  onAvailabilityClear,
  onClearAll,
  onSourceRemove,
  onVendorRemove,
  sourceIds,
  vendorIds,
  vendorsById,
}: ModelActiveFiltersProps) {
  const hasFilters = vendorIds.length > 0 || sourceIds.length > 0 || availabilityFilter !== "";
  if (!hasFilters) return null;

  return (
    <Flex align="center" gap="2" wrap="wrap" mb="3">
      <Text color="gray" size="1">Filters:</Text>
      {vendorIds.map((id) => {
        const label = vendorsById[vendorLookupKey(id)]?.displayName || id;
        return (
          <FilterChip key={id} label={label} onRemove={() => onVendorRemove(id)} />
        );
      })}
      {sourceIds.map((id) => (
        <FilterChip key={id} label={sourceOptionLabel(id)} onRemove={() => onSourceRemove(id)} />
      ))}
      {availabilityFilter !== "" ? (
        <FilterChip label="Free" onRemove={onAvailabilityClear} />
      ) : null}
      <Button color="gray" size="1" variant="ghost" onClick={onClearAll}>
        Clear all
      </Button>
    </Flex>
  );
}

type FilterChipProps = {
  label: string;
  onRemove: () => void;
};

function FilterChip({ label, onRemove }: FilterChipProps) {
  return (
    <Badge color="indigo" variant="soft" size="1" style={{ alignItems: "center", display: "inline-flex", gap: 4, paddingRight: 4 }}>
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter: ${label}`}
        style={{ alignItems: "center", background: "none", border: 0, color: "inherit", cursor: "pointer", display: "flex", padding: 0 }}
      >
        <CloseIcon />
      </button>
    </Badge>
  );
}
