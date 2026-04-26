import { type ComponentProps, type ReactNode } from "react";
import { IconButton } from "@radix-ui/themes";

export type ActionIconButtonProps = Omit<
  ComponentProps<typeof IconButton>,
  "children"
> & {
  label?: string;
  children: ReactNode;
};

export function ActionIconButton({
  label,
  "aria-label": ariaLabel,
  title,
  size = "1",
  variant = "soft",
  color = "gray",
  children,
  ...props
}: ActionIconButtonProps) {
  const resolvedLabel = (label || ariaLabel || (typeof title === "string" ? title : "") || "Action").trim();

  return (
    <IconButton
      type="button"
      size={size}
      variant={variant}
      color={color}
      aria-label={resolvedLabel}
      title={title}
      {...props}
    >
      {children}
    </IconButton>
  );
}
