import { FormSelectField } from "./form-select-field";

type ExecutionClassSelectFieldProps = {
  value: string;
  items: Array<{ value: string; label: string }>;
  disabled?: boolean;
  className?: string;
  labelClassName?: string;
  triggerClassName?: string;
  onValueChange: (value: string) => void;
};

export function ExecutionClassSelectField({
  value,
  items,
  disabled = false,
  className,
  labelClassName,
  triggerClassName,
  onValueChange,
}: ExecutionClassSelectFieldProps) {
  return (
    <FormSelectField
      label="Execution class"
      value={value}
      items={items}
      disabled={disabled}
      placeholder="Select execution class"
      className={className}
      labelClassName={labelClassName}
      triggerClassName={triggerClassName}
      onValueChange={onValueChange}
    />
  );
}
