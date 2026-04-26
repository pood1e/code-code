import type { CSSProperties, ReactNode } from "react";
import { Select } from "@radix-ui/themes";
import { FormField } from "./form-field";

type FormSelectFieldItem = {
  value: string;
  label: string;
};

type FormSelectFieldProps = {
  label: ReactNode;
  htmlFor?: string;
  error?: ReactNode;
  description?: ReactNode;
  value: string;
  items: FormSelectFieldItem[];
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  labelClassName?: string;
  triggerClassName?: string;
  triggerStyle?: CSSProperties;
  onValueChange: (value: string) => void;
};

export function FormSelectField({
  label,
  htmlFor,
  error,
  description,
  value,
  items,
  loading = false,
  disabled = false,
  placeholder = "Select",
  className,
  style,
  labelClassName,
  triggerClassName,
  triggerStyle,
  onValueChange,
}: FormSelectFieldProps) {
  return (
    <FormField
      label={label}
      htmlFor={htmlFor}
      error={error}
      description={description}
      className={className}
      style={style}
      labelClassName={labelClassName}
    >
      <Select.Root value={value} disabled={disabled} onValueChange={onValueChange}>
        <Select.Trigger className={triggerClassName} style={triggerStyle} placeholder={loading ? "Loading..." : placeholder} />
        <Select.Content>
          {items.map((item) => (
            <Select.Item key={item.value} value={item.value}>
              {item.label}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
    </FormField>
  );
}
