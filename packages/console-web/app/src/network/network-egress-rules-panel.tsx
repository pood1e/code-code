import { Badge, Card, Flex, Grid, Heading, Text } from "@radix-ui/themes";
import { badgeStyle, rowStyle, WrappingCode } from "./network-egress-policy-rows";
import type { EgressPolicyCatalog } from "./network-types";

export function EgressRulesPanel({
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
    return <Text size="2" color="red">Failed to load rules.</Text>;
  }

  const accessSets = catalog.policies.flatMap((policy) => policy.accessSets);
  if (!accessSets.length) {
    return <Text size="2" color="gray">No external access sets declared.</Text>;
  }

  return (
    <Grid columns={{ initial: "1", lg: "repeat(2, minmax(0, 1fr))" }} gap="4">
      {accessSets.map((accessSet) => (
        <Card key={accessSet.id} size="2" variant="surface">
          <Flex direction="column" gap="3">
            <Flex justify="between" gap="3" wrap="wrap">
              <Heading as="h2" size="3" weight="medium">{accessSet.displayName}</Heading>
              <Flex gap="2" wrap="wrap">
                <Badge variant="soft">{accessSet.ownerService || "service"}</Badge>
              </Flex>
            </Flex>
            <Flex direction="column">
              {accessSet.externalRules.map((rule) => (
                <Grid
                  key={rule.id}
                  columns={{ initial: "1", md: "72px 120px minmax(0, 1fr)" }}
                  gap="2"
                  style={rowStyle}
                >
                  <Badge variant="soft" style={badgeStyle}>{rule.protocol}</Badge>
                  <Text size="2" color="gray">{rule.resolution}</Text>
                  <WrappingCode>{`${rule.host}:${rule.port}${rule.addressCidr ? ` ${rule.addressCidr}` : ""}`}</WrappingCode>
                </Grid>
              ))}
            </Flex>
          </Flex>
        </Card>
      ))}
    </Grid>
  );
}
