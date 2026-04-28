import { Badge, Card, Flex, Grid, Heading, Text } from "@radix-ui/themes";
import type { EgressPolicyCatalog } from "./network-types";

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

  const accessSetCount = catalog.policies.reduce((sum, p) => sum + p.accessSets.length, 0);
  const externalRuleCount = catalog.policies.reduce((sum, p) => sum + p.accessSets.reduce((inner, set) => inner + set.externalRules.length, 0), 0);
  const serviceRuleCount = catalog.policies.reduce((sum, p) => sum + p.accessSets.reduce((inner, set) => inner + set.serviceRules.length, 0), 0);
  const generatedResourceCount = catalog.policies.reduce((sum, p) => sum + p.sync.appliedResources.length, 0);

  return (
    <Grid columns={{ initial: "1", sm: "2" }} gap="4">
      <SummaryCard title="Declarations" rows={[
        ["Access sets", String(accessSetCount)],
        ["External rules", String(externalRuleCount)],
        ["Service rules", String(serviceRuleCount)]
      ]} />
      <SummaryCard title="Generated resources" rows={[
        ["Resources", String(generatedResourceCount)],
        ["Policies", String(catalog.policies.length)]
      ]} />
    </Grid>
  );
}

function SummaryCard({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <Card size="2" variant="surface">
      <Flex direction="column" gap="3">
        <Heading as="h2" size="3" weight="medium">{title}</Heading>
        <Flex direction="column" gap="2">
          {rows.map(([label, value]) => (
            <Flex key={label} justify="between" gap="3">
              <Text size="2" color="gray">{label}</Text>
              <Badge variant="soft">{value}</Badge>
            </Flex>
          ))}
        </Flex>
      </Flex>
    </Card>
  );
}
