import type { VendorView } from "@code-code/agent-contract/platform/provider/v1";
import { useState } from "react";
import { Button, Flex, Popover, ScrollArea, Separator, Text } from "@radix-ui/themes";
import { FilterIcon, SearchTextField, SoftBadge } from "@code-code/console-web-ui";
import { buildVendorOptions } from "./model-table-filter-options";
import { VendorAvatar } from "./vendor-avatar";

type VendorHeaderFilterProps = {
  onClear: () => void;
  onSetOnly: (value: string) => void;
  onToggle: (value: string) => void;
  selectedValues: string[];
  vendors: VendorView[];
};

export function VendorHeaderFilter(props: VendorHeaderFilterProps) {
  const [query, setQuery] = useState("");
  const options = buildVendorOptions(props.vendors).filter((option) => matchesVendorQuery(option, query));
  const selectionLabel = vendorSelectionLabel(props.selectedValues.length);

  return (
    <Popover.Root>
      <Popover.Trigger>
        <Button aria-label="Filter Vendor" color="gray" size="2" variant="soft">
          <FilterIcon />
          Vendors
          <SoftBadge color="gray" highContrast={false} label={selectionLabel} />
        </Button>
      </Popover.Trigger>
      <Popover.Content size="2" style={{ padding: "12px", width: "360px" }}>
        <Flex direction="column" gap="3">
          <SearchTextField
            aria-label="Search vendors"
            placeholder="Search vendors"
            size="2"
            value={query}
            onValueChange={setQuery}
          />
          <Flex align="center" justify="between" gap="3">
            <Text color="gray" size="1">
              {props.selectedValues.length === 0 ? "All vendors" : `${props.selectedValues.length} selected`}
            </Text>
            <Flex gap="2">
              <Button
                color="gray"
                onClick={props.onClear}
                size="1"
                variant={props.selectedValues.length === 0 ? "solid" : "soft"}
              >
                All
              </Button>
            </Flex>
          </Flex>
          <Separator size="4" />
          <ScrollArea scrollbars="vertical" style={{ maxHeight: "320px" }} type="auto">
            <Flex direction="column" gap="2" pr="2">
              {options.length === 0 ? (
                <Text color="gray" size="2">
                  No vendors matched this query.
                </Text>
              ) : (
                options.map((option) => {
                  const selected = props.selectedValues.includes(option.value);
                  return (
                    <Flex align="center" gap="2" justify="between" key={option.value}>
                      <Button
                        color="gray"
                        onClick={() => props.onToggle(option.value)}
                        size="2"
                        style={{ flex: 1, justifyContent: "flex-start", minWidth: 0 }}
                        variant={selected ? "soft" : "ghost"}
                      >
                        <VendorAvatar displayName={option.label} iconUrl={option.iconUrl} size="1" />
                        <Flex align="start" direction="column" gap="0" style={{ minWidth: 0 }}>
                          <Text size="2" style={{ lineHeight: 1.2, whiteSpace: "nowrap" }}>
                            {option.label}
                          </Text>
                          <Text color="gray" size="1" style={{ lineHeight: 1.2, whiteSpace: "nowrap" }}>
                            {option.value}
                          </Text>
                        </Flex>
                      </Button>
                      <Button color="gray" onClick={() => props.onSetOnly(option.value)} size="1" variant="ghost">
                        Only
                      </Button>
                    </Flex>
                  );
                })
              )}
            </Flex>
          </ScrollArea>
        </Flex>
      </Popover.Content>
    </Popover.Root>
  );
}

function vendorSelectionLabel(selectedCount: number) {
  if (selectedCount === 0) {
    return "All";
  }
  return `${selectedCount} selected`;
}

function matchesVendorQuery(option: { label: string; value: string }, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return option.label.toLowerCase().includes(normalized) || option.value.toLowerCase().includes(normalized);
}
