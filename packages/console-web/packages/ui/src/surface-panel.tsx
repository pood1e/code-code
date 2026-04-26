import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { Card } from "@radix-ui/themes";

type SurfacePanelProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  cardSize?: ComponentProps<typeof Card>["size"];
  cardVariant?: ComponentProps<typeof Card>["variant"];
  cardProps?: Omit<ComponentProps<typeof Card>, "children" | "size" | "variant" | "className" | "style">;
};

export function SurfacePanel({
  children,
  className,
  style,
  cardSize = "1",
  cardVariant = "surface",
  cardProps,
}: SurfacePanelProps) {
  return (
    <Card
      {...cardProps}
      variant={cardVariant}
      size={cardSize}
      className={className}
      style={style}
    >
      {children}
    </Card>
  );
}
