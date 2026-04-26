import type { CSSProperties, ReactNode } from "react";
import { Flex } from "@radix-ui/themes";
import { ExecutionClassSelectField } from "./execution-class-select-field";

type RuntimeSelectionFieldsProps = {
  providerField: ReactNode;
  executionClass: string;
  executionClassItems: Array<{ value: string; label: string }>;
  executionClassDisabled?: boolean;
  onExecutionClassChange: (value: string) => void;
  className?: string;
  style?: CSSProperties;
  executionClassFieldClassName?: string;
  executionClassFieldLabelClassName?: string;
  executionClassFieldTriggerClassName?: string;
};

export function RuntimeSelectionFields({
  providerField,
  executionClass,
  executionClassItems,
  executionClassDisabled = false,
  onExecutionClassChange,
  className,
  style,
  executionClassFieldClassName,
  executionClassFieldLabelClassName,
  executionClassFieldTriggerClassName,
}: RuntimeSelectionFieldsProps) {
  return (
    <Flex gap="3" direction={{ initial: "column", sm: "row" }} className={className} style={style}>
      {providerField}
      <div style={{ flex: 1 }}>
        <ExecutionClassSelectField
          value={executionClass}
          items={executionClassItems}
          disabled={executionClassDisabled}
          className={executionClassFieldClassName}
          labelClassName={executionClassFieldLabelClassName}
          triggerClassName={executionClassFieldTriggerClassName}
          onValueChange={onExecutionClassChange}
        />
      </div>
    </Flex>
  );
}
