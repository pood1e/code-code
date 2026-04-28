import { useMemo } from "react";
import { Box, Button, Flex } from "@radix-ui/themes";
import { ErrorCalloutIf, NoDataCallout } from "@code-code/console-web-ui";
import { AddProviderDialog } from "../domains/providers/components/add-provider-dialog";
import { ProviderCardGrid } from "../domains/providers/components/provider-card-grid";
import { ProviderDetailsDialog as ProviderDetailsDialog } from "../domains/providers/components/provider-details-dialog";
import { type ProviderConnectOptionKind } from "../domains/providers/provider-connect-options";
import { useProvidersPageController } from "./use-providers-page-controller";

function ProviderAddActions({
  onAdd,
  onRefreshQuota,
  refreshingQuota,
}: {
  onAdd: (kind: ProviderConnectOptionKind) => void;
  onRefreshQuota: () => void;
  refreshingQuota: boolean;
}) {
  return (
    <Flex gap="2" wrap="wrap" justify="end">
      <Button size="2" variant="soft" color="gray" onClick={onRefreshQuota} disabled={refreshingQuota}>
        {refreshingQuota ? "Refreshing quota..." : "Refresh quota"}
      </Button>
      <Button size="2" variant="solid" onClick={() => onAdd("vendorApiKey")}>
        Vendor API Key
      </Button>
      <Button size="2" variant="soft" onClick={() => onAdd("customApiKey")}>
        Custom API Key
      </Button>
      <Button size="2" variant="soft" onClick={() => onAdd("cliOAuth")}>
        CLI OAuth
      </Button>
    </Flex>
  );
}

export function ProvidersPage() {
  const page = useProvidersPageController();

  // Data-driven: if no provider has an ID, the API is returning sanitized data
  // (e.g. showcase-api strips IDs). Management actions require provider IDs.
  const hasProviderIds = useMemo(
    () => page.sortedProviders.some((provider) => Boolean(provider.providerId)),
    [page.sortedProviders],
  );
  const readonly = !page.isLoading && page.sortedProviders.length > 0 && !hasProviderIds;
  const canManageProviders = !page.isLoading && !page.blockingError && !readonly;

  const handleAddDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && page.searchState.connectSessionId) {
      page.dismissedConnectSessionIDRef.current = page.searchState.connectSessionId;
    }
    page.setIsAddDialogOpen(nextOpen);
    if (!nextOpen) {
      page.updateConnectSessionParam(undefined, undefined);
    }
  };

  return (
    <Box>
      {canManageProviders ? (
        <AddProviderDialog
          open={page.isAddDialogOpen}
          connectSessionId={page.searchState.connectSessionId}
          preferredOptionKind={page.preferredAddKind}
          onOpenChange={handleAddDialogOpenChange}
          onConnectSessionChange={page.updateConnectSessionParam}
          onConnected={page.handleConnected}
        />
      ) : null}
      {hasProviderIds ? (
        <>
          <ProviderDetailsDialog
            provider={page.selectedProvider}
            clis={page.clis}
            surfaces={page.surfaces}
            vendors={page.vendors}
            onClose={page.closeProvider}
            onUpdated={page.refreshProviderPageData}
            onProbeActiveQuery={(provider) => void page.handleProbeProviderActiveQuery(provider)}
            probingProviderId={page.probingProviderId}
          />
        </>
      ) : null}
      <ProviderCardGrid
        providers={page.sortedProviders}
        clis={page.clis}
        surfaces={page.surfaces}
        vendors={page.vendors}
        loading={page.isLoading}
        error={page.blockingError}
        readonly={readonly}
        workflowStatuses={hasProviderIds ? page.providerWorkflowStatuses : undefined}
        probingProviderId={hasProviderIds ? page.probingProviderId : undefined}
        onOpen={hasProviderIds ? page.openProvider : undefined}
        onProbeActiveQuery={hasProviderIds ? ((provider) => void page.handleProbeProviderActiveQuery(provider)) : undefined}
        onRetry={() => void page.mutateProviders()}
        headerActions={canManageProviders ? (
          <ProviderAddActions
            onAdd={page.handleAdd}
            onRefreshQuota={() => void page.handleRefreshQuota()}
            refreshingQuota={page.isRefreshingQuota}
          />
        ) : undefined}
        headerCallouts={hasProviderIds ? (
          <>
            <ErrorCalloutIf error={page.observabilityProbeError} mb="4" />
            <ErrorCalloutIf error={page.providerStatusEventsError} mb="4" />
            {page.observabilityProbeMessage ? <NoDataCallout mb="4">{page.observabilityProbeMessage}</NoDataCallout> : null}
          </>
        ) : undefined}
      />
    </Box>
  );
}
