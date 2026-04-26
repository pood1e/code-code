import type { ReactNode } from "react";
import { Flex, Text } from "@radix-ui/themes";
import { SoftBadge } from "@code-code/console-web-ui";
import { DetailList, DetailListItem } from "../../../components/detail-list";
import { EMPTY_VALUE } from "./model-detail-formatters";

type ModelDetailsSectionProps = {
  children: ReactNode;
  title: string;
};

type ModelDetailRowProps = {
  children: ReactNode;
  label: string;
};

type ModelDetailBadgesProps = {
  values: string[];
};

export function ModelDetailsSection({ children, title }: ModelDetailsSectionProps) {
  return (
    <Flex direction="column" gap="2">
      <Text size="2" weight="medium">{title}</Text>
      <DetailList size="2">
        {children}
      </DetailList>
    </Flex>
  );
}

export function ModelDetailRow({ children, label }: ModelDetailRowProps) {
  return (
    <DetailListItem label={label} valueSize="2">
      {children}
    </DetailListItem>
  );
}

export function ModelDetailText({ children }: { children?: ReactNode }) {
  if (!children) {
    return <Text size="2" color="gray">{EMPTY_VALUE}</Text>;
  }
  return <Text size="2">{children}</Text>;
}

export function ModelDetailBadges({ values }: ModelDetailBadgesProps) {
  if (values.length === 0) {
    return <Text size="2" color="gray">{EMPTY_VALUE}</Text>;
  }
  return (
    <Flex gap="1" wrap="wrap">
      {values.map((value) => (
        <SoftBadge key={value} color="gray" label={value} />
      ))}
    </Flex>
  );
}
