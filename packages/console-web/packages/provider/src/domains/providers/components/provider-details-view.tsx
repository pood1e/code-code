import { Box, Button, Dialog, Flex, Heading, Text } from "@radix-ui/themes";
import type { ComponentProps } from "react";
import type { ProviderSurface } from "@code-code/agent-contract/provider/v1";
import type { ProviderView } from "@code-code/agent-contract/platform/management/v1";
import { DialogFooterActions, ErrorCalloutIf, SoftBadge, StatusBadge } from "@code-code/console-web-ui";
import { VendorAvatar } from "../../models/components/vendor-avatar";
import { useProviderActiveQueryStatus } from "../provider-active-query-status";
import { providerHostTelemetryLatencyLabel, providerHostTelemetryStatus } from "../provider-host-telemetry";
import { providerModel } from "../provider-model";
import { ProviderAuthenticationSummary } from "./provider-authentication-summary";
import { ProviderModelCatalogBadges } from "./provider-model-catalog";

type Props = {
  provider: ProviderView;
  authenticationKind: ComponentProps<typeof ProviderAuthenticationSummary>["kind"];
  surfaces: ProviderSurface[];
  supportsActiveQuery: boolean;
  isProbingActiveQuery: boolean;
  deleteError: string;
  isDeleting: boolean;
  observabilityAuthenticationActionLabel?: string;
  onClose: () => void;
  onDelete: () => void;
  onStartRename: () => void;
  onStartAuthentication: () => void;
  onStartObservabilityAuthentication: () => void;
  onProbeActiveQuery: () => void;
  showObservabilityAuthenticationAction?: boolean;
};

export function ProviderDetailsView({
  provider,
  authenticationKind,
  surfaces,
  supportsActiveQuery,
  isProbingActiveQuery,
  deleteError,
  isDeleting,
  observabilityAuthenticationActionLabel,
  onClose,
  onDelete,
  onStartRename,
  onStartAuthentication,
  onStartObservabilityAuthentication,
  onProbeActiveQuery,
  showObservabilityAuthenticationAction,
}: Props) {
  const providerViewModel = providerModel(provider);
  const modelCount = providerViewModel.modelCount();
  const surfaceLabels = providerViewModel.surfaceLabels(surfaces);
  const protocolLabels = providerViewModel.protocolLabels();
  const accountStatus = useProviderActiveQueryStatus(provider, supportsActiveQuery) ?? providerViewModel.status();

  return (
    <>
      <Flex justify="between" align="start" mb="4" gap="3">
        <Box>
          <Flex align="center" gap="2">
            <VendorAvatar displayName={providerViewModel.displayName()} iconUrl={provider.iconUrl} size="2" />
            <Dialog.Title mb="0">{providerViewModel.displayName()}</Dialog.Title>
          </Flex>
          <Text size="1" color="gray" mt="1">{providerViewModel.operationalSummary()}</Text>
          <Flex align="center" gap="2" wrap="wrap" mt="2">
            <SoftBadge color="gray" label={providerViewModel.authenticationLabel()} />
            <StatusBadge color={accountStatus?.color || "gray"} label={accountStatus?.label || "Unknown"} />
            <SoftBadge color="gray" label={`${providerViewModel.surfaceCount()} surface${providerViewModel.surfaceCount() === 1 ? "" : "s"}`} />
            <SoftBadge color="gray" label={providerViewModel.modelsSummary()} />
          </Flex>
          {accountStatus?.reason ? (
            <Text size="1" color="gray" mt="2">
              {accountStatus.reason}
            </Text>
          ) : null}
        </Box>
        <Flex align="center" gap="2">
          <SoftBadge color="gray" label="Provider" />
          <Button size="1" variant="soft" color="gray" onClick={onStartRename}>
            Rename…
          </Button>
        </Flex>
      </Flex>

      <Flex direction="column" gap="4">
        <Box>
          <Heading size="2" mb="1">Auth</Heading>
          <ProviderAuthenticationSummary
            providerCredentialId={provider.providerCredentialId}
            kind={authenticationKind}
          />
          <Flex gap="2" mt="2" wrap="wrap">
            <Button size="2" variant="soft" color="gray" onClick={onStartAuthentication}>
              Update Authentication…
            </Button>
            {showObservabilityAuthenticationAction ? (
              <Button size="2" variant="soft" color="gray" onClick={onStartObservabilityAuthentication}>
                {observabilityAuthenticationActionLabel || "Update Observability Auth…"}
              </Button>
            ) : null}
            {supportsActiveQuery ? (
              <Button size="2" variant="soft" color="gray" onClick={onProbeActiveQuery} disabled={isProbingActiveQuery}>
                {isProbingActiveQuery ? "Probing…" : "Probe Active Query"}
              </Button>
            ) : null}
          </Flex>
        </Box>

        <Box>
          <Heading size="2" mb="1">Models</Heading>
          <Text size="2">{providerViewModel.modelsSummary()}</Text>
          <Text size="1" color="gray" mt="1">
            {modelCount} model entr{modelCount === 1 ? "y" : "ies"} on this provider.
          </Text>
          <Box mt="3">
            <ProviderModelCatalogBadges catalog={provider.modelCatalog ?? undefined} />
          </Box>
        </Box>

        <Box>
          <Heading size="2" mb="2">Surfaces</Heading>
          <Flex gap="2" wrap="wrap">
            {surfaceLabels.map((label) => (
              <SoftBadge key={`surface:${label}`} color="gray" label={label} />
            ))}
            {protocolLabels.map((label) => (
              <SoftBadge key={`protocol:${label}`} color="gray" label={label} />
            ))}
            {surfaceLabels.length === 0 && protocolLabels.length === 0 ? (
              <Text size="2" color="gray">No surfaces.</Text>
            ) : null}
          </Flex>
        </Box>

        {provider.hostTelemetry.length > 0 ? (
          <Box>
            <Heading size="2" mb="2">Host Telemetry</Heading>
            <Flex direction="column" gap="2">
              {provider.hostTelemetry.map((item) => {
                const status = providerHostTelemetryStatus(item);
                const latency = providerHostTelemetryLatencyLabel(item);
                return (
                  <Flex key={`${item.scheme}:${item.host}:${item.port}`} align="center" gap="2" wrap="wrap">
                    <StatusBadge color={status.color} label={status.label} />
                    {latency ? <SoftBadge color="gray" label={latency} /> : null}
                    {item.httpStatusCode > 0 ? <SoftBadge color="gray" label={`HTTP ${item.httpStatusCode}`} /> : null}
                  </Flex>
                );
              })}
            </Flex>
          </Box>
        ) : null}

        <ErrorCalloutIf error={deleteError} />
      </Flex>

      <DialogFooterActions
        isSubmitting={isDeleting}
        cancelText="Close"
        onCancel={onClose}
        submitText="Delete Provider Provider"
        onSubmit={onDelete}
        mt="4"
        actionsOrder="submit-first"
      />
    </>
  );
}
