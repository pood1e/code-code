import { useMemo, type KeyboardEvent, type MouseEvent } from "react";
import { Box, Flex, Text } from "@radix-ui/themes";
import type { ProviderSurface } from "@code-code/agent-contract/provider/v1";
import type { CLI } from "@code-code/agent-contract/platform/support/v1";
import type { ProviderView } from "@code-code/agent-contract/platform/management/v1";
import type { Vendor } from "@code-code/agent-contract/platform/support/v1";
import { SoftBadge, StatusBadge, SurfaceSectionCard } from "@code-code/console-web-ui";
import { VendorAvatar } from "../../models/components/vendor-avatar";
import { useProviderObservability } from "../api";
import { resolveProviderCardOwner } from "../provider-card-capability";
import { resolveProviderCardRenderer } from "../provider-card-registry";
import { useProviderActiveQueryStatusFromObservability } from "../provider-active-query-status";
import { providerModel } from "../provider-model";
import { resolveProviderActiveQueryOwner } from "../provider-observability-visualization";
import { resolveProviderOwnerObservabilityModel, type ProviderOwnerObservabilityModel } from "../provider-owner-observability-model";
import type { ProviderWorkflowStatusView } from "../provider-workflow-status-view";
import { ProviderCustomCard } from "./provider-custom-card";
import { AccountIcon as ProviderIdentityIcon, ProbeIcon, ProviderActionIconButton } from "./provider-surface-binding-model-catalog-editor-icons";

type Props = {
  provider: ProviderView;
  clis: CLI[];
  surfaces: ProviderSurface[];
  vendors: Vendor[];
  vendorIconUrl?: string;
  workflowStatus?: ProviderWorkflowStatusView;
  isProbingActiveQuery?: boolean;
  onOpen: (provider: ProviderView) => void;
  onProbeActiveQuery: (provider: ProviderView) => void;
};

