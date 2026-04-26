import type { ReactNode } from "react";
import { Text } from "@radix-ui/themes";

type FormFieldErrorProps = {
  children: ReactNode;
  mt?: string;
};

export function FormFieldError({ children, mt = "1" }: FormFieldErrorProps) {
  if (children == null) {
    return null;
  }
  if (typeof children === "string" && !children.trim()) {
    return null;
  }
  return (
    <Text size="1" color="red" mt={mt}>
      {children}
    </Text>
  );
}
