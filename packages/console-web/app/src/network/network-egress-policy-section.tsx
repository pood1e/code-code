import { Badge, Card, Flex, Grid, Heading, Text } from "@radix-ui/themes";
import { PolicySummary } from "./network-egress-policy-card-summary";
import { PolicyBlock, badgeStyle, rowStyle, wrapTextStyle, WrappingCode } from "./network-egress-policy-rows";
import type { IstioEgressPolicy } from "./network-types";

export function PolicyDetails({ policy }: { policy: IstioEgressPolicy }) {
  const resourceCounts = summarizeResources(policy);

  return (
    <Card size="2" variant="surface" style={{ height: "100%" }}>
      <Flex direction="column" gap="3">
        <Flex justify="between" align="start" gap="3" wrap="wrap">
          <Flex direction="column" gap="1">
            <Heading as="h2" size="4" weight="medium">{policy.displayName}</Heading>
            <Text size="2" color="gray">Effective result (read-only).</Text>
          </Flex>
          <Badge color={syncStatusColor(policy.sync.status)} variant="soft">{policy.sync.status}</Badge>
        </Flex>

        <PolicySummary policy={policy} />

        <PolicyBlock title="What this means">
          <Text size="2" color="gray" style={wrapTextStyle}>
            Rules are configured in the Rules tab. This page only shows what is currently in effect.
          </Text>
        </PolicyBlock>

        <PolicyBlock title="Current status">
          <Grid columns={{ initial: "1", md: "120px minmax(0, 1fr)" }} gap="2" style={rowStyle}>
            <Badge color={syncStatusColor(policy.sync.status)} variant="soft" style={badgeStyle}>{policy.sync.status}</Badge>
            <Text size="2" color="gray" style={wrapTextStyle}>{policy.sync.reason || "No status message."}</Text>
          </Grid>
          <Grid columns={{ initial: "1", md: "120px minmax(0, 1fr)" }} gap="2" style={rowStyle}>
            <Badge variant="soft" style={badgeStyle}>updated</Badge>
            <Text size="2" color="gray">
              generation {policy.sync.observedGeneration}{policy.sync.lastSyncedAt ? ` / ${policy.sync.lastSyncedAt}` : ""}
            </Text>
          </Grid>
        </PolicyBlock>

        <PolicyBlock title="Custom rules in effect">
          {(policy.rules ?? []).length > 0 ? (
            (policy.rules ?? []).map((rule, index) => (
              <Grid
                key={`${rule.id}-${index}`}
                columns={{ initial: "1", md: "72px 140px minmax(0, 1fr)" }}
                gap="2"
                style={rowStyle}
              >
                <Badge color={rule.action === "proxy" ? "blue" : "green"} variant="soft" style={badgeStyle}>{rule.action}</Badge>
                <Text size="2" color="gray">{rule.action === "proxy" ? proxyLabel(policy, rule.proxyId) : "direct"}</Text>
                <WrappingCode>{rule.match}</WrappingCode>
              </Grid>
            ))
          ) : (
            <Text size="2" color="gray" style={wrapTextStyle}>No custom rules. Traffic uses default behavior.</Text>
          )}
        </PolicyBlock>

        <PolicyBlock title="External AutoProxy rule set">
          <Grid columns={{ initial: "1", md: "120px minmax(0, 1fr)" }} gap="2" style={rowStyle}>
            <Badge color={policy.externalRuleSet.enabled ? "blue" : "gray"} variant="soft" style={badgeStyle}>
              {policy.externalRuleSet.enabled ? policy.externalRuleSet.action : "off"}
            </Badge>
            <Text size="2" color="gray">
              {policy.externalRuleSet.enabled
                ? `${policy.externalRuleSetStatus.loadedHostCount} hosts loaded`
                : "External rule set disabled"}
            </Text>
          </Grid>
          {policy.externalRuleSet.sourceUrl ? (
            <Grid columns={{ initial: "1", md: "120px minmax(0, 1fr)" }} gap="2" style={rowStyle}>
              <Badge variant="soft" style={badgeStyle}>source</Badge>
              <WrappingCode>{policy.externalRuleSet.sourceUrl}</WrappingCode>
            </Grid>
          ) : null}
          {policy.externalRuleSetStatus.message ? (
            <Grid columns={{ initial: "1", md: "120px minmax(0, 1fr)" }} gap="2" style={rowStyle}>
              <Badge color={policy.externalRuleSetStatus.phase === "failed" ? "red" : "gray"} variant="soft" style={badgeStyle}>
                {policy.externalRuleSetStatus.phase}
              </Badge>
              <Text size="2" color="gray" style={wrapTextStyle}>{policy.externalRuleSetStatus.message}</Text>
            </Grid>
          ) : null}
        </PolicyBlock>

        <PolicyBlock title="System resources (count)">
          {resourceCounts.length > 0 ? (
            resourceCounts.map((item) => (
              <Grid key={item.kind} columns={{ initial: "1", md: "120px minmax(0, 1fr)" }} gap="2" style={rowStyle}>
                <Badge variant="soft" style={badgeStyle}>{item.kind}</Badge>
                <Text size="2" color="gray">{item.count}</Text>
              </Grid>
            ))
          ) : (
            <Text size="2" color="gray">No resources synced yet.</Text>
          )}
        </PolicyBlock>
      </Flex>
    </Card>
  );
}

function proxyLabel(policy: IstioEgressPolicy, proxyId: string) {
  return policy.proxies?.find((proxy) => proxy.id === proxyId)?.name ?? proxyId;
}

function syncStatusColor(status: IstioEgressPolicy["sync"]["status"]) {
  if (status === "synced") {
    return "green";
  }
  if (status === "pending") {
    return "amber";
  }
  return "red";
}

function summarizeResources(policy: IstioEgressPolicy): Array<{ kind: string; count: number }> {
  const counts = new Map<string, number>();
  for (const resource of policy.sync.appliedResources ?? []) {
    counts.set(resource.kind, (counts.get(resource.kind) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([kind, count]) => ({ kind, count }));
}
