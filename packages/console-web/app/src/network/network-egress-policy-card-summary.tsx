import { Badge, Flex } from "@radix-ui/themes";
import type { IstioEgressPolicy } from "./network-types";

export function PolicySummary({ policy }: { policy: IstioEgressPolicy }) {
  const externalRuleCount = policy.accessSets.reduce((sum, set) => sum + set.externalRules.length, 0);
  const serviceRuleCount = policy.accessSets.reduce((sum, set) => sum + set.serviceRules.length, 0);

  return (
    <Flex gap="2" wrap="wrap">
      <Badge variant="soft">{policy.accessSets.length} access sets</Badge>
      <Badge color={externalRuleCount ? "blue" : "gray"} variant="soft">{externalRuleCount} destinations</Badge>
      <Badge color={serviceRuleCount ? "green" : "gray"} variant="soft">{serviceRuleCount} service rules</Badge>
    </Flex>
  );
}
