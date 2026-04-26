import type { ComponentProps, ReactNode } from "react";
import { Badge } from "@radix-ui/themes";

type SoftBadgeProps = {
  label: ReactNode;
  color?: ComponentProps<typeof Badge>["color"];
  size?: ComponentProps<typeof Badge>["size"];
  highContrast?: boolean;
  className?: string;
  title?: string;
  ariaLabel?: string;
};

export function SoftBadge({
  label,
  color = "gray",
  size,
  highContrast,
  className,
  title,
  ariaLabel,
}: SoftBadgeProps) {
  return (
    <Badge
      color={color}
      variant="soft"
      size={size}
      highContrast={highContrast}
      className={className}
      title={title}
      aria-label={ariaLabel}
    >
      {label}
    </Badge>
  );
}
