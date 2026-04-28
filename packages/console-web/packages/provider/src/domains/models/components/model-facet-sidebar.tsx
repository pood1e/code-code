import type { VendorView } from "@code-code/agent-contract/platform/provider/v1";
import type { CSSProperties, ReactNode } from "react";
import { useMemo } from "react";
import { Badge, Box, Button, Checkbox, Flex, Heading, ScrollArea, Text } from "@radix-ui/themes";
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
  sticky?: boolean;
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
  sticky = true,
  vendors,
  vendorsLoading,
}: ModelFacetSidebarProps) {
  const vendorOptions = useMemo(() => buildVendorOptions(vendors), [vendors]);
  const sourceOptions = useMemo(buildSourceOptions, []);

  return (
    <Flex direction="column" gap="4" style={sticky ? { ...facetShellStyle, ...stickyFacetStyle } : facetShellStyle}>
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
                  <Flex align="center" gap="1" key={option.value} style={facetOptionWrapStyle}>
                    <label style={selected ? selectedFacetOptionStyle : facetOptionStyle}>
                      <Checkbox
                        checked={selected}
                        onCheckedChange={() => onVendorToggle(option.value)}
                        size="1"
                      />
                      <VendorAvatar displayName={option.label} iconUrl={option.iconUrl} size="1" />
                      <Text as="div" size="2" truncate style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                        {option.label}
                      </Text>
                    </label>
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
        title="Services"
        summary={selectedSourceIds.length === 0 ? "All" : `${selectedSourceIds.length} selected`}
        onClear={onSourceClear}
        clearDisabled={selectedSourceIds.length === 0}
      >
        <Flex direction="column" gap="1">
          {sourceOptions.map((option) => {
            const selected = selectedSourceIds.includes(option.value);
            return (
              <label
                key={option.value}
                style={selected ? selectedFacetOptionStyle : facetOptionStyle}
              >
                <Checkbox
                  checked={selected}
                  onCheckedChange={() => onSourceToggle(option.value)}
                  size="1"
                />
                <Text size="2">{option.label}</Text>
              </label>
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
        <label style={availabilityFilter === SOURCE_BADGE_FREE ? selectedFacetOptionStyle : facetOptionStyle}>
          <Checkbox
            checked={availabilityFilter === SOURCE_BADGE_FREE}
            onCheckedChange={(checked) => onAvailabilityChange(checked === true ? SOURCE_BADGE_FREE : "")}
            size="1"
          />
          <SoftBadge color="green" highContrast={false} label="Free" size="1" />
        </label>
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
    <Flex direction="column" gap="2">
      <Flex align="center" justify="between" gap="3">
        <Flex align="center" gap="2" minWidth="0">
          <Heading as="h2" size="2" weight="medium">{title}</Heading>
          <Badge color={summary === "All" ? "gray" : "teal"} size="1" variant="soft">{summary}</Badge>
        </Flex>
        <Button color="gray" disabled={clearDisabled} onClick={onClear} size="1" variant="ghost">
          Clear
        </Button>
      </Flex>
      {children}
    </Flex>
  );
}

const facetShellStyle: CSSProperties = {
  backgroundColor: "var(--gray-a2)",
  border: "1px solid var(--gray-a4)",
  borderRadius: "var(--radius-3)",
  padding: "var(--space-3)",
};

const facetOptionWrapStyle: CSSProperties = {
  minWidth: 0,
  width: "100%",
};

const facetOptionStyle: CSSProperties = {
  alignItems: "center",
  borderRadius: "var(--radius-2)",
  color: "var(--gray-12)",
  cursor: "pointer",
  display: "flex",
  flex: 1,
  gap: "var(--space-2)",
  minHeight: 44,
  minWidth: 0,
  padding: "0 var(--space-2)",
  width: "100%",
};

const selectedFacetOptionStyle: CSSProperties = {
  ...facetOptionStyle,
  backgroundColor: "var(--teal-a3)",
  color: "var(--teal-12)",
};

const stickyFacetStyle: CSSProperties = {
  position: "sticky",
  top: "var(--space-4)",
};
