import type { ComponentProps } from "react";
import { SoftBadge } from "./soft-badge";

type StatusBadgeProps = ComponentProps<typeof SoftBadge>;

export function StatusBadge({
  label,
  color,
  size,
  highContrast,
  className,
  title,
  ariaLabel,
}: StatusBadgeProps) {
  return <SoftBadge label={label} color={color} size={size} highContrast={highContrast} className={className} title={title} ariaLabel={ariaLabel} />;
}
