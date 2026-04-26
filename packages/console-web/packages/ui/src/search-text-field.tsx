import type { ComponentProps } from "react";
import { TextField } from "@radix-ui/themes";

type SearchTextFieldProps = {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  size?: ComponentProps<typeof TextField.Root>["size"];
  className?: string;
};

export function SearchTextField({
  value,
  onValueChange,
  placeholder = "Search",
  ariaLabel = "Search",
  size = "2",
  className,
}: SearchTextFieldProps) {
  return (
    <TextField.Root
      className={className}
      aria-label={ariaLabel}
      placeholder={placeholder}
      size={size}
      value={value}
      onChange={(event) => onValueChange(event.currentTarget.value)}
    />
  );
}
