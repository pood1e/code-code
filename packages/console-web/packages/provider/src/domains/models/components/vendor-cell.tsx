import type { VendorView } from "@code-code/agent-contract/platform/provider/v1";
import { Flex, Text } from "@radix-ui/themes";
import { VendorAvatar } from "./vendor-avatar";

type VendorCellProps = {
  fallbackLabel: string;
  vendor?: VendorView;
  iconUrl?: string;
};

export function VendorCell({ fallbackLabel, vendor, iconUrl }: VendorCellProps) {
  const label = vendor?.displayName || fallbackLabel;
  return (
    <Flex align="center" gap="2">
      <VendorAvatar displayName={label} iconUrl={iconUrl || vendor?.iconUrl} size="2" />
      <Text size="2">{label}</Text>
    </Flex>
  );
}