export function ProviderCard({
  provider,
  clis,
  onOpen,
  onProbeActiveQuery,
  surfaces,
  vendors,
  vendorIconUrl,
  workflowStatus,
  isProbingActiveQuery,
}: Props) {
  const providerViewModel = providerModel(provider);
  const authLabel = providerViewModel.authenticationLabel();
  const oauthSummary = providerViewModel.oauthSummary();
  const protocolLabels = providerViewModel.protocolLabels();
  const surfaceLabels = providerViewModel.surfaceLabels(surfaces);
  const cardOwner = useMemo(
    () => resolveProviderCardOwner({
      provider,
      clis,
      vendors,
    }),
    [provider, clis, vendors],
  );
  const hasCustomCard = useMemo(
    () => Boolean(resolveProviderCardRenderer(cardOwner)),
    [cardOwner],
  );
  const activeQueryOwner = useMemo(
    () => resolveProviderActiveQueryOwner(provider, clis, vendors),
    [provider, clis, vendors],
  );
  const hasActiveQuery = Boolean(activeQueryOwner);
  const { detail: statusDetail, isLoading: isStatusLoading, isError: isStatusError } = useProviderObservability(
    hasActiveQuery ? provider.providerId : undefined,
    "1h",
    "status",
  );
  const { detail: cardDetail, isLoading: isCardLoading, error: cardError } = useProviderObservability(
    hasCustomCard ? provider.providerId : undefined,
    "1h",
    "card",
  );
  const status = useProviderActiveQueryStatusFromObservability(provider, hasActiveQuery, {
    detail: statusDetail,
    isLoading: isStatusLoading,
    isError: isStatusError,
  }, activeQueryOwner) ?? providerViewModel.status();
  const statusObservability = useMemo(
    () => (activeQueryOwner ? resolveProviderOwnerObservabilityModel(
      statusDetail,
      activeQueryOwner,
      activeQueryOwner.providerSurfaceBindingId || providerViewModel.primarySurfaceId(),
    ) : null),
    [providerViewModel, activeQueryOwner, statusDetail],
  );

  return (
    <SurfaceSectionCard
      title={(
        <Flex align="center" gap="2">
          <VendorAvatar
            displayName={providerViewModel.displayName()}
            iconUrl={vendorIconUrl}
            size="1"
          />
          <Text weight="medium">{providerViewModel.displayName()}</Text>
          <SoftBadge color="gray" label={authLabel} />
        </Flex>
      )}
      actions={hasActiveQuery ? (
        <Flex gap="2" align="center">
          <ProviderActionIconButton
            label="Probe active query"
            title={isProbingActiveQuery ? "Probing active query" : "Probe active query"}
            disabled={Boolean(isProbingActiveQuery)}
            onClick={(event: MouseEvent) => {
              event?.stopPropagation();
              onProbeActiveQuery(provider);
            }}
            onKeyDown={(event: KeyboardEvent) => event.stopPropagation()}
          >
            <ProbeIcon />
          </ProviderActionIconButton>
        </Flex>
      ) : null}
      cardSize="2"
      style={{ cursor: "pointer" }}
      cardProps={{
        role: "button",
        tabIndex: 0,
        onClick: () => onOpen(provider),
        onKeyDown: (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen(provider);
          }
        },
      }}
    >
      {oauthSummary.length > 0 || !hasActiveQuery ? (
        <Flex mt="3" justify="between" align="center" gap="3">
          {oauthSummary.length > 0 ? (
            <Box>
              {oauthSummary.map((item) => (
                item.emphasized ? (
                  <ProviderIdentityTag key={item.key} value={item.value} />
                ) : (
                  <Text key={item.key} size="1" color="gray" as="div">
                    {item.value}
                  </Text>
                )
              ))}
            </Box>
          ) : null}
          {!hasActiveQuery ? (
            <StatusBadge color={status.color} label={status.label} />
          ) : null}
        </Flex>
      ) : null}
      <Text size="1" color="gray" mt="3" as="div">
        {providerViewModel.operationalSummary()}
      </Text>
      {surfaceLabels.length > 0 || protocolLabels.length > 0 ? (
        <Flex mt="3" gap="1" wrap="wrap">
          {surfaceLabels.map((label) => (
            <SoftBadge key={`surface:${label}`} color="gray" label={label} />
          ))}
          {protocolLabels.map((label) => (
            <SoftBadge key={`protocol:${label}`} color="gray" label={label} />
          ))}
        </Flex>
      ) : null}
      <ProviderHealth observability={statusObservability} isLoading={isStatusLoading} />
      {workflowStatus ? (
        <Flex mt="3">
          <StatusBadge color={workflowStatus.color} label={workflowStatus.label} />
        </Flex>
      ) : null}
      <ProviderCustomCard
        provider={provider}
        clis={clis}
        vendors={vendors}
        detail={cardDetail}
        isLoading={isCardLoading}
        error={cardError}
        status={hasActiveQuery ? status : null}
      />
      {status.reason ? (
        <Text size="1" color="gray" mt="2">
          {status.reason}
        </Text>
      ) : null}
      {workflowStatus?.reason ? (
        <Text size="1" color="gray" mt="2">
          {workflowStatus.reason}
        </Text>
      ) : null}
    </SurfaceSectionCard>
  );
}

function ProviderHealth({
  isLoading,
  observability,
}: {
  isLoading: boolean;
  observability: ProviderOwnerObservabilityModel | null;
}) {
  const authUsable = observability?.authUsableValue() ?? null;
  const credentialLastUsed = observability?.credentialLastUsedRelativeLabel() || null;
  if (authUsable === null && !credentialLastUsed && !isLoading) {
    return null;
  }
  return (
    <Flex mt="3" gap="2" align="center" wrap="wrap">
      {authUsable === null ? (
        isLoading ? <SoftBadge color="gray" label="Auth checking" /> : null
      ) : (
        <StatusBadge
          color={authUsable > 0 ? "green" : "red"}
          label={authUsable > 0 ? "Auth usable" : "Auth blocked"}
        />
      )}
      {credentialLastUsed ? (
        <Text size="1" color="gray">
          Credential used {credentialLastUsed}
        </Text>
      ) : null}
    </Flex>
  );
}

function ProviderIdentityTag({ value }: { value: string }) {
  return (
    <Flex
      align="center"
      gap="1"
      px="2"
      py="1"
      style={{
        width: "fit-content",
        borderRadius: "999px",
        border: "1px solid var(--gray-a5)",
        background: "var(--gray-3)",
      }}
    >
      <ProviderIdentityIcon />
      <Text size="1" weight="medium">
        {value}
      </Text>
    </Flex>
  );
}
