import type { VendorView } from "@code-code/agent-contract/platform/provider/v1";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { Box, Button, Flex, Heading, ScrollArea, Separator, Text } from "@radix-ui/themes";
import { SoftBadge } from "@code-code/console-web-ui";
import { SOURCE_BADGE_FREE } from "../source-badges";
import type { ModelAvailabilityFilter } from "../use-model-registry-state";
import { buildSourceOptions, buildVendorOptions } from "./model-table-filter-options";
import { VendorAvatar } from "./vendor-avatar";

type ModelFacetSidebarProps = {
  availabilityFilter: ModelAvailabilityFilter;
  onAvailabilityChange: (value: ModelAvailabilityFilter) => void;
  onSourceClear: () => void;
  onSourceToggle: (value: string) => void;
  onVendorClear: () => void;
  onVendorSetOnly: (value: string) => void;
  onVendorToggle: (value: string) => void;
  selectedSourceIds: string[];
  selectedVendorIds: string[];
  vendors: VendorView[];
  vendorsLoading?: boolean;
};

export function ModelFacetSidebar({
  availabilityFilter,
  onAvailabilityChange,
  onSourceClear,
  onSourceToggle,
  onVendorClear,
  onVendorSetOnly,
  onVendorToggle,
  selectedSourceIds,
  selectedVendorIds,
  vendors,
  vendorsLoading,
}: ModelFacetSidebarProps) {
  const vendorOptions = useMemo(() => buildVendorOptions(vendors), [vendors]);
  const sourceOptions = useMemo(buildSourceOptions, []);

  return (
    <Flex direction="column" gap="5" style={{ position: "sticky", top: "var(--space-4)" }}>
      <FacetSection
        title="Vendors"
        summary={selectedVendorIds.length === 0 ? "All" : `${selectedVendorIds.length} selected`}
        onClear={onVendorClear}
        clearDisabled={selectedVendorIds.length === 0}
      >
        {vendorsLoading && vendorOptions.length === 0 ? (
          <Text color="gray" size="2">Loading…</Text>
        ) : vendorOptions.length === 0 ? (
          <Text color="gray" size="2">No vendors loaded.</Text>
        ) : (
          <ScrollArea scrollbars="vertical" type="auto" style={{ maxHeight: 320 }}>
            <Flex direction="column" gap="1" pr="2">
              {vendorOptions.map((option) => {
                const selected = selectedVendorIds.includes(option.value);
                return (
                  <Flex align="center" gap="1" key={option.value}>
                    <Button
                      aria-pressed={selected}
                      color="gray"
                      onClick={() => onVendorToggle(option.value)}
                      size="2"
                      style={vendorButtonStyle}
                      variant={selected ? "soft" : "ghost"}
                    >
                      <VendorAvatar displayName={option.label} iconUrl={option.iconUrl} size="1" />
                      <Text as="div" size="2" truncate style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                        {option.label}
                      </Text>
                    </Button>
                    <Button color="gray" onClick={() => onVendorSetOnly(option.value)} size="1" variant="ghost">
                      Only
                    </Button>
                  </Flex>
                );
              })}
            </Flex>
          </ScrollArea>
        )}
      </FacetSection>

      <FacetSection
        title="Sources"
        summary={selectedSourceIds.length === 0 ? "All" : `${selectedSourceIds.length} selected`}
        onClear={onSourceClear}
        clearDisabled={selectedSourceIds.length === 0}
      >
        <Flex direction="column" gap="1">
          {sourceOptions.map((option) => {
            const selected = selectedSourceIds.includes(option.value);
            return (
              <Button
                aria-pressed={selected}
                color="gray"
                key={option.value}
                onClick={() => onSourceToggle(option.value)}
                size="2"
                style={facetButtonStyle}
                variant={selected ? "soft" : "ghost"}
              >
                <Text size="2">{option.label}</Text>
              </Button>
            );
          })}
        </Flex>
      </FacetSection>

      <FacetSection
        title="Availability"
        summary={availabilityFilter === SOURCE_BADGE_FREE ? "Free only" : "All"}
        onClear={() => onAvailabilityChange("")}
        clearDisabled={availabilityFilter === ""}
      >
        <Button
          aria-pressed={availabilityFilter === SOURCE_BADGE_FREE}
          color="gray"
          onClick={() => onAvailabilityChange(availabilityFilter === SOURCE_BADGE_FREE ? "" : SOURCE_BADGE_FREE)}
          size="2"
          style={facetButtonStyle}
          variant={availabilityFilter === SOURCE_BADGE_FREE ? "soft" : "ghost"}
        >
          <SoftBadge color="green" highContrast={false} label="Free" size="1" />
        </Button>
      </FacetSection>
    </Flex>
  );
}

type FacetSectionProps = {
  children: ReactNode;
  clearDisabled: boolean;
  onClear: () => void;
  summary: string;
  title: string;
};

function FacetSection({ children, clearDisabled, onClear, summary, title }: FacetSectionProps) {
  return (
    <Flex direction="column" gap="3">
      <Flex align="center" justify="between" gap="3">
        <Box>
          <Heading as="h2" size="2" weight="medium">{title}</Heading>
          <Text color="gray" size="1">{summary}</Text>
        </Box>
        <Button color="gray" disabled={clearDisabled} onClick={onClear} size="1" variant="ghost">
          Clear
        </Button>
      </Flex>
      <Separator size="4" />
      {children}
    </Flex>
  );
}

const facetButtonStyle = {
  justifyContent: "start",
  minHeight: 44,
  width: "100%",
};

const vendorButtonStyle = {
  flex: 1,
  justifyContent: "start",
  minHeight: 44,
  minWidth: 0,
};
