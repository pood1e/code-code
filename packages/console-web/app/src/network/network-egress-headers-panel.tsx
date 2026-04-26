import { Badge, Card, Code, Flex, Grid, Heading, Text } from "@radix-ui/themes";
import {
  badgeStyle,
  PolicyBlock,
  rowStyle,
  wrapTextStyle,
  WrappingCode
} from "./network-egress-policy-rows";
import { sourceColor } from "./network-egress-source-color";
import type {
  EgressConfigSource,
  EgressPolicyCatalog,
  HeaderMetricRule,
  HeaderModification
} from "./network-types";

type HeaderGroup = {
  source: EgressConfigSource;
  modifications: HeaderModification[];
  metrics: HeaderMetricRule[];
};

export function EgressHeadersPanel({
  catalog,
  isLoading,
  isError
}: {
  catalog: EgressPolicyCatalog;
  isLoading?: boolean;
  isError?: boolean;
}) {
  if (isLoading) {
    return <Text size="2" color="gray">Loading...</Text>;
  }
  if (isError) {
    return <Text size="2" color="red">Failed to load header policies.</Text>;
  }

  const groups = headerGroups(catalog);
  if (!groups.length) {
    return (
      <Card size="2" variant="surface">
        <Text size="2" color="gray">No header policy found.</Text>
      </Card>
    );
  }

  return (
    <Card size="2" variant="surface">
      <Flex direction="column" gap="4">
        <Flex direction="column" gap="1">
          <Heading as="h2" size="3" weight="medium">Header policies</Heading>
          <Text size="2" color="gray">Read-only vendor and CLI header capture and request injection contracts.</Text>
        </Flex>
        {groups.map((group) => (
          <Flex key={sourceKey(group.source)} direction="column" gap="3" style={groupStyle}>
            <Flex align="start" justify="between" gap="3" wrap="wrap">
              <Flex direction="column" gap="1">
                <Heading as="h3" size="3" weight="medium">{sourceTitle(group.source)}</Heading>
                <Flex gap="2" wrap="wrap">
                  <Code>{group.source.id}</Code>
                  <Text size="2" color="gray">{group.source.crdKind}</Text>
                </Flex>
              </Flex>
              <Badge color={sourceColor(group.source.kind)} variant="soft">{group.source.kind}</Badge>
            </Flex>
            {group.modifications.length ? <HeaderModificationRows items={group.modifications} /> : null}
            {group.metrics.length ? <HeaderMetricRows items={group.metrics} /> : null}
          </Flex>
        ))}
      </Flex>
    </Card>
  );
}

function headerGroups(catalog: EgressPolicyCatalog): HeaderGroup[] {
  const groups = new Map<string, HeaderGroup>();
  for (const policy of catalog.policies) {
    const source = policy.configuredBy;
    for (const item of policy.headerModifications ?? []) {
      groupFor(groups, source).modifications.push(item);
    }
    for (const item of policy.headerMetrics ?? []) {
      groupFor(groups, source).metrics.push(item);
    }
  }
  return [...groups.values()].sort((left, right) => sourceKey(left.source).localeCompare(sourceKey(right.source)));
}

function groupFor(groups: Map<string, HeaderGroup>, source: EgressConfigSource): HeaderGroup {
  const key = sourceKey(source);
  const current = groups.get(key);
  if (current) {
    return current;
  }
  const next = { source, modifications: [], metrics: [] };
  groups.set(key, next);
  return next;
}

function HeaderModificationRows({ items }: { items: HeaderModification[] }) {
  return (
    <PolicyBlock title="Header modify">
      {items.map((item) => (
        <Grid key={`${item.scope}-${item.header}-${item.action}-${item.valueSource}`} columns={{ initial: "1", md: "160px 72px minmax(0, 1fr)" }} gap="2" style={rowStyle}>
          <Text size="2" color="gray" style={wrapTextStyle}>{item.scope}</Text>
          <Badge color="blue" variant="soft" style={badgeStyle}>{item.action}</Badge>
          <Flex direction="column" gap="1">
            <WrappingCode>{item.header}</WrappingCode>
            <Text size="2" color="gray" style={wrapTextStyle}>{item.valueSource}</Text>
          </Flex>
        </Grid>
      ))}
    </PolicyBlock>
  );
}

function HeaderMetricRows({ items }: { items: HeaderMetricRule[] }) {
  return (
    <PolicyBlock title="Header metrics">
      {items.map((item) => (
        <Grid key={`${item.profile}-${item.header}-${item.metric}-${item.valueType}`} columns={{ initial: "1", md: "160px 140px minmax(0, 1fr)" }} gap="2" style={rowStyle}>
          <Text size="2" color="gray" style={wrapTextStyle}>{item.profile}</Text>
          <Badge variant="soft" style={badgeStyle}>{item.valueType}</Badge>
          <Flex direction="column" gap="1">
            <WrappingCode>{item.header}</WrappingCode>
            <Text size="2" color="gray" style={wrapTextStyle}>{item.metric}</Text>
            {item.labels?.length ? <Text size="2" color="gray" style={wrapTextStyle}>{item.labels.join(", ")}</Text> : null}
          </Flex>
        </Grid>
      ))}
    </PolicyBlock>
  );
}

function sourceKey(source: EgressConfigSource) {
  return `${source.kind}:${source.id}`;
}

function sourceTitle(source: EgressConfigSource) {
  return source.displayName || source.id;
}

const groupStyle = { borderTop: "1px solid var(--gray-a5)", paddingTop: 12 };
