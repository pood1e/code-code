import { Text } from "@radix-ui/themes";
import { EgressPolicyEditor } from "./network-egress-policy-editor";
import type { EgressPolicyCatalog } from "./network-types";

export function EgressRulesPanel({
  catalog,
  isLoading,
  isError,
  onChanged
}: {
  catalog: EgressPolicyCatalog;
  isLoading?: boolean;
  isError?: boolean;
  onChanged: () => void | Promise<unknown>;
}) {
  if (isLoading) {
    return <Text size="2" color="gray">Loading...</Text>;
  }
  if (isError) {
    return <Text size="2" color="red">Failed to load rules.</Text>;
  }

  const primaryPolicy = catalog.policies[0];

  if (!primaryPolicy) {
    return <Text size="2" color="gray">No egress policy found.</Text>;
  }

  return <EgressPolicyEditor policy={primaryPolicy} onChanged={onChanged} />;
}
