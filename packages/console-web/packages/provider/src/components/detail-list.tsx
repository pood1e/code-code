import type { ReactNode } from "react";
import { DataList, Skeleton, Text } from "@radix-ui/themes";

type DetailListSize = "1" | "2";

type DetailListProps = {
  children: ReactNode;
  size?: DetailListSize;
};

type DetailListItemProps = {
  children: ReactNode;
  label: ReactNode;
  labelMinWidth?: string;
  labelSize?: DetailListSize;
  labelColor?: "gray";
  valueSize?: DetailListSize;
};

type DetailListSkeletonRowProps = {
  labelWidth?: string;
  valueWidth?: string;
  labelMinWidth?: string;
};

export function DetailList({ children, size = "1" }: DetailListProps) {
  return (
    <DataList.Root size={size}>
      {children}
    </DataList.Root>
  );
}

export function DetailListItem({
  children,
  label,
  labelMinWidth = "132px",
  labelSize,
  labelColor,
  valueSize = "1",
}: DetailListItemProps) {
  return (
    <DataList.Item align="start">
      <DataList.Label minWidth={labelMinWidth}>
        {typeof label === "string" && (labelSize || labelColor) ? (
          <Text size={labelSize} color={labelColor}>{label}</Text>
        ) : (
          label
        )}
      </DataList.Label>
      <DataList.Value>
        {typeof children === "string" || typeof children === "number" || typeof children === "bigint" ? (
          <Text size={valueSize}>{children}</Text>
        ) : (
          children
        )}
      </DataList.Value>
    </DataList.Item>
  );
}

export function DetailListSkeletonRow({
  labelWidth = "72px",
  valueWidth = "104px",
  labelMinWidth = "132px",
}: DetailListSkeletonRowProps) {
  return (
    <DataList.Item align="start">
      <DataList.Label minWidth={labelMinWidth}>
        <Skeleton height="14px" width={labelWidth} />
      </DataList.Label>
      <DataList.Value>
        <Skeleton height="14px" width={valueWidth} />
      </DataList.Value>
    </DataList.Item>
  );
}
