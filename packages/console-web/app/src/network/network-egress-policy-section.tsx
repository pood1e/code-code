import { Badge, Card, Flex, Grid, Heading, Text } from "@radix-ui/themes";
import { PolicySummary } from "./network-egress-policy-card-summary";
import { PolicyBlock, badgeStyle, rowStyle, wrapTextStyle, WrappingCode } from "./network-egress-policy-rows";
import type { ExternalAccessSet, IstioEgressPolicy } from "./network-types";

export function PolicyDetails({ policy }: { policy: IstioEgressPolicy }) {
  const resourceCounts = summarizeResources(policy);

  return (
    <Card size="2" variant="surface" style={{ height: "100%" }}>
      <Flex direction="column" gap="3">
        <Flex justify="between" align="start" gap="3" wrap="wrap">
          <Flex direction="column" gap="1">
            <Heading as="h2" size="4" weight="medium">{policy.displayName}</Heading>
            <Text size="2" color="gray">Effective result after egressservice sync.</Text>
          </Flex>
          <Badge color={syncStatusColor(policy.sync.status)} variant="soft">{policy.sync.status}</Badge>
        </Flex>

        <PolicySummary policy={policy} />

        <PolicyBlock title="Current status">
          <Grid columns={{ initial: "1", md: "120px minmax(0, 1fr)" }} gap="2" style={rowStyle}>
            <Badge color={syncStatusColor(policy.sync.status)} variant="soft" style={badgeStyle}>{policy.sync.status}</Badge>
            <Text size="2" color="gray" style={wrapTextStyle}>{policy.sync.reason || "No status message."}</Text>
          </Grid>
          <Grid columns={{ initial: "1", md: "120px minmax(0, 1fr)" }} gap="2" style={rowStyle}>
            <Badge variant="soft" style={badgeStyle}>gateway</Badge>
            <WrappingCode>{`${policy.sync.targetGateway.namespace}/${policy.sync.targetGateway.name}`}</WrappingCode>
          </Grid>
        </PolicyBlock>

        <PolicyBlock title="External access sets">
          {policy.accessSets.length > 0 ? (
            policy.accessSets.map((accessSet) => <AccessSetBlock key={accessSet.id} accessSet={accessSet} />)
          ) : (
            <Text size="2" color="gray" style={wrapTextStyle}>No external access sets declared.</Text>
          )}
        </PolicyBlock>

        <PolicyBlock title="System resources">
          {resourceCounts.length > 0 ? (
            resourceCounts.map((item) => (
              <Grid key={item.kind} columns={{ initial: "1", md: "150px minmax(0, 1fr)" }} gap="2" style={rowStyle}>
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

function AccessSetBlock({ accessSet }: { accessSet: ExternalAccessSet }) {
  const serviceAccountsByDestination = new Map(
    accessSet.serviceRules.map((rule) => [rule.destinationId, rule.sourceServiceAccounts])
  );
  return (
    <Flex direction="column" gap="2">
      <Flex justify="between" gap="3" wrap="wrap">
        <Text size="2" weight="medium">{accessSet.displayName}</Text>
        <Badge variant="soft">{accessSet.ownerService || "unknown owner"}</Badge>
      </Flex>
      {accessSet.externalRules.map((rule) => (
        <Grid
          key={rule.id}
          columns={{ initial: "1", md: "76px 96px minmax(0, 1fr)" }}
          gap="2"
          style={rowStyle}
        >
          <Badge color={rule.hostKind === "wildcard" ? "amber" : "blue"} variant="soft" style={badgeStyle}>
            {rule.protocol}
          </Badge>
          <Text size="2" color="gray">{rule.resolution}</Text>
          <Flex direction="column" gap="1">
            <WrappingCode>{`${rule.host}:${rule.port}`}</WrappingCode>
            <Text size="1" color="gray" style={wrapTextStyle}>
              {[
                (serviceAccountsByDestination.get(rule.destinationId) ?? []).join(", ") || "deny all",
                rule.addressCidr
              ].filter(Boolean).join(" / ")}
            </Text>
          </Flex>
        </Grid>
      ))}
    </Flex>
  );
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
