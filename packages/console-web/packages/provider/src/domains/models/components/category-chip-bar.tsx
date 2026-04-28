import { ModelCategory } from "@code-code/agent-contract/model/v1";
import { Button, Flex } from "@radix-ui/themes";
import { CATEGORY_OPTIONS } from "./model-detail-formatters";

type CategoryChipBarProps = {
  selected: string;
  onChange: (value: string) => void;
};

const ALL_VALUE = "";

export function CategoryChipBar({ selected, onChange }: CategoryChipBarProps) {
  return (
    <Flex gap="1" wrap="wrap" align="center">
      <Button
        size="1"
        variant={selected === ALL_VALUE ? "solid" : "soft"}
        color="gray"
        onClick={() => onChange(ALL_VALUE)}
      >
        All
      </Button>
      {CATEGORY_OPTIONS.map((option) => {
        const value = String(option.value);
        return (
          <Button
            key={value}
            size="1"
            variant={selected === value ? "solid" : "soft"}
            color="gray"
            onClick={() => onChange(selected === value ? ALL_VALUE : value)}
          >
            {option.label}
          </Button>
        );
      })}
    </Flex>
  );
}
