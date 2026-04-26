import type { CSSProperties, ReactNode } from "react";
import { Box, Text } from "@radix-ui/themes";

type CollapsibleSectionProps = {
  summary: ReactNode;
  children: ReactNode;
  className?: string;
  summaryClassName?: string;
  summaryStyle?: CSSProperties;
  contentClassName?: string;
  contentStyle?: CSSProperties;
  contentMarginTop?: "0" | "1" | "2" | "3" | "4" | "5";
};

export function CollapsibleSection({
  summary,
  children,
  className,
  summaryClassName,
  summaryStyle,
  contentClassName,
  contentStyle,
  contentMarginTop = "2",
}: CollapsibleSectionProps) {
  return (
    <details className={className}>
      <summary
        className={summaryClassName}
        style={{
          cursor: "pointer",
          fontSize: "var(--font-size-1)",
          color: "var(--gray-11)",
          ...summaryStyle,
        }}
      >
        <Text as="span" size="1" color="gray">
          {summary}
        </Text>
      </summary>
      <Box mt={contentMarginTop} className={contentClassName} style={contentStyle}>
        {children}
      </Box>
    </details>
  );
}
