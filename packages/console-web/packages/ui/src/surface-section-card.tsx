import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { Card, Flex, Text } from "@radix-ui/themes";

type SurfaceSectionCardProps = {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  contentGap?: "1" | "2" | "3" | "4" | "5";
  cardSize?: ComponentProps<typeof Card>["size"];
  cardVariant?: ComponentProps<typeof Card>["variant"];
  cardProps?: Omit<ComponentProps<typeof Card>, "children" | "size" | "variant" | "className" | "style">;
};

export function SurfaceSectionCard({
  title,
  actions,
  children,
  className,
  style,
  contentGap = "2",
  cardSize = "1",
  cardVariant = "surface",
  cardProps,
}: SurfaceSectionCardProps) {
  return (
    <Card
      {...cardProps}
      variant={cardVariant}
      size={cardSize}
      className={className}
      style={style}
    >
      <Flex direction="column" gap={contentGap}>
        <Flex justify="between" align="start" gap="2">
          <Text size="2" weight="medium">
            {title}
          </Text>
          {actions}
        </Flex>
        {children}
      </Flex>
    </Card>
  );
}
