import type { CSSProperties, ReactNode } from "react";
import { Badge, Code, Flex, Grid, Text } from "@radix-ui/themes";
import type { IstioEgressResourceRef } from "./network-types";

export function PolicyBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Flex direction="column" gap="2">
      <Text size="2" weight="medium" style={sectionTitleStyle}>{title}</Text>
      <Flex direction="column">{children}</Flex>
    </Flex>
  );
}

export function ReferenceRow({
  badge,
  badgeColor = "gray",
  title,
  id,
  detail
}: {
  badge: string;
  badgeColor?: "amber" | "blue" | "green" | "gray";
  title: string;
  id: string;
  detail: string;
}) {
  return (
    <Grid columns={{ initial: "1", md: "120px minmax(0, 1fr)" }} gap="2" style={rowStyle}>
      <Badge color={badgeColor} variant="soft" style={badgeStyle}>{badge}</Badge>
      <Flex direction="column" gap="1">
        <Text size="2" weight="medium">{title}</Text>
        <Flex gap="2" wrap="wrap">
          <Code>{id}</Code>
          <Text size="2" color="gray">{detail}</Text>
        </Flex>
      </Flex>
    </Grid>
  );
}

export function ResourceRow({
  resource,
  badgeColor = "gray"
}: {
  resource: IstioEgressResourceRef;
  badgeColor?: "gray" | "teal";
}) {
  return (
    <Grid columns={{ initial: "1", md: "120px minmax(0, 1fr)" }} gap="2" style={rowStyle}>
      <Badge color={badgeColor} variant="soft" style={badgeStyle}>{resource.kind}</Badge>
      <WrappingCode>{`${resource.namespace}/${resource.name}`}</WrappingCode>
    </Grid>
  );
}

export function WrappingCode({ children }: { children: string }) {
  return <Code style={codeStyle}>{children}</Code>;
}

export const rowStyle = { borderTop: "1px solid var(--gray-a5)", paddingBlock: 10 } satisfies CSSProperties;
export const wrapTextStyle = { overflowWrap: "anywhere", whiteSpace: "normal" } satisfies CSSProperties;
export const codeStyle = { ...wrapTextStyle, maxWidth: "100%", width: "fit-content" } satisfies CSSProperties;
export const badgeStyle = { justifySelf: "start" } satisfies CSSProperties;
const sectionTitleStyle = { color: "var(--gray-12)" } satisfies CSSProperties;
