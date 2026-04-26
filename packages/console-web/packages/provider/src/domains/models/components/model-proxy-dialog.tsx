import type { ModelDefinition } from "@code-code/agent-contract/model/v1";
import type { ModelRegistryEntry } from "@code-code/agent-contract/platform/model/v1";
import type { VendorView } from "@code-code/agent-contract/platform/provider/v1";
import type { ReactNode } from "react";
import { Box, Code, Dialog, Flex, ScrollArea, Separator, Text } from "@radix-ui/themes";
import { AsyncState, DialogCloseFooterActions, NoDataCallout, SoftBadge } from "@code-code/console-web-ui";
import { formatSourcePricing } from "../source-pricing";
import { vendorLookupKey } from "../vendor-index";
import { formatTokenSize, getVendorLabel } from "./model-formatters";
import { SourceBadge } from "./source-badge";
import { VendorAvatar } from "./vendor-avatar";

type ModelProxyDialogProps = {
  model: ModelRegistryEntry;
  proxyLoading: boolean;
  proxyRows: ModelRegistryEntry[];
  proxyTruncated: boolean;
  trigger: ReactNode;
  vendorsById: Record<string, VendorView>;
};

export function ModelProxyDialog({
  model,
  proxyLoading,
  proxyRows,
  proxyTruncated,
  trigger,
  vendorsById,
}: ModelProxyDialogProps) {
  const definition = model.definition as ModelDefinition;
  const displayName = definition.displayName || definition.modelId;

  return (
    <Dialog.Root>
      <Dialog.Trigger style={{ display: "contents" }}>
        {trigger}
      </Dialog.Trigger>
      <Dialog.Content maxWidth="820px" aria-describedby={undefined}>
        <Dialog.Title>{displayName}</Dialog.Title>
        <Flex align="center" gap="2" mt="1" wrap="wrap">
          <Text color="gray" size="2">Proxy providers for</Text>
          <Code size="1" variant="ghost">{definition.modelId}</Code>
        </Flex>

        <ScrollArea type="auto" scrollbars="vertical" style={{ maxHeight: "68vh" }}>
          <Box pr="3" mt="4">
            <AsyncState
              loading={proxyLoading}
              loadingCard={false}
              isEmpty={proxyRows.length === 0}
              emptyContent={<NoDataCallout>No proxy providers for this model.</NoDataCallout>}
            >
              <Flex direction="column" gap="3">
                {proxyRows.map((row, index) => (
                  <ProxyProviderItem
                    key={proxyRowKey(row)}
                    row={row}
                    separated={index > 0}
                    vendorsById={vendorsById}
                  />
                ))}
                {proxyTruncated ? (
                  <Text color="gray" size="1">Only the first proxy page is shown.</Text>
                ) : null}
              </Flex>
            </AsyncState>
          </Box>
        </ScrollArea>

        <DialogCloseFooterActions cancelText="Close" mt="5" />
      </Dialog.Content>
    </Dialog.Root>
  );
}

type ProxyProviderItemProps = {
  row: ModelRegistryEntry;
  separated: boolean;
  vendorsById: Record<string, VendorView>;
};

function ProxyProviderItem({ row, separated, vendorsById }: ProxyProviderItemProps) {
  const definition = row.definition as ModelDefinition;
  const vendor = vendorsById[vendorLookupKey(definition.vendorId)];
  const vendorLabel = vendor?.displayName || getVendorLabel(definition);
  const pricing = formatSourcePricing(row.pricing);
  const contextWindow = formatTokenSize(definition.contextWindowTokens);
  const sourceRef = row.sourceRef;

  return (
    <Flex direction="column" gap="3">
      {separated ? <Separator size="4" /> : null}
      <Flex align="start" justify="between" gap="4" wrap="wrap">
        <Flex direction="column" gap="2" style={{ minWidth: 0 }}>
          <Flex align="center" gap="2" wrap="wrap">
            <VendorAvatar displayName={vendorLabel} iconUrl={vendor?.iconUrl} size="1" />
            <Text size="2" weight="medium">{vendorLabel}</Text>
            <SourceBadge badges={row.badges} />
          </Flex>
          <Flex align="center" gap="2" wrap="wrap">
            <Code size="1" variant="ghost">{definition.modelId}</Code>
            {definition.displayName && definition.displayName !== definition.modelId ? (
              <Text color="gray" size="1">{definition.displayName}</Text>
            ) : null}
          </Flex>
        </Flex>
        <Flex align="center" gap="2" wrap="wrap" justify="end">
          <SoftBadge color="gray" label={`Context ${contextWindow}`} size="1" />
          <SoftBadge color={pricing ? "green" : "gray"} label={pricing || "No pricing"} size="1" />
        </Flex>
      </Flex>
      {sourceRef?.vendorId && sourceRef.modelId ? (
        <Text color="gray" size="1">
          Canonical source <Code size="1" variant="ghost">{`${sourceRef.vendorId}/${sourceRef.modelId}`}</Code>
        </Text>
      ) : null}
    </Flex>
  );
}

function proxyRowKey(row: ModelRegistryEntry) {
  const definition = row.definition;
  return `${definition?.vendorId || "unknown"}:${definition?.modelId || "unknown"}`;
}
