import { Button, Flex, Popover, Separator, Text } from "@radix-ui/themes";
import { buildSourceOptions } from "./model-table-filter-options";
import { FilterIcon, SoftBadge } from "@code-code/console-web-ui";

type SourceHeaderFilterProps = {
  onClear: () => void;
  onToggle: (value: string) => void;
  selectedValues: string[];
};

export function SourceHeaderFilter(props: SourceHeaderFilterProps) {
  const options = buildSourceOptions();
  const selectionLabel = props.selectedValues.length === 0 ? "All" : `${props.selectedValues.length} selected`;

  return (
    <Popover.Root>
      <Popover.Trigger>
        <Button aria-label="Filter Source" color="gray" size="2" variant="soft">
          <FilterIcon />
          Sources
          <SoftBadge color="gray" highContrast={false} label={selectionLabel} />
        </Button>
      </Popover.Trigger>
      <Popover.Content size="2" style={{ padding: "12px", width: "280px" }}>
        <Flex direction="column" gap="3">
          <Flex align="center" justify="between" gap="3">
            <Text color="gray" size="1">
              {props.selectedValues.length === 0 ? "All sources" : `${props.selectedValues.length} selected`}
            </Text>
            <Button
              color="gray"
              onClick={props.onClear}
              size="1"
              variant={props.selectedValues.length === 0 ? "solid" : "soft"}
            >
              All
            </Button>
          </Flex>
          <Separator size="4" />
          <Flex direction="column" gap="2">
            {options.map((option) => {
              const selected = props.selectedValues.includes(option.value);
              return (
                <Button
                  color="gray"
                  key={option.value}
                  onClick={() => props.onToggle(option.value)}
                  size="2"
                  style={{ justifyContent: "space-between" }}
                  variant={selected ? "soft" : "ghost"}
                >
                  <Text size="2">{option.label}</Text>
                  <Text color="gray" size="1">{option.value}</Text>
                </Button>
              );
            })}
          </Flex>
        </Flex>
      </Popover.Content>
    </Popover.Root>
  );
}
