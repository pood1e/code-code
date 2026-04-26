import type { CSSProperties, ReactNode } from "react";
import { Select } from "@radix-ui/themes";

type InlineSelectItem = {
  value: string;
  label: ReactNode;
};

type InlineSelectProps = {
  value: string;
  items: InlineSelectItem[];
  onValueChange: (value: string) => void;
  disabled?: boolean;
  triggerClassName?: string;
  triggerStyle?: CSSProperties;
  ariaLabel?: string;
};

export function InlineSelect({
  value,
  items,
  onValueChange,
  disabled = false,
  triggerClassName,
  triggerStyle,
  ariaLabel,
}: InlineSelectProps) {
  return (
    <Select.Root value={value} disabled={disabled} onValueChange={onValueChange}>
      <Select.Trigger className={triggerClassName} style={triggerStyle} aria-label={ariaLabel} />
      <Select.Content>
        {items.map((item) => (
          <Select.Item key={item.value} value={item.value}>
            {item.label}
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  );
}
