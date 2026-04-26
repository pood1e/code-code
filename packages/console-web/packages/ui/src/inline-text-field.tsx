import type { CSSProperties, ComponentProps } from "react";
import { TextField } from "@radix-ui/themes";

type InlineTextFieldProps = {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  size?: ComponentProps<typeof TextField.Root>["size"];
};

export function InlineTextField({
  value,
  onValueChange,
  placeholder,
  disabled = false,
  className,
  style,
  size = "2",
}: InlineTextFieldProps) {
  return (
    <TextField.Root
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      style={style}
      size={size}
    />
  );
}
