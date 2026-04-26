import type { CSSProperties, ReactNode } from "react";
import { Flex, Text } from "@radix-ui/themes";
import { FormFieldError } from "./form-field-error";

type FormFieldProps = {
  label: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  error?: ReactNode;
  description?: ReactNode;
  className?: string;
  style?: CSSProperties;
  labelClassName?: string;
  labelStyle?: CSSProperties;
};

export function FormField({
  label,
  htmlFor,
  children,
  error,
  description,
  className,
  style,
  labelClassName,
  labelStyle
}: FormFieldProps) {
  return (
    <Flex direction="column" gap="1" className={className} style={style}>
      <Text as="label" htmlFor={htmlFor} size="2" weight="medium" className={labelClassName} style={labelStyle}>
        {label}
      </Text>
      {children}
      {description ? <Text size="1" color="gray" mt="1">
        {description}
      </Text> : null}
      <FormFieldError mt="1">{error}</FormFieldError>
    </Flex>
  );
}
