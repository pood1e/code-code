import type { ReactNode } from "react";
import { StatusCallout } from "./status-callout";

type WarningCalloutProps = {
  children: ReactNode;
  size?: "1" | "2";
  className?: string;
  mt?: string;
  mb?: string;
};

export function WarningCallout({ children, size = "1", className, mt, mb }: WarningCalloutProps) {
  return (
    <StatusCallout color="amber" size={size} className={className} mt={mt} mb={mb}>
      {children}
    </StatusCallout>
  );
}
