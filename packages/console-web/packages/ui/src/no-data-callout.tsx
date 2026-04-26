import { type ReactNode } from "react";
import { StatusCallout } from "./status-callout";

type NoDataCalloutProps = {
  children: ReactNode;
  size?: "1" | "2";
  className?: string;
  mt?: string;
  mb?: string;
};

export function NoDataCallout({ children, size = "1", className, mt, mb }: NoDataCalloutProps) {
  return (
    <StatusCallout color="gray" size={size} className={className} mt={mt} mb={mb}>
      {children}
    </StatusCallout>
  );
}
