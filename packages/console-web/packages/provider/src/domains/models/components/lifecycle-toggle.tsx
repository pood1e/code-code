import { Checkbox, Flex, Text } from "@radix-ui/themes";

type LifecycleToggleProps = {
  hideDeprecated: boolean;
  onChange: (value: boolean) => void;
};

export function LifecycleToggle({ hideDeprecated, onChange }: LifecycleToggleProps) {
  return (
    <Flex align="center" gap="2" asChild>
      <label>
        <Checkbox
          checked={hideDeprecated}
          onCheckedChange={(checked) => onChange(checked === true)}
          size="1"
        />
        <Text size="1" color="gray">Hide deprecated & EOL</Text>
      </label>
    </Flex>
  );
}
