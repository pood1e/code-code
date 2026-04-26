import type { ReactNode } from "react";
import { Callout } from "@radix-ui/themes";

type StatusCalloutColor = "gray" | "red" | "amber" | "green" | "blue";
type StatusCalloutSize = "1" | "2";

type StatusCalloutProps = {
  children: ReactNode;
  color?: StatusCalloutColor;
  size?: StatusCalloutSize;
  mt?: string;
  mb?: string;
  className?: string;
  icon?: ReactNode;
  role?: "alert";
};

export function StatusCallout({
  children,
  color = "red",
  size = "1",
  className,
  mt,
  mb,
  icon,
  role,
}: StatusCalloutProps) {
  if (children == null) {
    return null;
  }
  if (typeof children === "string" && !children.trim()) {
    return null;
  }
  return (
    <Callout.Root color={color} size={size} className={className} mt={mt} mb={mb} role={role}>
      {icon ? <Callout.Icon>{icon}</Callout.Icon> : null}
      <Callout.Text>{children}</Callout.Text>
    </Callout.Root>
  );
}
