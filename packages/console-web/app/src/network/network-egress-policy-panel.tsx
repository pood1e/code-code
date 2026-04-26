import { useMemo, useState } from "react";
import { Badge, Flex, Grid, Heading, Text } from "@radix-ui/themes";
import { PolicyCatalogCard } from "./network-egress-policy-catalog-card";
import { PolicyDetails } from "./network-egress-policy-section";
import type { EgressPolicyCatalog } from "./network-types";

export function EgressPolicyPanel({
  catalog,
  isLoading,
  isError
}: {
  catalog: EgressPolicyCatalog;
  isLoading?: boolean;
  isError?: boolean;
}) {
  const [selectedPolicyId, setSelectedPolicyId] = useState(catalog.policies[0]?.id ?? "");
  const syncedCount = catalog.policies.filter((policy) => policy.sync.status === "synced").length;
  const selectedPolicy = useMemo(
    () => catalog.policies.find((policy) => policy.id === selectedPolicyId) ?? catalog.policies[0],
    [catalog.policies, selectedPolicyId]
  );

  if (isLoading) {
    return <Text size="2" color="gray">Loading egress policies...</Text>;
  }
  if (isError) {
    return <Text size="2" color="red">Failed to load egress policies.</Text>;
  }
  if (!catalog.policies.length) {
    return <Text size="2" color="gray">No CLI or vendor egress policies found.</Text>;
  }

  return (
    <Grid columns={{ initial: "1", lg: "320px minmax(0, 1fr)" }} gap="4" align="start">
      <Flex direction="column" gap="3">
        <Flex justify="between" align="start" gap="3" wrap="wrap">
          <Flex direction="column" gap="1">
            <Heading as="h2" size="4" weight="medium">Applied runtime state</Heading>
            <Text size="2" color="gray">Read-only result after rules are resolved and pushed to Istio.</Text>
          </Flex>
          <Badge variant="soft">{syncedCount}/{catalog.policies.length} synced</Badge>
        </Flex>
        <Flex direction="column" gap="3" style={{ maxHeight: "60vh", overflowY: "auto" }}>
          <Grid columns={{ initial: "1", sm: "repeat(2, minmax(0, 1fr))", lg: "1" }} gap="3">
            {catalog.policies.map((policy) => (
              <PolicyCatalogCard
                key={policy.id}
                policy={policy}
                selected={policy.id === selectedPolicy?.id}
                onSelect={() => setSelectedPolicyId(policy.id)}
              />
            ))}
          </Grid>
        </Flex>
      </Flex>
      {selectedPolicy ? <PolicyDetails policy={selectedPolicy} /> : null}
    </Grid>
  );
}
