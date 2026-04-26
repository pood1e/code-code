import type { ReactNode } from "react";
import { StatusCallout } from "./status-callout";

type ErrorCalloutProps = {
  children: ReactNode;
  size?: "1" | "2";
  className?: string;
  mt?: string;
  mb?: string;
};

export function ErrorCallout({ children, size = "1", className, mt, mb }: ErrorCalloutProps) {
  return (
    <StatusCallout color="red" size={size} className={className} mt={mt} mb={mb} role="alert">
      {children}
    </StatusCallout>
  );
}
