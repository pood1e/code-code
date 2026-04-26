import { Badge, Flex } from "@radix-ui/themes";
import type { IstioEgressPolicy } from "./network-types";

export function PolicySummary({ policy }: { policy: IstioEgressPolicy }) {
  const customRuleCount = policy.rules?.length ?? 0;
  const proxyCount = policy.proxies?.length ?? 0;

  return (
    <Flex gap="2" wrap="wrap">
      <Badge variant="soft">{customRuleCount} custom rules</Badge>
      <Badge color={proxyCount ? "blue" : "gray"} variant="soft">
        {proxyCount ? `${proxyCount} proxies available` : "direct by default"}
      </Badge>
      {policy.externalRuleSet.enabled ? (
        <Badge color="blue" variant="soft">{policy.externalRuleSetStatus.loadedHostCount} external hosts</Badge>
      ) : (
        <Badge color="gray" variant="soft">external set off</Badge>
      )}
    </Flex>
  );
}
