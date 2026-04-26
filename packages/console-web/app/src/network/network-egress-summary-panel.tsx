import { Badge, Card, Flex, Grid, Heading, Text } from "@radix-ui/themes";
import { badgeStyle, rowStyle, WrappingCode } from "./network-egress-policy-rows";
import type { EgressPolicyCatalog, EgressProxy } from "./network-types";

export function EgressSummaryPanel({
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
    return <Text size="2" color="red">Failed to load egress status.</Text>;
  }

  const proxies = uniqueProxies(catalog.policies);
  const ruleCount = catalog.policies.reduce((sum, p) => sum + (p.rules?.length ?? 0), 0);
  const externalRuleSetCount = catalog.policies.filter((p) => p.externalRuleSet.enabled).length;
  const externalHostCount = catalog.policies.reduce((sum, p) => sum + p.externalRuleSetStatus.loadedHostCount, 0);
  const totalRules = ruleCount + externalRuleSetCount;

  return (
    <Grid columns={{ initial: "1", sm: "2" }} gap="4">
      <Card size="2" variant="surface">
        <Flex direction="column" gap="3">
          <Heading as="h2" size="3" weight="medium">Available proxies</Heading>
          {proxies.length > 0 ? (
            <Flex direction="column">
              {proxies.map((proxy) => (
                <ProxyRow key={proxy.endpoint} proxy={proxy} />
              ))}
            </Flex>
          ) : (
            <Text size="2" color="gray">No proxies configured. Direct egress applies.</Text>
          )}
        </Flex>
      </Card>

      <Card size="2" variant="surface">
        <Flex direction="column" gap="3">
          <Heading as="h2" size="3" weight="medium">User rules</Heading>
          <Flex direction="column">
            <Grid columns="120px minmax(0, 1fr)" gap="2" style={rowStyle}>
              <Text size="2" weight="medium">Custom rules</Text>
              <Text size="2" color="gray">{ruleCount}</Text>
            </Grid>
            <Grid columns="120px minmax(0, 1fr)" gap="2" style={rowStyle}>
              <Text size="2" weight="medium">External set</Text>
              <Text size="2" color="gray">{externalRuleSetCount ? `${externalHostCount} hosts` : "off"}</Text>
            </Grid>
            <Grid columns="120px minmax(0, 1fr)" gap="2" style={rowStyle}>
              <Text size="2" weight="medium">Total</Text>
              <Text size="2" color={totalRules > 0 ? undefined : "gray"}>{totalRules}</Text>
            </Grid>
          </Flex>
        </Flex>
      </Card>
    </Grid>
  );
}

function ProxyRow({ proxy }: { proxy: EgressProxy }) {
  return (
    <Grid columns={{ initial: "1", md: "60px minmax(0, 1fr)" }} gap="2" style={rowStyle}>
      <Badge color="blue" variant="soft" style={badgeStyle}>{proxy.protocol}</Badge>
      <Flex direction="column" gap="1">
        <Text size="2" weight="medium">{proxy.name}</Text>
        <WrappingCode>{proxy.endpoint}</WrappingCode>
      </Flex>
    </Grid>
  );
}

function uniqueProxies(policies: EgressPolicyCatalog["policies"]): EgressProxy[] {
  const seen = new Set<string>();
  const result: EgressProxy[] = [];
  for (const policy of policies) {
    for (const proxy of policy.proxies ?? []) {
      if (!seen.has(proxy.endpoint)) {
        seen.add(proxy.endpoint);
        result.push(proxy);
      }
    }
  }
  return result;
}
