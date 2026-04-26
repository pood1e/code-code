import type { CSSProperties, ReactNode } from "react";
import { TextArea } from "@radix-ui/themes";
import { FormField } from "./form-field";

type FormTextAreaFieldProps = {
  label: ReactNode;
  htmlFor?: string;
  id?: string;
  error?: ReactNode;
  description?: ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  labelClassName?: string;
  inputClassName?: string;
  style?: CSSProperties;
};

export function FormTextAreaField({
  label,
  htmlFor,
  id,
  error,
  description,
  value,
  onValueChange,
  rows = 4,
  placeholder,
  disabled = false,
  className,
  labelClassName,
  inputClassName,
  style,
}: FormTextAreaFieldProps) {
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
      <TextArea
        id={id}
        className={inputClassName}
        value={value}
        disabled={disabled}
        rows={rows}
        placeholder={placeholder}
        onChange={(event) => onValueChange(event.target.value)}
      />
    </FormField>
  );
}
