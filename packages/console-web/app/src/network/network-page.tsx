import { Box, Container, Flex, Heading, Tabs, Text } from "@radix-ui/themes";
import { useEgressPolicyCatalog } from "./api";
import { EgressPolicyPanel } from "./network-egress-policy-panel";
import { EgressRulesPanel } from "./network-egress-rules-panel";
import { EgressSummaryPanel } from "./network-egress-summary-panel";

export function NetworkPage() {
  const { catalog, isLoading, isError } = useEgressPolicyCatalog();

  return (
    <Container size="4" style={{ maxWidth: 1280 }}>
      <Flex direction="column" gap="4">
        <Flex direction="column" gap="2">
          <Heading size="6" weight="medium">Network</Heading>
          <Text size="2" color="gray">
            Review external destinations, service authorization, and generated Istio resources.
          </Text>
        </Flex>

        <Tabs.Root defaultValue="status">
          <Tabs.List size="2">
            <Tabs.Trigger value="status">Status</Tabs.Trigger>
            <Tabs.Trigger value="rules">Rules</Tabs.Trigger>
            <Tabs.Trigger value="policies">Applied</Tabs.Trigger>
          </Tabs.List>

          <Box mt="4">
            <Tabs.Content value="status">
              <EgressSummaryPanel catalog={catalog} isLoading={isLoading} isError={isError} />
            </Tabs.Content>

            <Tabs.Content value="rules">
              <EgressRulesPanel catalog={catalog} isLoading={isLoading} isError={isError} />
            </Tabs.Content>

            <Tabs.Content value="policies">
              <EgressPolicyPanel catalog={catalog} isLoading={isLoading} isError={isError} />
            </Tabs.Content>
          </Box>
        </Tabs.Root>
      </Flex>
    </Container>
  );
}
