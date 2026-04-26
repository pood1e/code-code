import type { ChangeEvent, CSSProperties, ComponentProps, ReactNode } from "react";
import { TextField } from "@radix-ui/themes";
import { FormField } from "./form-field";

type FormTextFieldProps = {
  label: ReactNode;
  htmlFor?: string;
  id?: string;
  error?: ReactNode;
  description?: ReactNode;
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  size?: ComponentProps<typeof TextField.Root>["size"];
  type?: ComponentProps<typeof TextField.Root>["type"];
  autoComplete?: string;
  inputProps?: Omit<ComponentProps<typeof TextField.Root>, "id" | "className" | "size" | "type" | "autoComplete" | "disabled" | "placeholder" | "value">;
  className?: string;
  labelClassName?: string;
  inputClassName?: string;
  style?: CSSProperties;
};

export function FormTextField({
  label,
  htmlFor,
  id,
  error,
  description,
  value,
  onValueChange,
  placeholder,
  disabled = false,
  size = "2",
  type,
  autoComplete,
  inputProps,
  className,
  labelClassName,
  inputClassName,
  style,
}: FormTextFieldProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    inputProps?.onChange?.(event);
    onValueChange?.(event.target.value);
  };

  return (
    <FormField
      label={label}
      htmlFor={htmlFor ?? id}
      error={error}
      description={description}
      className={className}
      labelClassName={labelClassName}
      style={style}
    >
      <TextField.Root
        {...inputProps}
        id={id}
        className={inputClassName}
        size={size}
        type={type}
        autoComplete={autoComplete}
        disabled={disabled}
        placeholder={placeholder}
        {...(value !== undefined ? { value } : {})}
        onChange={handleChange}
      />
    </FormField>
  );
}
